const { onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

const REGION = "asia-southeast1";
const COUNTDOWN_MS = 4000;
const LIVE_MS = 60000;
const INTERMISSION_MS = 15000;

// 全FCMトークンに通知を送る
async function sendToAll(title, body) {
  const db = getDatabase();
  const snap = await db.ref("/fcmTokens").get();
  const tokens = snap.val();
  if (!tokens) return;

  const tokenList = Object.values(tokens).map(t => t.token).filter(Boolean);
  if (tokenList.length === 0) return;

  const messaging = getMessaging();
  const chunks = [];
  for (let i = 0; i < tokenList.length; i += 500) {
    chunks.push(tokenList.slice(i, i + 500));
  }

  for (const chunk of chunks) {
    await messaging.sendEachForMulticast({
      tokens: chunk,
      notification: { title, body },
      android: { priority: "high" },
    }).catch(console.error);
  }
}

// 特定トークンに通知を送る
async function sendToToken(token, title, body) {
  if (!token) return;
  const messaging = getMessaging();
  await messaging.send({
    token,
    notification: { title, body },
    android: { priority: "high" },
  }).catch(console.error);
}

// ① キューに変化があった時：アイドル中であればカウントダウンを開始する。
// トランザクションで「idleである場合のみcountdownに書き換える」ことを保証するため、
// 複数の実行が同時に発生しても二重にステージが始まることはない。
exports.onQueueChange = onValueWritten(
  { ref: "/stage/queue", region: REGION, timeoutSeconds: 30 },
  async (event) => {
    const db = getDatabase();

    const statusResult = await db.ref("/stage/status").transaction((current) => {
      if (current === "idle" || current === null) return "countdown";
      return; // idle以外の時は何もしない（他のフェーズが進行中）
    });
    console.log(
      "[onQueueChange] transaction committed:", statusResult.committed,
      " 現在値:", statusResult.snapshot.val()
    );
    if (!statusResult.committed) return;

    const queueSnap = await db.ref("/stage/queue").get();
    const queue = queueSnap.val() || {};
    const queueList = Object.entries(queue).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    console.log("[onQueueChange] queueList件数:", queueList.length);

    if (queueList.length === 0) {
      // 予約はしたが誰もいなかった場合は戻す
      await db.ref("/stage/status").set("idle");
      console.log("[onQueueChange] 誰もいなかったのでidleに戻した");
      return;
    }

    const [uid, speaker] = queueList[0];
    console.log("[onQueueChange] 選ばれたspeaker:", JSON.stringify(speaker));

    const prevQueue = event.data.before.val() || {};
    if (Object.keys(prevQueue).length === 0) {
      await sendToAll("🎭 ステージが始まるぞ！", "愚痴ヒーローが舞台に上がろうとしている");
    }

    try {
      await db.ref("/stage").update({
        status: "countdown",
        currentSpeaker: { id: uid, heroName: speaker.heroName ?? "匿名ヒーロー", startedAt: Date.now() },
        niceCount: 0,
      });
      console.log("[onQueueChange] countdown開始。speaker:", speaker.heroName);
    } catch (error) {
      console.error("[onQueueChange] currentSpeakerの書き込みでエラー:", error);
      // 失敗した場合はidleに戻し、キューが詰まったままにならないようにする
      await db.ref("/stage/status").set("idle");
    }
  }
);

// ② カウントダウンが始まった時：実際の開始時刻から4秒後にliveへ切り替える。
// この関数は「今countdownになった」という1回のイベントだけに反応するので、
// 発表者が何人続いても、その都度独立して1回だけ実行される。
exports.onCountdownStart = onValueWritten(
  { ref: "/stage/status", region: REGION, timeoutSeconds: 30 },
  async (event) => {
    console.log("[onCountdownStart] fired. after:", event.data.after.val());
    if (event.data.after.val() !== "countdown") {
      console.log("[onCountdownStart] countdownではないため終了");
      return;
    }

    const db = getDatabase();
    const speakerSnap = await db.ref("/stage/currentSpeaker").get();
    const speaker = speakerSnap.val();
    console.log("[onCountdownStart] currentSpeaker:", JSON.stringify(speaker));
    if (!speaker?.startedAt) {
      console.log("[onCountdownStart] startedAtが無いため終了");
      return;
    }

    const waitMs = Math.max(0, speaker.startedAt + COUNTDOWN_MS - Date.now());
    console.log("[onCountdownStart] waitMs:", waitMs);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // 待機中に状態が変わっていないか確認してから書き込む
    const currentStatus = (await db.ref("/stage/status").get()).val();
    console.log("[onCountdownStart] 待機後のstatus:", currentStatus);
    if (currentStatus !== "countdown") {
      console.log("[onCountdownStart] 待機中にstatusが変わったため終了");
      return;
    }

    await db.ref("/stage/status").set("live");
    console.log("[onCountdownStart] liveへ切り替え完了");

    // 待機列の次の人に通知
    const currentQueue = (await db.ref("/stage/queue").get()).val() || {};
    const waitingList = Object.entries(currentQueue)
      .filter(([id]) => id !== speaker.id)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    if (waitingList.length > 0) {
      const [, nextSpeaker] = waitingList[0];
      if (nextSpeaker.fcmToken) {
        await sendToToken(nextSpeaker.fcmToken, "🎤 もうすぐあなたの番です", "60秒後にステージへ！準備してください");
      }
    }
  }
);

// ③ liveが始まった時：実際の発表開始時刻から60秒後に終了処理をする。
exports.onLiveStart = onValueWritten(
  { ref: "/stage/status", region: REGION, timeoutSeconds: 90 },
  async (event) => {
    if (event.data.after.val() !== "live") return;

    const db = getDatabase();
    const speakerSnap = await db.ref("/stage/currentSpeaker").get();
    const speaker = speakerSnap.val();
    if (!speaker?.startedAt) return;

    const liveStartedAt = speaker.startedAt + COUNTDOWN_MS;
    const waitMs = Math.max(0, liveStartedAt + LIVE_MS - Date.now());
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    // 待機中に状態が変わっていないか（既に別処理で進んでいないか）確認
    const currentSnap = await db.ref("/stage").get();
    const current = currentSnap.val() || {};
    if (current.status !== "live" || current.currentSpeaker?.id !== speaker.id) return;

    await db.ref(`/stage/queue/${speaker.id}`).remove();
    await db.ref("/comments").remove();
    await db.ref("/stage").update({ status: "intermission", currentSpeaker: null });
  }
);

// ④ intermission（終了後の幕間）が始まった時：15秒後に、次の人がいれば
// カウントダウンを開始し、いなければidleに戻す。
exports.onIntermissionStart = onValueWritten(
  { ref: "/stage/status", region: REGION, timeoutSeconds: 30 },
  async (event) => {
    if (event.data.after.val() !== "intermission") return;
    console.log("[onIntermissionStart] fired");

    await new Promise((resolve) => setTimeout(resolve, INTERMISSION_MS));

    const db = getDatabase();
    const currentStatus = (await db.ref("/stage/status").get()).val();
    console.log("[onIntermissionStart] 待機後のstatus:", currentStatus);
    if (currentStatus !== "intermission") return;

    const nextSnap = await db.ref("/stage/queue").get();
    const nextQueue = nextSnap.val() || {};
    console.log("[onIntermissionStart] 次のqueue件数:", Object.keys(nextQueue).length);

    if (Object.keys(nextQueue).length === 0) {
      await db.ref("/stage/status").set("idle");
      console.log("[onIntermissionStart] 次の人がいないのでidleへ");
      return;
    }

    const nextList = Object.entries(nextQueue).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
    const [nextUid, nextSpeaker] = nextList[0];
    console.log("[onIntermissionStart] 次のspeaker:", JSON.stringify(nextSpeaker));

    try {
      await db.ref("/stage").update({
        status: "countdown",
        currentSpeaker: { id: nextUid, heroName: nextSpeaker.heroName ?? "匿名ヒーロー", startedAt: Date.now() },
        niceCount: 0,
      });
      console.log("[onIntermissionStart] 次のcountdown開始完了");
    } catch (error) {
      console.error("[onIntermissionStart] currentSpeakerの書き込みでエラー:", error);
      await db.ref("/stage/status").set("idle");
    }
  }
);

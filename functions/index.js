const { onValueWritten } = require("firebase-functions/v2/database");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");
const { AccessToken } = require("livekit-server-sdk");

initializeApp();

const REGION = "asia-southeast1";
const COUNTDOWN_MS = 4000;
const LIVE_MS = 60000;
// 自分の番が来た時、タップして開始するまでの猶予時間。
// この間に反応が無ければ「不在」とみなし、キューから外して次の人に回す。
const CONFIRM_MS = 15000;

// ステージは常に1つしか存在しないため、LiveKitのルーム名は固定にする
const STAGE_ROOM = "guchihero-stage";

// LiveKit接続用シークレット(firebase functions:secrets:setで登録済み)
const LIVEKIT_API_KEY = defineSecret("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = defineSecret("LIVEKIT_API_SECRET");
const LIVEKIT_URL = defineSecret("LIVEKIT_URL");

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

// 待機列の中から、指定したID以外で一番先頭の人を返す
function getWaitingList(queue, excludeId) {
  return Object.entries(queue || {})
    .filter(([id]) => id !== excludeId)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
}

// 誰かを「確認待ち」状態にする（まだ本番のカウントダウンは始めない）
async function enterConfirming(db, uid, speaker) {
  await db.ref("/stage").update({
    status: "confirming",
    currentSpeaker: {
      id: uid,
      heroName: speaker.heroName ?? "匿名ヒーロー",
      confirmDeadline: Date.now() + CONFIRM_MS,
    },
    niceCount: 0,
  });
}

// ① キューに変化があった時：アイドル中であれば「確認待ち」を開始する。
// トランザクションで「idleである場合のみ書き換える」ことを保証するため、
// 複数の実行が同時に発生しても二重にステージが始まることはない。
exports.onQueueChange = onValueWritten(
  { ref: "/stage/queue", region: REGION, timeoutSeconds: 30 },
  async (event) => {
    const db = getDatabase();

    const statusResult = await db.ref("/stage/status").transaction((current) => {
      if (current === "idle" || current === null) return "confirming";
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
      await enterConfirming(db, uid, speaker);
      console.log("[onQueueChange] 確認待ち開始。speaker:", speaker.heroName);
    } catch (error) {
      console.error("[onQueueChange] currentSpeakerの書き込みでエラー:", error);
      await db.ref("/stage/status").set("idle");
    }
  }
);

// ②' 確認待ちが始まった時：15秒以内にタップ（countdownへの切り替え）が
// 無ければ「不在」とみなし、キューから外して次の人を確認待ちにする。
// 次の人には「予告」ではなく「今すぐタップしてください」という即時通知を送る。
exports.onConfirmingStart = onValueWritten(
  { ref: "/stage/status", region: REGION, timeoutSeconds: 30 },
  async (event) => {
    if (event.data.after.val() !== "confirming") return;
    console.log("[onConfirmingStart] fired");

    const db = getDatabase();
    const speakerSnap = await db.ref("/stage/currentSpeaker").get();
    const speaker = speakerSnap.val();
    if (!speaker?.confirmDeadline) return;

    const waitMs = Math.max(0, speaker.confirmDeadline - Date.now());
    console.log("[onConfirmingStart] waitMs:", waitMs);
    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const currentSnap = await db.ref("/stage").get();
    const current = currentSnap.val() || {};

    // 待っている間にタップされて次のフェーズ（countdown）に進んでいれば何もしない
    if (current.status !== "confirming" || current.currentSpeaker?.id !== speaker.id) {
      console.log("[onConfirmingStart] 既に反応済み、または状況が変わっていたため終了");
      return;
    }

    console.log("[onConfirmingStart] 反応が無かったためスキップ:", speaker.heroName);
    await db.ref(`/stage/queue/${speaker.id}`).remove();

    const nextQueue = (await db.ref("/stage/queue").get()).val() || {};
    const nextList = getWaitingList(nextQueue, null);

    if (nextList.length === 0) {
      await db.ref("/stage").update({ status: "idle", currentSpeaker: null });
      console.log("[onConfirmingStart] 次の人がいないのでidleへ");
      return;
    }

    const [nextUid, nextSpeaker] = nextList[0];
    await enterConfirming(db, nextUid, nextSpeaker);

    // スキップによる繰り上がりは予告する時間が無いため、即時通知に切り替える
    if (nextSpeaker.fcmToken) {
      await sendToToken(
        nextSpeaker.fcmToken,
        "🎤 今、あなたの番です",
        "15秒以内にアプリでタップして開始してください"
      );
    }
  }
);

// ② カウントダウンが始まった時：実際の開始時刻から4秒後にliveへ切り替える。
// startedAtは、本人がアプリ上で「タップしてスタート」を押した瞬間にクライアント側で書き込まれる。
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

    const currentStatus = (await db.ref("/stage/status").get()).val();
    console.log("[onCountdownStart] 待機後のstatus:", currentStatus);
    if (currentStatus !== "countdown") {
      console.log("[onCountdownStart] 待機中にstatusが変わったため終了");
      return;
    }

    await db.ref("/stage/status").set("live");
    console.log("[onCountdownStart] liveへ切り替え完了");
  }
);

// ③ liveが始まった時：実際の発表開始時刻から60秒後に終了処理をする。
// 終了したら、幕間の待ち時間を挟まず、その場ですぐ次の人を確認待ちにする
// （「発表終わりの余韻のタイミングで次の人にボタンを出す」という仕様のため）。
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

    const currentSnap = await db.ref("/stage").get();
    const current = currentSnap.val() || {};
    if (current.status !== "live" || current.currentSpeaker?.id !== speaker.id) return;

    await db.ref(`/stage/queue/${speaker.id}`).remove();
    await db.ref("/comments").remove();

    const nextQueue = (await db.ref("/stage/queue").get()).val() || {};
    const nextList = getWaitingList(nextQueue, null);

    if (nextList.length === 0) {
      await db.ref("/stage").update({ status: "idle", currentSpeaker: null });
      console.log("[onLiveStart] 次の人がいないのでidleへ");
      return;
    }

    const [nextUid, nextSpeaker] = nextList[0];
    await enterConfirming(db, nextUid, nextSpeaker);
    console.log("[onLiveStart] 続けて次の人を確認待ちにした:", nextSpeaker.heroName);

    if (nextSpeaker.fcmToken) {
      await sendToToken(
        nextSpeaker.fcmToken,
        "🎤 あなたの番です",
        "15秒以内にアプリでタップして開始してください"
      );
    }
  }
);

// ⑤ 次の人に、前の発表者が始まってから30秒経過したタイミングで予告通知する。
// 「並んだ瞬間」に送っても、その時点ではまだアプリを開いているので意味がない。
// 一旦アプリを離れた人を、早めのタイミングで呼び戻すための予告。
exports.onNotifyNextSpeaker = onValueWritten(
  { ref: "/stage/status", region: REGION, timeoutSeconds: 90 },
  async (event) => {
    if (event.data.after.val() !== "live") return;

    const db = getDatabase();
    const speakerSnap = await db.ref("/stage/currentSpeaker").get();
    const speaker = speakerSnap.val();
    if (!speaker?.startedAt) return;

    const liveStartedAt = speaker.startedAt + COUNTDOWN_MS;
    // 前の発表者が始まってから30秒経過したタイミングで予告する
    const notifyAt = liveStartedAt + 30000;
    const waitMs = Math.max(0, notifyAt - Date.now());
    console.log("[onNotifyNextSpeaker] waitMs:", waitMs);

    await new Promise((resolve) => setTimeout(resolve, waitMs));

    const currentSnap = await db.ref("/stage").get();
    const current = currentSnap.val() || {};
    if (current.currentSpeaker?.id !== speaker.id) {
      console.log("[onNotifyNextSpeaker] 状況が変わっていたため終了");
      return;
    }

    const queue = current.queue || {};
    const waitingList = getWaitingList(queue, speaker.id);

    if (waitingList.length > 0) {
      const [, nextSpeaker] = waitingList[0];
      console.log("[onNotifyNextSpeaker] 通知対象:", nextSpeaker.heroName);
      if (nextSpeaker.fcmToken) {
        await sendToToken(nextSpeaker.fcmToken, "🎤 もうすぐあなたの番です", "まもなくステージへ上がります！");
      }
    }
  }
);

// ⑥ LiveKit接続用トークンを発行する。
// 発表者(publisher)の権限は、クライアントの自己申告だけでは絶対に渡さない。
// 「今この瞬間、本当にこのuidが発表者として認められているか」をFirebase側の
// /stage/currentSpeaker と突き合わせてから発行することで、なりすまし配信を防ぐ。
exports.getLiveKitToken = onCall(
  {
    region: REGION,
    secrets: [LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL],
  },
  async (request) => {
    const { role, uid } = request.data || {};

    if (role !== "speaker" && role !== "listener") {
      throw new HttpsError("invalid-argument", "roleはspeakerかlistenerを指定してください");
    }

    const db = getDatabase();

    if (role === "speaker") {
      if (!uid) {
        throw new HttpsError("invalid-argument", "uidが必要です");
      }

      const stageSnap = await db.ref("/stage").get();
      const stage = stageSnap.val() || {};
      const isCurrentSpeaker =
        stage.currentSpeaker?.id === uid &&
        (stage.status === "countdown" || stage.status === "live");

      if (!isCurrentSpeaker) {
        console.warn("[getLiveKitToken] 発表者として認められないリクエスト. uid:", uid, "status:", stage.status);
        throw new HttpsError("permission-denied", "現在の発表者として認められませんでした");
      }

      const at = new AccessToken(LIVEKIT_API_KEY.value(), LIVEKIT_API_SECRET.value(), {
        identity: `speaker_${uid}`,
        ttl: "10m",
      });
      at.addGrant({
        room: STAGE_ROOM,
        roomJoin: true,
        canPublish: true,
        canSubscribe: false,
      });

      const token = await at.toJwt();
      console.log("[getLiveKitToken] 発表者トークン発行. uid:", uid);
      return { token, url: LIVEKIT_URL.value(), room: STAGE_ROOM };
    }

    // role === "listener"：視聴専用。誰でも発行してよい（送信権限は持たせない）
    const identity = `listener_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const at = new AccessToken(LIVEKIT_API_KEY.value(), LIVEKIT_API_SECRET.value(), {
      identity,
      ttl: "1h",
    });
    at.addGrant({
      room: STAGE_ROOM,
      roomJoin: true,
      canPublish: false,
      canSubscribe: true,
    });

    const token = await at.toJwt();
    return { token, url: LIVEKIT_URL.value(), room: STAGE_ROOM };
  }
);

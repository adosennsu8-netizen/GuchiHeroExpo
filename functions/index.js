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
const CONFIRM_MS = 15000;

const STAGE_ROOM = "guchihero-stage";

const LIVEKIT_API_KEY = defineSecret("LIVEKIT_API_KEY");
const LIVEKIT_API_SECRET = defineSecret("LIVEKIT_API_SECRET");
const LIVEKIT_URL = defineSecret("LIVEKIT_URL");

// 全FCMトークンに通知を送る。
// tagを指定することで、オフライン中に何度も発火した場合でも
// 端末側では常に最新の1件だけが表示される（tag無しだと、溜まった分が
// 再接続時にまとめて全件表示されてしまう）。
async function sendToAll(title, body, tag) {
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
      android: { priority: "high", collapseKey: tag, notification: { tag } },
      apns: { headers: { "apns-collapse-id": tag } },
    }).catch(console.error);
  }
}

// 特定トークンに通知を送る（同上、tagで重複表示を防ぐ）
async function sendToToken(token, title, body, tag) {
  if (!token) return;
  const messaging = getMessaging();
  await messaging.send({
    token,
    notification: { title, body },
    android: { priority: "high", collapseKey: tag, notification: { tag } },
    apns: { headers: { "apns-collapse-id": tag } },
  }).catch(console.error);
}

function getWaitingList(queue, excludeId) {
  return Object.entries(queue || {})
    .filter(([id]) => id !== excludeId)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt);
}

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

exports.onQueueChange = onValueWritten(
  { ref: "/stage/queue", region: REGION, timeoutSeconds: 30 },
  async (event) => {
    const db = getDatabase();

    const statusResult = await db.ref("/stage/status").transaction((current) => {
      if (current === "idle" || current === null) return "confirming";
      return;
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
      await sendToAll("🎭 ステージが始まるぞ！", "愚痴ヒーローが舞台に上がろうとしている", "stage-start");
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

    if (nextSpeaker.fcmToken) {
      await sendToToken(
        nextSpeaker.fcmToken,
        "🎤 今、あなたの番です",
        "15秒以内にアプリでタップして開始してください",
        "your-turn"
      );
    }
  }
);

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
        "15秒以内にアプリでタップして開始してください",
        "your-turn"
      );
    }
  }
);

exports.onNotifyNextSpeaker = onValueWritten(
  { ref: "/stage/status", region: REGION, timeoutSeconds: 90 },
  async (event) => {
    if (event.data.after.val() !== "live") return;

    const db = getDatabase();
    const speakerSnap = await db.ref("/stage/currentSpeaker").get();
    const speaker = speakerSnap.val();
    if (!speaker?.startedAt) return;

    const liveStartedAt = speaker.startedAt + COUNTDOWN_MS;
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
        await sendToToken(
          nextSpeaker.fcmToken,
          "🎤 もうすぐあなたの番です",
          "まもなくステージへ上がります！",
          "coming-up"
        );
      }
    }
  }
);

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
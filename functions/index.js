const { onValueWritten } = require("firebase-functions/v2/database");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

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

exports.stageController = onValueWritten(
  { ref: "/stage/queue", region: "asia-southeast1", timeoutSeconds: 180 },
  async (event) => {
    const db = getDatabase();
    const stageSnap = await db.ref("/stage").get();
    const stage = stageSnap.val() || {};

    if (stage.status === "live" || stage.status === "countdown") return;

    const queue = stage.queue || {};
    const queueList = Object.entries(queue).sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    if (queueList.length === 0) {
      await db.ref("/stage").update({ status: "idle", currentSpeaker: null, niceCount: 0 });
      return;
    }

    const [uid, speaker] = queueList[0];

    // 待機列が空→1人になった場合は全員に通知
    const prevQueue = event.data.before.val() || {};
    if (Object.keys(prevQueue).length === 0) {
      await sendToAll("🎭 ステージが始まるぞ！", "愚痴ヒーローが舞台に上がろうとしている");
    }

    await db.ref("/stage").update({
      status: "countdown",
      currentSpeaker: { id: uid, heroName: speaker.heroName, startedAt: Date.now() },
      niceCount: 0,
    });

    await new Promise(resolve => setTimeout(resolve, 4000));
    await db.ref("/stage/status").set("live");

    // 発表開始 → 待機列の次の人に通知
    const currentQueue = await db.ref("/stage/queue").get();
    const currentQueueVal = currentQueue.val() || {};
    const waitingList = Object.entries(currentQueueVal)
      .filter(([id]) => id !== uid)
      .sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    if (waitingList.length > 0) {
      const [, nextSpeaker] = waitingList[0];
      if (nextSpeaker.fcmToken) {
        await sendToToken(nextSpeaker.fcmToken, "🎤 もうすぐあなたの番です", "60秒後にステージへ！準備してください");
      }
    }

    // 60秒後に終了処理
    await new Promise(resolve => setTimeout(resolve, 60000));

    await db.ref(`/stage/queue/${uid}`).remove();
    await db.ref("/comments").remove();

    await db.ref("/stage").update({
      status: "intermission",
      currentSpeaker: null,
    });

    await new Promise(resolve => setTimeout(resolve, 15000));

    const nextSnap = await db.ref("/stage/queue").get();
    const nextQueue = nextSnap.val() || {};
    if (Object.keys(nextQueue).length === 0) {
      await db.ref("/stage/status").set("idle");
    } else {
      const nextList = Object.entries(nextQueue).sort((a, b) => a[1].joinedAt - b[1].joinedAt);
      const [nextUid, nextSpeaker] = nextList[0];
      await db.ref("/stage").update({
        status: "countdown",
        currentSpeaker: { id: nextUid, heroName: nextSpeaker.heroName, startedAt: Date.now() },
        niceCount: 0,
      });
      await new Promise(resolve => setTimeout(resolve, 4000));
      await db.ref("/stage/status").set("live");
    }
  }
);

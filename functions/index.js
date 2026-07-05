const { onValueWritten } = require("firebase-functions/v2/database");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getDatabase } = require("firebase-admin/database");

initializeApp();

const DB_URL = "https://guchihero-ea8f7-default-rtdb.asia-southeast1.firebasedatabase.app";

// 待機列に変化があったらステージを制御する
exports.stageController = onValueWritten(
  { ref: "/stage/queue", region: "asia-southeast1" },
  async (event) => {
    const db = getDatabase();
    const stageSnap = await db.ref("/stage").get();
    const stage = stageSnap.val() || {};

    // すでに発表中なら何もしない
    if (stage.status === "live" || stage.status === "countdown") return;

    const queue = stage.queue || {};
    const queueList = Object.entries(queue).sort((a, b) => a[1].joinedAt - b[1].joinedAt);

    if (queueList.length === 0) {
      // 待機列が空になったらidleに
      await db.ref("/stage").update({ status: "idle", currentSpeaker: null, niceCount: 0 });
      return;
    }

    // 先頭の人を発表者に
    const [uid, speaker] = queueList[0];

    await db.ref("/stage").update({
      status: "countdown",
      currentSpeaker: { id: uid, heroName: speaker.heroName, startedAt: Date.now() },
      niceCount: 0,
    });

    // 4秒後（3→2→1→披露）にliveへ
    await new Promise(resolve => setTimeout(resolve, 4000));
    await db.ref("/stage/status").set("live");

    // 60秒後に終了処理
    await new Promise(resolve => setTimeout(resolve, 60000));

    // 発表者を待機列から削除
    await db.ref(`/stage/queue/${uid}`).remove();

    // コメントをクリア
    await db.ref("/comments").remove();

    // intermissionへ
    await db.ref("/stage").update({
      status: "intermission",
      currentSpeaker: null,
    });

    // 広告表示時間（15秒）
    await new Promise(resolve => setTimeout(resolve, 15000));

    // 次の人がいればcountdownへ、いなければidle
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

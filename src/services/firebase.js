// src/services/firebase.js
import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database';

const firebaseConfig = {
  apiKey: "AIzaSyCRQwM6gRMGHHIo4KwUNxStV52mEPm56_c",
authDomain: "guchihero-ea8f7.firebaseapp.com",
databaseURL: "https://guchihero-ea8f7-default-rtdb.asia-southeast1.firebasedatabase.app",
projectId: "guchihero-ea8f7",
storageBucket: "guchihero-ea8f7.firebasestorage.app",
messagingSenderId: "602629666937",
appId: "1:602629666937:web:ea821f8f9cbf276af27ca8"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const db = getDatabase(app);

// Web Push通知（App.js側）で、同じ初期化済みappを再利用するために公開する
export { app };

export const generateHeroName = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `匿名ヒーロー #${num}`;
};

export const subscribeStage = (callback) => {
  const stageRef = ref(db, 'stage');
  return onValue(stageRef, (snap) => callback(snap.val()));
};

// コメントは10分以上経過したらDBから削除（壁書きと同様、クライアント側で掃除する方式）
const COMMENT_EXPIRE_MS = 10 * 60 * 1000;

export const subscribeComments = (callback) => {
  const commentsRef = ref(db, 'comments');
  // 購読開始より前のコメントは表示しない（リロード時に過去分が一斉に流れるのを防ぐ）
  const startTime = Date.now();
  return onValue(commentsRef, (snap) => {
    const data = snap.val();
    if (!data) return callback([]);

    const now = Date.now();
    const list = Object.values(data)
      .filter((c) => c.createdAt >= startTime)
      .sort((a, b) => a.createdAt - b.createdAt)
      .slice(-50);
    callback(list);

    // 古いコメントをDBから削除
    Object.entries(data).forEach(([id, v]) => {
      if (now - v.createdAt >= COMMENT_EXPIRE_MS) {
        remove(ref(db, `comments/${id}`));
      }
    });
  });
};

export const sendComment = async (text) => {
  await push(ref(db, 'comments'), { text, createdAt: Date.now() });
};

export const joinQueue = async (heroName, fcmToken) => {
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const data = { heroName, joinedAt: Date.now() };
  // 通知トークンが取得できていれば一緒に保存する（無い場合は通知をスキップするだけで支障はない）
  if (fcmToken) data.fcmToken = fcmToken;
  await set(ref(db, `stage/queue/${uid}`), data);
  return uid;
};

export const leaveQueue = async (uid) => {
  await remove(ref(db, `stage/queue/${uid}`));
};

// 「確認待ち」状態の本人が「タップしてスタート」を押した時に呼ぶ。
// 本番のカウントダウンを開始する実際の時刻(startedAt)は、ここで初めて確定する。
export const confirmMyTurn = async () => {
  await update(ref(db), {
    'stage/status': 'countdown',
    'stage/currentSpeaker/startedAt': Date.now(),
  });
};

// ナイス送信（1セッション1回制限はクライアント側で管理）
export const sendNice = async (speakerId) => {
  const niceRef = ref(db, `stage/niceCount`);
  await runTransaction(niceRef, (current) => (current || 0) + 1);
};

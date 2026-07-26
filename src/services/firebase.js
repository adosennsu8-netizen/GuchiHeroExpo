// src/services/firebase.js
import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onValue, push, ref, remove, runTransaction, set, update } from 'firebase/database';
import { containsNgWord } from './ngWordFilter';

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

export { app };

export const generateHeroName = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `匿名ヒーロー #${num}`;
};

export const subscribeStage = (callback) => {
  const stageRef = ref(db, 'stage');
  return onValue(stageRef, (snap) => callback(snap.val()));
};

const COMMENT_EXPIRE_MS = 10 * 60 * 1000;

export const subscribeComments = (callback) => {
  const commentsRef = ref(db, 'comments');
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

    Object.entries(data).forEach(([id, v]) => {
      if (now - v.createdAt >= COMMENT_EXPIRE_MS) {
        remove(ref(db, `comments/${id}`));
      }
    });
  });
};

export const sendComment = async (text) => {
  if (containsNgWord(text)) {
    const error = new Error('NG_WORD_DETECTED');
    error.code = 'NG_WORD_DETECTED';
    throw error;
  }
  await push(ref(db, 'comments'), { text, createdAt: Date.now() });
};

export const joinQueue = async (heroName, fcmToken) => {
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const data = { heroName, joinedAt: Date.now() };
  if (fcmToken) data.fcmToken = fcmToken;
  await set(ref(db, `stage/queue/${uid}`), data);
  return uid;
};

export const leaveQueue = async (uid) => {
  await remove(ref(db, `stage/queue/${uid}`));
};

export const confirmMyTurn = async () => {
  await update(ref(db), {
    'stage/status': 'countdown',
    'stage/currentSpeaker/startedAt': Date.now(),
  });
};

export const sendNice = async (speakerId) => {
  const niceRef = ref(db, `stage/niceCount`);
  await runTransaction(niceRef, (current) => (current || 0) + 1);
};

const WALL_REPORT_THRESHOLD = 3;

export const reportWallPost = async (postId) => {
  const reportRef = ref(db, `wall/${postId}/reportCount`);
  const result = await runTransaction(reportRef, (current) => (current || 0) + 1);

  if (result.committed && (result.snapshot.val() || 0) >= WALL_REPORT_THRESHOLD) {
    await remove(ref(db, `wall/${postId}`));
    return { removed: true };
  }
  return { removed: false };
};

// 壁書きへの投稿。sendCommentと同じ方針でNGワードを事前に弾く。
export const postToWall = async (text, color, angle) => {
  if (containsNgWord(text)) {
    const error = new Error('NG_WORD_DETECTED');
    error.code = 'NG_WORD_DETECTED';
    throw error;
  }
  await push(ref(db, 'wall'), { text, color, angle, createdAt: Date.now() });
};
// src/services/firebase.js
import { getApps, initializeApp } from 'firebase/app';
import { getDatabase, onValue, push, ref, remove, runTransaction, set } from 'firebase/database';

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

export const generateHeroName = () => {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `匿名ヒーロー #${num}`;
};

export const subscribeStage = (callback) => {
  const stageRef = ref(db, 'stage');
  return onValue(stageRef, (snap) => callback(snap.val()));
};

export const subscribeComments = (callback) => {
  const commentsRef = ref(db, 'comments');
  return onValue(commentsRef, (snap) => {
    const data = snap.val();
    if (!data) return callback([]);
    const list = Object.values(data).sort((a, b) => a.createdAt - b.createdAt).slice(-50);
    callback(list);
  });
};

export const sendComment = async (text) => {
  await push(ref(db, 'comments'), { text, createdAt: Date.now() });
};

export const joinQueue = async (heroName) => {
  const uid = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
  await set(ref(db, `stage/queue/${uid}`), { heroName, joinedAt: Date.now() });
  return uid;
};

export const leaveQueue = async (uid) => {
  await remove(ref(db, `stage/queue/${uid}`));
};

// ナイス送信（1セッション1回制限はクライアント側で管理）
export const sendNice = async (speakerId) => {
  const niceRef = ref(db, `stage/niceCount`);
  await runTransaction(niceRef, (current) => (current || 0) + 1);
};

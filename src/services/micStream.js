// src/services/micStream.js
// 立候補ボタンを押した瞬間にマイク許可を先取りし、発表開始まで使い回すためのモジュール。
let cachedStream = null;
let requestPromise = null;

export async function requestMicPermission() {
  if (cachedStream && cachedStream.active) return cachedStream;
  if (requestPromise) return requestPromise;

  requestPromise = navigator.mediaDevices
    .getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } })
    .then((stream) => {
      cachedStream = stream;
      requestPromise = null;
      return stream;
    })
    .catch((e) => {
      requestPromise = null;
      throw e;
    });

  return requestPromise;
}

export function getCachedMicStream() {
  return cachedStream && cachedStream.active ? cachedStream : null;
}

export function releaseMicStream() {
  if (cachedStream) {
    cachedStream.getTracks().forEach((t) => t.stop());
  }
  cachedStream = null;
  requestPromise = null;
}
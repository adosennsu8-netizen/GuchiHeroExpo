// src/services/myQueueId.js
// 「今の自分は、キューの中でどの項目に該当するか(uid)」を、
// どの画面にいてもApp.js側から参照できるようにするための保管場所。

let currentUid = null;

export function setMyQueueId(uid) {
  currentUid = uid;
}

export function getMyQueueId() {
  return currentUid;
}

export function clearMyQueueId() {
  currentUid = null;
}

// src/services/myQueueId.js
// 「今の自分は、キューの中でどの項目に該当するか(uid)」を、
// どの画面にいてもApp.js側から参照できるようにするための保管場所。
//
// 通知をタップした際にページが再読み込みされたり、新しいタブで開き直されたりすると
// メモリ上の値は消えてしまうため、Web版ではlocalStorageに保存して再読み込み後も
// 復元できるようにする。

const STORAGE_KEY = 'guchihero_my_queue_id';
let memoryUid = null;

function hasLocalStorage() {
  try {
    return typeof localStorage !== 'undefined';
  } catch (e) {
    return false;
  }
}

export function setMyQueueId(uid) {
  memoryUid = uid;
  if (hasLocalStorage()) {
    try {
      localStorage.setItem(STORAGE_KEY, uid);
    } catch (e) {
      // 保存できなくても致命的ではないため無視する
    }
  }
}

export function getMyQueueId() {
  if (hasLocalStorage()) {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) return stored;
    } catch (e) {
      // 読み取れない場合はメモリ上の値にフォールバック
    }
  }
  return memoryUid;
}

export function clearMyQueueId() {
  memoryUid = null;
  if (hasLocalStorage()) {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // 無視する
    }
  }
}

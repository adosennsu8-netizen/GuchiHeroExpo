// src/services/pushToken.js
// App.js起動時に取得した自分の通知トークンを、他の画面（VoiceSelectScreen等）からも
// 参照できるようにするための、シンプルなモジュールレベルの保管場所。

let currentToken = null;

export function setPushToken(token) {
  currentToken = token;
}

export function getPushToken() {
  return currentToken;
}

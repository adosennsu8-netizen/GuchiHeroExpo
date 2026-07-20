importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyCRQwM6gRMGHHIo4KwUNxStV52mEPm56_c",
  authDomain: "guchihero-ea8f7.firebaseapp.com",
  databaseURL: "https://guchihero-ea8f7-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "guchihero-ea8f7",
  storageBucket: "guchihero-ea8f7.firebasestorage.app",
  messagingSenderId: "602629666937",
  appId: "1:602629666937:web:ea821f8f9cbf276af27ca8"
});

const messaging = firebase.messaging();

// アプリがバックグラウンド（他のタブ・画面オフ）の時に通知を受け取った際の表示
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || '愚痴HERO';
  const body = payload.notification?.body || '';
  self.registration.showNotification(title, {
    body,
    icon: '/icons/icon-512.png',
  });
});

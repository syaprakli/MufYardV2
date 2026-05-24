importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// Firebase config values will be injected or used from env during build
// For local dev, we use the same config as the app
firebase.initializeApp({
  apiKey: "AIzaSy...", // These should match your src/lib/firebase.ts
  authDomain: "mufyardv2.firebaseapp.com",
  projectId: "mufyardv2",
  storageBucket: "mufyardv2.appspot.com",
  messagingSenderId: "305139268310",
  appId: "1:305139268310:web:..."
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCGYnBJ-B9OOooRDJyTpxqkkQHNVzJ0oKA",
  authDomain: "hangout-sunday.firebaseapp.com",
  databaseURL: "https://hangout-sunday-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "hangout-sunday",
  storageBucket: "hangout-sunday.firebasestorage.app",
  messagingSenderId: "148308152832",
  appId: "1:148308152832:web:b36b2b3045b6543d357ee5",
  measurementId: "G-T3RG69PL1L"
};
export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);

signInAnonymously(auth);

auth.onAuthStateChanged(user => {
  if (user) {
    playerId = user.uid;
    initMultiplayer();
  }
});

function initMultiplayer() {
  const playerRef = ref(db, `players/${playerId}`);

  // Remove player on disconnect
  onDisconnect(playerRef).remove();

  // Listen for all players
  onValue(ref(db, "players"), snapshot => {
    const data = snapshot.val() || {};
    otherPlayers = data;
  });
    }

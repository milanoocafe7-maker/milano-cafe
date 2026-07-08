// MILANO CAFE - Firebase Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration placeholder
// REPLACE this object with your actual Firebase project config credentials
const firebaseConfig = {
    apiKey: "AIzaSyCXPxD3YAma3qOebb0KByQIDd_7UqJoT8s",
    authDomain: "milano-cafe-3f797.firebaseapp.com",
    projectId: "milano-cafe-3f797",
    storageBucket: "milano-cafe-3f797.firebasestorage.app",
    messagingSenderId: "568995903538",
    appId: "1:568995903538:web:96e94661125d67ed14a42b"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };


import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBSF1-iJMEdqOrIt7bxSxkp4LdifEo1DDM",
    authDomain: "track-dice.firebaseapp.com",
    projectId: "track-dice",
    storageBucket: "track-dice.firebasestorage.app",
    messagingSenderId: "49690414383",
    appId: "1:49690414383:web:6a235fb1c93470462ce5da",
    measurementId: "G-B3B9W2MVL4"
};

// Initialize Firebase services
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Share database instance globally for other legacy scripts if needed
window.db = db;
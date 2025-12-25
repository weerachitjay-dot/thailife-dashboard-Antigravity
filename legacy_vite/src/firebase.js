
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyBUOwD5n5tRF7jir7VkbCUKBfX_F3aykGQ",
    authDomain: "thailife-ac477.firebaseapp.com",
    projectId: "thailife-ac477",
    storageBucket: "thailife-ac477.firebasestorage.app",
    messagingSenderId: "823401698586",
    appId: "1:823401698586:web:d488059ec7c5bfa6c5c8a3"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };

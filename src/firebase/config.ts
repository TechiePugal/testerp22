import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDicQksIDusUdMK7k2fIt2cvxyCY8yZg3c",
  authDomain: "erpv02.firebaseapp.com",
  projectId: "erpv02",
  storageBucket: "erpv02.firebasestorage.app",
  messagingSenderId: "453487579197",
  appId: "1:453487579197:web:255e8fb9745dc61e7c9a54",
  measurementId: "G-VP7GPT0J7J"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;
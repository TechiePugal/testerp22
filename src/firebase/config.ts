import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";

const firebaseConfig = {
  apiKey: "AIzaSyDSHZAKsRFrHer7lno6Rknr3w5j-xVglVc",
  authDomain: "employeemanagement-16dba.firebaseapp.com",
  projectId: "employeemanagement-16dba",
  storageBucket: "employeemanagement-16dba.firebasestorage.app",
  messagingSenderId: "723276151197",
  appId: "1:723276151197:web:5df89d54869fc42dd4d774",
  measurementId: "G-BT1YLST16T"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;
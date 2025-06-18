// firebase.ts
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: 'AIzaSyDicQksIDusUdMK7k2fIt2cvxyCY8yZg3c',
  authDomain: 'erpv02.firebaseapp.com',
  projectId: 'erpv02',
  storageBucket: 'erpv02.appspot.com',
  messagingSenderId: '453487579197',
  appId: '1:453487579197:web:255e8fb9745dc61e7c9a54',
  measurementId: 'G-VP7GPT0J7J',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app); // 👈 Add this
export default app;

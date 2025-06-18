// ✅ AutoCreateSuperAdmin.tsx
import { useEffect } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

const superAdminEmail = 'pugalpugalee333@gmail.com';
const superAdminPassword = 'Pugal@2025';

const AutoCreateSuperAdmin = () => {
  useEffect(() => {
    const createSuperAdmin = async () => {
      try {
        await signInWithEmailAndPassword(auth, superAdminEmail, superAdminPassword);
        const user = auth.currentUser;
        if (!user) return;

        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
          await setDoc(userDocRef, {
            uid: user.uid,
            email: superAdminEmail,
            role: 'admin',
            createdAt: new Date(),
          });
        }
      } catch (signInError) {
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, superAdminEmail, superAdminPassword);
          const user = userCredential.user;
          await setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: superAdminEmail,
            role: 'admin',
            createdAt: new Date(),
          });
        } catch (createError) {
          console.error('❌ Super Admin creation failed:', createError);
        }
      }
    };

    createSuperAdmin();
  }, []);

  return null;
};

export default AutoCreateSuperAdmin;
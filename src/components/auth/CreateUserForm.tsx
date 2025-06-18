// src/components/CreateUserForm.tsx
import React, { useState, useEffect } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, db } from '../../firebase/config';
import { doc, setDoc } from 'firebase/firestore';

const SUPER_ADMIN_UID = "4TZLi9yjWaNNOijI7mc5QIEsxd92"; // You must replace this with the UID of pugalpugalee333@gmail.com

const CreateUserForm: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    const currentUser = auth.currentUser;
    if (currentUser && currentUser.uid === SUPER_ADMIN_UID) {
      setIsAuthorized(true);
    } else {
      setIsAuthorized(false);
    }
  }, [auth.currentUser]);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');

    const currentUser = auth.currentUser;
    if (!currentUser || currentUser.uid !== SUPER_ADMIN_UID) {
      setMessage('❌ Only the super user is allowed to create accounts.');
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        email: user.email,
        createdAt: new Date(),
        role: 'employee',
      });

      setMessage('✅ User created and stored in DB!');
      setEmail('');
      setPassword('');
    } catch (error: any) {
      setMessage(`❌ ${error.message}`);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="p-6 max-w-md mx-auto bg-white rounded shadow text-center text-red-500">
        ❌ Access Denied: Only super user can create new accounts.
      </div>
    );
  }

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded shadow">
      <h2 className="text-xl font-bold mb-4">Create New User (Admin Only)</h2>
      <form onSubmit={handleCreateUser} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          className="w-full px-4 py-2 border rounded"
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          className="w-full px-4 py-2 border rounded"
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit" className="bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700">
          Create User
        </button>
        {message && <div className="text-sm mt-2 text-red-500">{message}</div>}
      </form>
    </div>
  );
};

export default CreateUserForm;

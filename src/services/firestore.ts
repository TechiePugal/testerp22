import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  where,
  Timestamp,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase/config';
import type {
  Company,
  Unit,
  Group,
  Shift,
  Holiday,
  Employee,
  ShiftAssignment,
  Attendance,
  Allowance
} from '../types';

// Helper function to safely convert Firestore timestamps to dates
const convertFirestoreTimestampToDate = (value: any): Date | null => {
  if (!value) return null;
  if (value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  if (value instanceof Date) {
    return value;
  }
  return null;
};

// Generic CRUD operations
export const createDocument = async (collectionName: string, data: any) => {
  const docRef = await addDoc(collection(db, collectionName), {
    ...data,
    createdAt: Timestamp.now()
  });
  return docRef.id;
};

export const updateDocument = async (collectionName: string, id: string, data: any) => {
  const docRef = doc(db, collectionName, id);
  await updateDoc(docRef, data);
};

export const deleteDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  await deleteDoc(docRef);
};

export const getDocuments = async (collectionName: string, orderByField = 'createdAt') => {
  const q = query(collection(db, collectionName), orderBy(orderByField));
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: convertFirestoreTimestampToDate(doc.data().createdAt),
    date: convertFirestoreTimestampToDate(doc.data().date),
    dob: convertFirestoreTimestampToDate(doc.data().dob),
    dateOfJoining: convertFirestoreTimestampToDate(doc.data().dateOfJoining),
    weekStartDate: convertFirestoreTimestampToDate(doc.data().weekStartDate),
    weekEndDate: convertFirestoreTimestampToDate(doc.data().weekEndDate)
  }));
};

export const getDocument = async (collectionName: string, id: string) => {
  const docRef = doc(db, collectionName, id);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return {
      id: docSnap.id,
      ...docSnap.data(),
      createdAt: convertFirestoreTimestampToDate(docSnap.data().createdAt),
      date: convertFirestoreTimestampToDate(docSnap.data().date),
      dob: convertFirestoreTimestampToDate(docSnap.data().dob),
      dateOfJoining: convertFirestoreTimestampToDate(docSnap.data().dateOfJoining)
    };
  }
  return null;
};

export const getDocumentsWhere = async (
  collectionName: string,
  field: string,
  operator: any,
  value: any,
  orderByField = 'createdAt'
) => {
  const q = query(
    collection(db, collectionName),
    where(field, operator, value),
    orderBy(orderByField)
  );
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: convertFirestoreTimestampToDate(doc.data().createdAt),
    date: convertFirestoreTimestampToDate(doc.data().date),
    dob: convertFirestoreTimestampToDate(doc.data().dob),
    dateOfJoining: convertFirestoreTimestampToDate(doc.data().dateOfJoining),
    weekStartDate: convertFirestoreTimestampToDate(doc.data().weekStartDate),
    weekEndDate: convertFirestoreTimestampToDate(doc.data().weekEndDate)
  }));
};

// Real-time listeners
export const subscribeToCollection = (
  collectionName: string,
  callback: (data: any[]) => void,
  orderByField = 'createdAt'
) => {
  const q = query(collection(db, collectionName), orderBy(orderByField));
  return onSnapshot(q, (querySnapshot) => {
    const data = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: convertFirestoreTimestampToDate(doc.data().createdAt),
      date: convertFirestoreTimestampToDate(doc.data().date),
      dob: convertFirestoreTimestampToDate(doc.data().dob),
      dateOfJoining: convertFirestoreTimestampToDate(doc.data().dateOfJoining),
      weekStartDate: convertFirestoreTimestampToDate(doc.data().weekStartDate),
      weekEndDate: convertFirestoreTimestampToDate(doc.data().weekEndDate)
    }));
    callback(data);
  });
};

// Specific helper functions
export const getAttendanceByDate = async (date: Date) => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  const q = query(
    collection(db, 'attendance'),
    where('date', '>=', Timestamp.fromDate(startOfDay)),
    where('date', '<=', Timestamp.fromDate(endOfDay))
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: convertFirestoreTimestampToDate(doc.data().date),
    createdAt: convertFirestoreTimestampToDate(doc.data().createdAt)
  }));
};

export const getAttendanceByDateRange = async (startDate: Date, endDate: Date) => {
  const q = query(
    collection(db, 'attendance'),
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(endDate)),
    orderBy('date', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: convertFirestoreTimestampToDate(doc.data().date),
    createdAt: convertFirestoreTimestampToDate(doc.data().createdAt)
  }));
};

export const getAllowancesByDateRange = async (startDate: Date, endDate: Date) => {
  const q = query(
    collection(db, 'allowances'),
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(endDate)),
    orderBy('date', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: convertFirestoreTimestampToDate(doc.data().date),
    createdAt: convertFirestoreTimestampToDate(doc.data().createdAt)
  }));
};

// Monthly attendance helper
export const getAttendanceByMonth = async (year: number, month: number) => {
  const startDate = new Date(year, month, 1);
  const endDate = new Date(year, month + 1, 0);
  
  const q = query(
    collection(db, 'attendance'),
    where('date', '>=', Timestamp.fromDate(startDate)),
    where('date', '<=', Timestamp.fromDate(endDate)),
    orderBy('date', 'desc')
  );
  
  const querySnapshot = await getDocs(q);
  return querySnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    date: convertFirestoreTimestampToDate(doc.data().date),
    createdAt: convertFirestoreTimestampToDate(doc.data().createdAt)
  }));
};
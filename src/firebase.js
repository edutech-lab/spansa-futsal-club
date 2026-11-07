import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { FIREBASE_CONFIG } from './config.js';

export const firebaseReady = !!(FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.appId);
const app = initializeApp(firebaseReady ? FIREBASE_CONFIG : { apiKey: 'x', projectId: 'x', appId: 'x' });
export const auth = getAuth(app);
export const db = getFirestore(app);

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getAnalytics, Analytics, isSupported } from 'firebase/analytics';

// Configuración de tu proyecto Firebase
const firebaseConfig = {
  apiKey: 'AIzaSyDs24ci0yfB_7mn2YwOuUssYnlCHYb70kc',
  authDomain: 'fitflow-motoriaverse.firebaseapp.com',
  projectId: 'fitflow-motoriaverse',
  storageBucket: 'fitflow-motoriaverse.firebasestorage.app',
  messagingSenderId: '928868755426',
  appId: '1:928868755426:web:7ed5e23b9d61f16936bbbb',
  measurementId: 'G-TW3G2DX6NH',
};

// Inicializar Firebase solo una vez
let app: FirebaseApp;
let db: Firestore;
let auth: Auth;
let analytics: Analytics | null = null;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
} else {
  app = getApps()[0];
  db = getFirestore(app);
  auth = getAuth(app);
}

// Analytics solo funciona en web y cuando el entorno lo soporta.
if (typeof window !== 'undefined') {
  void isSupported().then((supported) => {
    if (supported) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, db, auth, analytics };

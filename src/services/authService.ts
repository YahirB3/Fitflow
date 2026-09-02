import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithCredential,
  signInWithPopup,
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
  updateProfile,
  setPersistence,
  browserLocalPersistence,
} from 'firebase/auth';
import { auth, db } from '../config/firebase.config';
import { ensureUserProfile, saveUserProfile } from './firebaseService';
import { UserProfile } from '../types/user';

export const registerUser = async (
  email: string,
  password: string,
  name: string
): Promise<UserProfile> => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    // Update auth profile
    await updateProfile(user, { displayName: name });

    // Create user profile in Firestore
    const profile: UserProfile = {
      id: user.uid,
      name,
      email,
      role: 'user',
      level: 'Principiante',
      goals: [],
      equipment: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveUserProfile(profile);
    return profile;
  } catch (error: any) {
    console.error('Registration error:', error.message);
    throw error;
  }
};

export const loginUser = async (email: string, password: string): Promise<User> => {
  try {
    // Enable persistence (remember login)
    await setPersistence(auth, browserLocalPersistence).catch(() => {
      // Si falla en mobile, solo continúa sin persistencia
    });

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await ensureUserProfile(userCredential.user);
    return userCredential.user;
  } catch (error: any) {
    console.error('Login error:', error.message);
    throw error;
  }
};

export const resetUserPassword = async (email: string): Promise<void> => {
  await sendPasswordResetEmail(auth, email);
};

export const loginWithGoogleWeb = async (): Promise<User> => {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const userCredential = await signInWithPopup(auth, provider);
  await ensureUserProfile(userCredential.user);
  return userCredential.user;
};

export const loginWithGoogleIdToken = async (idToken: string): Promise<User> => {
  const credential = GoogleAuthProvider.credential(idToken);
  const userCredential = await signInWithCredential(auth, credential);
  await ensureUserProfile(userCredential.user);
  return userCredential.user;
};

export const logoutUser = async (): Promise<void> => {
  try {
    await firebaseSignOut(auth);
  } catch (error: any) {
    console.error('Logout error:', error.message);
    throw error;
  }
};

export const getCurrentUser = (): User | null => {
  return auth.currentUser;
};

export const onAuthStateChange = (callback: (user: User | null) => void) => {
  return onAuthStateChanged(auth, callback);
};

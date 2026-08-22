import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  where,
  Timestamp,
  WriteBatch,
  writeBatch,
} from 'firebase/firestore';
import { db, auth } from '../config/firebase.config';
import {
  UserProfile,
  TrainerAssignment,
  RoutineAssignment,
  RoutineTemplate,
} from '../types/user';
import { RoutineDay } from '../types/workout';

const COLLECTIONS = {
  users: 'users',
  trainerAssignments: 'trainerAssignments',
  routineAssignments: 'routineAssignments',
  routineTemplates: 'routineTemplates',
};

// ============ USER PROFILE ============
export const loadUserProfile = async (userId?: string): Promise<UserProfile | null> => {
  try {
    const uid = userId || auth.currentUser?.uid || 'local-user';
    const userRef = doc(db, COLLECTIONS.users, uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return userSnap.data() as UserProfile;
    }
    return null;
  } catch (error) {
    console.error('Error loading user profile:', error);
    return null;
  }
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  try {
    const uid = profile.id || auth.currentUser?.uid || 'local-user';
    const userRef = doc(db, COLLECTIONS.users, uid);
    await setDoc(
      userRef,
      {
        ...profile,
        updatedAt: Timestamp.now().toDate().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error('Error saving user profile:', error);
  }
};

// ============ TRAINER ASSIGNMENTS ============
export const loadTrainerAssignments = async (userId?: string): Promise<TrainerAssignment[]> => {
  try {
    const uid = userId || auth.currentUser?.uid || 'local-user';
    const q = query(
      collection(db, COLLECTIONS.trainerAssignments),
      where('clientId', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) => d.data() as TrainerAssignment);
  } catch (error) {
    console.error('Error loading trainer assignments:', error);
    return [];
  }
};

export const createTrainerAssignment = async (
  trainerId: string,
  clientId: string
): Promise<TrainerAssignment> => {
  try {
    const assignment: TrainerAssignment = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      trainerId,
      clientId,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = doc(db, COLLECTIONS.trainerAssignments, assignment.id);
    await setDoc(ref, assignment);
    return assignment;
  } catch (error) {
    console.error('Error creating trainer assignment:', error);
    throw error;
  }
};

export const updateTrainerAssignment = async (
  assignmentId: string,
  updates: Partial<TrainerAssignment>
): Promise<void> => {
  try {
    const ref = doc(db, COLLECTIONS.trainerAssignments, assignmentId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: Timestamp.now().toDate().toISOString(),
    });
  } catch (error) {
    console.error('Error updating trainer assignment:', error);
  }
};

export const removeTrainerAssignment = async (assignmentId: string): Promise<void> => {
  try {
    const ref = doc(db, COLLECTIONS.trainerAssignments, assignmentId);
    await deleteDoc(ref);
  } catch (error) {
    console.error('Error removing trainer assignment:', error);
  }
};

// ============ ROUTINE ASSIGNMENTS ============
export const loadRoutineAssignments = async (userId?: string): Promise<RoutineAssignment[]> => {
  try {
    const uid = userId || auth.currentUser?.uid || 'local-user';
    const q = query(
      collection(db, COLLECTIONS.routineAssignments),
      where('clientId', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) => d.data() as RoutineAssignment);
  } catch (error) {
    console.error('Error loading routine assignments:', error);
    return [];
  }
};

export const saveRoutineAssignments = async (
  assignments: RoutineAssignment[]
): Promise<void> => {
  try {
    const batch = writeBatch(db);
    assignments.forEach((assignment) => {
      const ref = doc(db, COLLECTIONS.routineAssignments, assignment.id);
      batch.set(ref, assignment, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error saving routine assignments:', error);
  }
};

export const createRoutineAssignment = async (
  trainerId: string,
  clientId: string,
  title: string,
  routine: RoutineDay[],
  templateId?: string
): Promise<RoutineAssignment> => {
  try {
    // End previous active assignments
    const existingQ = query(
      collection(db, COLLECTIONS.routineAssignments),
      where('clientId', '==', clientId),
      where('status', '==', 'active')
    );
    const existing = await getDocs(existingQ);
    const batch = writeBatch(db);

    existing.docs.forEach((d) => {
      batch.update(d.ref, { status: 'inactive' });
    });

    const assignment: RoutineAssignment = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      routineId: '',
      templateId,
      trainerId,
      clientId,
      title,
      routine,
      status: 'active',
      assignedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = doc(db, COLLECTIONS.routineAssignments, assignment.id);
    batch.set(ref, assignment);
    await batch.commit();
    return assignment;
  } catch (error) {
    console.error('Error creating routine assignment:', error);
    throw error;
  }
};

export const removeRoutineAssignment = async (assignmentId: string): Promise<void> => {
  try {
    const ref = doc(db, COLLECTIONS.routineAssignments, assignmentId);
    await deleteDoc(ref);
  } catch (error) {
    console.error('Error removing routine assignment:', error);
  }
};

// ============ ROUTINE TEMPLATES ============
export const loadRoutineTemplates = async (userId?: string): Promise<RoutineTemplate[]> => {
  try {
    const uid = userId || auth.currentUser?.uid || 'local-user';
    const q = query(
      collection(db, COLLECTIONS.routineTemplates),
      where('ownerId', '==', uid)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) => d.data() as RoutineTemplate);
  } catch (error) {
    console.error('Error loading routine templates:', error);
    return [];
  }
};

export const saveRoutineTemplates = async (templates: RoutineTemplate[]): Promise<void> => {
  try {
    const batch = writeBatch(db);
    templates.forEach((template) => {
      const ref = doc(db, COLLECTIONS.routineTemplates, template.id);
      batch.set(ref, template, { merge: true });
    });
    await batch.commit();
  } catch (error) {
    console.error('Error saving routine templates:', error);
  }
};

export const createRoutineTemplate = async (
  ownerId: string,
  title: string,
  routine: RoutineDay[],
  ownerRole: 'user' | 'trainer' = 'trainer'
): Promise<RoutineTemplate> => {
  try {
    const template: RoutineTemplate = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ownerId,
      ownerRole,
      title,
      routine,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const ref = doc(db, COLLECTIONS.routineTemplates, template.id);
    await setDoc(ref, template);
    return template;
  } catch (error) {
    console.error('Error creating routine template:', error);
    throw error;
  }
};

export const removeRoutineTemplate = async (templateId: string): Promise<void> => {
  try {
    const ref = doc(db, COLLECTIONS.routineTemplates, templateId);
    await deleteDoc(ref);
  } catch (error) {
    console.error('Error removing routine template:', error);
  }
};

export const updateRoutineTemplate = async (
  templateId: string,
  updates: Partial<RoutineTemplate>
): Promise<void> => {
  try {
    const ref = doc(db, COLLECTIONS.routineTemplates, templateId);
    await updateDoc(ref, {
      ...updates,
      updatedAt: Timestamp.now().toDate().toISOString(),
    });
  } catch (error) {
    console.error('Error updating routine template:', error);
  }
};

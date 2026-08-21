import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseProgress, RoutineDay, WeeklySummary } from '../types/workout';
import type {
  AssignmentStatus,
  RoutineAssignment,
  RoutineAssignmentStatus,
  RoutineOwnerRole,
  RoutineTemplate,
  TrainerAssignment,
} from '../types/user';

type ProgressState = {
  weekKey: string;
  progress: Record<string, ExerciseProgress>;
};

const STORAGE_KEYS = {
  progress: 'gymflow-progress-v1',
  history: 'gymflow-history-v1',
  routine: 'gymflow-routine-v1',
  trainerAssignments: 'gymflow-trainer-assignments-v1',
  routineAssignments: 'gymflow-routine-assignments-v1',
  routineTemplates: 'gymflow-routine-templates-v1',
} as const;

export const loadProgressState = async (): Promise<ProgressState | null> => {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.progress);
  if (!saved) return null;

  const parsed = JSON.parse(saved) as Partial<ProgressState>;
  return {
    weekKey: parsed.weekKey ?? '',
    progress: parsed.progress ?? {},
  };
};

export const saveProgressState = async (state: ProgressState) => {
  await AsyncStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(state));
};

export const loadHistory = async (): Promise<WeeklySummary[]> => {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.history);
  if (!saved) return [];
  return JSON.parse(saved) as WeeklySummary[];
};

export const saveHistory = async (history: WeeklySummary[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.history, JSON.stringify(history));
};

export const loadCustomRoutine = async (): Promise<RoutineDay[] | null> => {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.routine);
  if (!saved) return null;
  return JSON.parse(saved) as RoutineDay[];
};

export const saveCustomRoutine = async (routine: RoutineDay[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.routine, JSON.stringify(routine));
};

export const removeCustomRoutine = async () => {
  await AsyncStorage.removeItem(STORAGE_KEYS.routine);
};

export const loadTrainerAssignments = async (): Promise<TrainerAssignment[]> => {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.trainerAssignments);
  if (!saved) return [];
  return JSON.parse(saved) as TrainerAssignment[];
};

export const saveTrainerAssignments = async (assignments: TrainerAssignment[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.trainerAssignments, JSON.stringify(assignments));
};

export const createTrainerAssignment = async (
  trainerId: string,
  clientId: string,
): Promise<TrainerAssignment> => {
  const assignments = await loadTrainerAssignments();
  const now = new Date().toISOString();
  const assignment: TrainerAssignment = {
    id: `assignment-${Date.now()}`,
    trainerId,
    clientId,
    status: 'pending',
    createdAt: now,
    updatedAt: now,
  };

  await saveTrainerAssignments([...assignments, assignment]);
  return assignment;
};

export const updateTrainerAssignmentStatus = async (
  assignmentId: string,
  status: AssignmentStatus,
): Promise<TrainerAssignment | null> => {
  const assignments = await loadTrainerAssignments();
  const assignment = assignments.find((item) => item.id === assignmentId);
  if (!assignment) return null;

  const updatedAssignment: TrainerAssignment = {
    ...assignment,
    status,
    updatedAt: new Date().toISOString(),
  };
  const updatedAssignments = assignments.map((item) => (
    item.id === assignmentId ? updatedAssignment : item
  ));

  await saveTrainerAssignments(updatedAssignments);
  return updatedAssignment;
};

export const loadRoutineAssignments = async (): Promise<RoutineAssignment[]> => {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.routineAssignments);
  if (!saved) return [];
  return JSON.parse(saved) as RoutineAssignment[];
};

export const saveRoutineAssignments = async (assignments: RoutineAssignment[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.routineAssignments, JSON.stringify(assignments));
};

export const removeRoutineAssignment = async (assignmentId: string) => {
  const assignments = await loadRoutineAssignments();
  await saveRoutineAssignments(assignments.filter((assignment) => assignment.id !== assignmentId));
};

export const createRoutineAssignment = async (
  trainerId: string,
  clientId: string,
  title: string,
  routine: RoutineDay[],
  templateId?: string,
): Promise<RoutineAssignment> => {
  const assignments = await loadRoutineAssignments();
  const now = new Date().toISOString();
  const assignment: RoutineAssignment = {
    id: `routine-assignment-${Date.now()}`,
    routineId: `routine-${Date.now()}`,
    templateId,
    trainerId,
    clientId,
    title,
    routine: JSON.parse(JSON.stringify(routine)) as RoutineDay[],
    status: 'active',
    assignedAt: now,
    updatedAt: now,
  };

  const nextAssignments = assignments.map((item) => (
    item.clientId === clientId && item.status === 'active'
      ? { ...item, status: 'replaced' as RoutineAssignmentStatus, updatedAt: now }
      : item
  ));
  await saveRoutineAssignments([...nextAssignments, assignment]);
  return assignment;
};

export const loadRoutineTemplates = async (): Promise<RoutineTemplate[]> => {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.routineTemplates);
  if (!saved) return [];
  const parsed = JSON.parse(saved) as Array<Partial<RoutineTemplate>>;
  return parsed.map((template) => ({
    ...template,
    ownerRole: template.ownerRole ?? 'trainer',
  })) as RoutineTemplate[];
};

export const saveRoutineTemplates = async (templates: RoutineTemplate[]) => {
  await AsyncStorage.setItem(STORAGE_KEYS.routineTemplates, JSON.stringify(templates));
};

export const removeRoutineTemplate = async (templateId: string) => {
  const templates = await loadRoutineTemplates();
  await saveRoutineTemplates(templates.filter((template) => template.id !== templateId));
};

export const createRoutineTemplate = async (
  ownerId: string,
  title: string,
  routine: RoutineDay[],
  ownerRole: RoutineOwnerRole = 'trainer',
): Promise<RoutineTemplate> => {
  const templates = await loadRoutineTemplates();
  const now = new Date().toISOString();
  const template: RoutineTemplate = {
    id: `routine-template-${Date.now()}`,
    ownerId,
    ownerRole,
    title,
    routine: JSON.parse(JSON.stringify(routine)) as RoutineDay[],
    createdAt: now,
    updatedAt: now,
  };

  await saveRoutineTemplates([...templates, template]);
  return template;
};

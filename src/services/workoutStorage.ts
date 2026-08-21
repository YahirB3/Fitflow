import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseProgress, RoutineDay, WeeklySummary } from '../types/workout';

type ProgressState = {
  weekKey: string;
  progress: Record<string, ExerciseProgress>;
};

const STORAGE_KEYS = {
  progress: 'gymflow-progress-v1',
  history: 'gymflow-history-v1',
  routine: 'gymflow-routine-v1',
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

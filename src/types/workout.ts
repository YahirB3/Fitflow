export type Intensity = 'Baja' | 'Media' | 'Alta' | 'Máxima';

export type Exercise = {
  name: string;
  sets: string;
  reps: string;
  note: string;
  image?: string | number;
};

export type RoutineDay = {
  day: string;
  title: string;
  exercises: Exercise[];
};

export type ExerciseProgress = {
  done: boolean;
  weights: string[];
};

export type WeeklySummary = {
  weekKey: string;
  label: string;
  completed: number;
  total: number;
};

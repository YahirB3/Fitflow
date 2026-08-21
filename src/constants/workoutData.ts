import type { Exercise, Intensity } from '../types/workout';

const exerciseImages = {
  benchPress: require('../../assets/images/bench_press.jpg'),
  dumbbellCurl: require('../../assets/images/dumbell_curl_dumbell.webp'),
  dumbbellLunge: require('../../assets/images/dumbbell_lunge.jpg'),
  inclineBenchPress: require('../../assets/images/incline_bench_press.jpg'),
  inclineDumbbellPress: require('../../assets/images/incline_bench_press_dumbell.jpg'),
  treadmill: require('../../assets/images/treadmill.jpg'),
};

export const getExerciseImage = (exerciseName: string): string | number | undefined => {
  const normalizedName = exerciseName.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (normalizedName.includes('curl') && normalizedName.includes('mancuern')) return exerciseImages.dumbbellCurl;
  if (normalizedName.includes('zancad')) return exerciseImages.dumbbellLunge;
  if (normalizedName.includes('press inclinado') && normalizedName.includes('mancuern')) return exerciseImages.inclineDumbbellPress;
  if (normalizedName.includes('press inclinado')) return exerciseImages.inclineBenchPress;
  if (normalizedName.includes('press de banca')) return exerciseImages.benchPress;
  if (normalizedName.includes('caminata') || normalizedName.includes('caminadora') || normalizedName.includes('cardio')) return exerciseImages.treadmill;

  return undefined;
};

export const equipmentList = [
  'Barra Olímpica',
  'Mancuernas',
  'Caminadora',
  'Banco',
  'Bandas',
  'Suelo / Colchonetas',
] as const;

export type EquipmentName = (typeof equipmentList)[number];

export const workoutLibrary: Record<EquipmentName, string[]> = {
  'Barra Olímpica': ['Sentadilla con barra', 'Peso muerto', 'Press de banca', 'Dominadas', 'Peso muerto rumano', 'Press militar', 'Carga de espalda'],
  Mancuernas: ['Press militar con mancuernas', 'Curl biceps alterno', 'Press inclinado', 'Zancadas con mancuernas', 'Elevaciones laterales', 'Fly de pecho', 'Peso muerto rumano con mancuernas'],
  Caminadora: ['Caminata inclinada', 'Intervalos en caminadora', 'Cardio HIIT', 'Marcha vigorosa'],
  Banco: ['Press inclinado', 'Dip en banco', 'Step-up', 'Remo apoyado'],
  Bandas: ['Band pull apart', 'Remo con banda', 'Hip thrust con banda', 'Press de hombro con banda'],
  'Suelo / Colchonetas': ['Plancha abdominal', 'Abdominales crunch', 'Burpees', 'Puente de glúteos', 'Mountain climbers', 'Crunch'],
};

export const intensityMultiplier: Record<Intensity, number> = {
  Baja: 0.9,
  Media: 1,
  Alta: 1.2,
  Máxima: 1.5,
};

export const intensityLabel: Record<Intensity, string> = {
  Baja: 'Recuperación, técnica y control',
  Media: 'Fuerza, volumen y tonificación',
  Alta: 'Masa muscular con esfuerzo sostenido',
  Máxima: 'Potencia y máxima exigencia',
};

export const exerciseMap: Record<string, Exercise> = {
  'Sentadilla con barra': { name: 'Sentadilla con barra', sets: '4', reps: '8-10', note: 'espalda neutra y profundidad controlada' },
  'Peso muerto': { name: 'Peso muerto', sets: '4', reps: '6-8', note: 'aprovecha fuerza y masa muscular' },
  'Press de banca': { name: 'Press de banca', sets: '4', reps: '8-10', note: 'bajada lenta y cierre de pecho' },
  Dominadas: { name: 'Dominadas', sets: '4', reps: '6-10', note: 'espalda y core en tensión' },
  'Peso muerto rumano': { name: 'Peso muerto rumano', sets: '3', reps: '8-10', note: 'glúteos e isquios con control' },
  'Press militar': { name: 'Press militar', sets: '3', reps: '8-10', note: 'hombros y estabilidad' },
  'Press militar con mancuernas': { name: 'Press militar con mancuernas', sets: '3', reps: '8-12', note: 'hombros con movimiento limpio' },
  'Curl biceps alterno': { name: 'Curl biceps alterno', sets: '3', reps: '10-12', note: 'agarre neutro y contracción' },
  'Press inclinado': { name: 'Press inclinado', sets: '3', reps: '8-10', note: 'foco en clavícula y pecho superior' },
  'Zancadas con mancuernas': { name: 'Zancadas con mancuernas', sets: '3', reps: '10 por pierna', note: 'equilibrio y estabilidad' },
  'Elevaciones laterales': { name: 'Elevaciones laterales', sets: '3', reps: '12-15', note: 'deltoides medial con control' },
  'Fly de pecho': { name: 'Fly de pecho', sets: '3', reps: '10-12', note: 'apertura de pecho con técnica' },
  'Caminata inclinada': { name: 'Caminata inclinada', sets: '1', reps: '15-20 min', note: 'cardio base para fatiga útil' },
  'Intervalos en caminadora': { name: 'Intervalos en caminadora', sets: '5', reps: '30s/30s', note: 'trabajo cardiovascular y resistencia' },
  'Cardio HIIT': { name: 'Cardio HIIT', sets: '6', reps: '40s/20s', note: 'máxima demanda y tonificación' },
  'Marcha vigorosa': { name: 'Marcha vigorosa', sets: '1', reps: '10-15 min', note: 'cardio de mantenimiento' },
  'Dip en banco': { name: 'Dip en banco', sets: '3', reps: '8-12', note: 'tríceps y pecho acumulando fuerza' },
  'Step-up': { name: 'Step-up', sets: '3', reps: '10 por pierna', note: 'piernas y estabilidad' },
  'Remo apoyado': { name: 'Remo apoyado', sets: '3', reps: '10-12', note: 'dorsales y hombros' },
  'Band pull apart': { name: 'Band pull apart', sets: '3', reps: '15', note: 'postura y espalda' },
  'Remo con banda': { name: 'Remo con banda', sets: '3', reps: '10-12', note: 'trabajo de espalda y hombro' },
  'Hip thrust con banda': { name: 'Hip thrust con banda', sets: '3', reps: '8-12', note: 'glúteos y fuerza de extensión' },
  'Press de hombro con banda': { name: 'Press de hombro con banda', sets: '3', reps: '10-12', note: 'hombros y estabilidad' },
  'Plancha abdominal': { name: 'Plancha abdominal', sets: '3', reps: '30-45s', note: 'core estable y dorsal activo' },
  'Abdominales crunch': { name: 'Abdominales crunch', sets: '3', reps: '15-20', note: 'tracción abdominal con control' },
  Burpees: { name: 'Burpees', sets: '3', reps: '8', note: 'alta exigencia y resistencia' },
  'Puente de glúteos': { name: 'Puente de glúteos', sets: '3', reps: '12-15', note: 'activación de glúteos y espalda' },
  'Mountain climbers': { name: 'Mountain climbers', sets: '3', reps: '20 total', note: 'core y resistencia' },
  Crunch: { name: 'Crunch', sets: '3', reps: '15-20', note: 'abdomen con control total' },
  'Carga de espalda': { name: 'Carga de espalda', sets: '3', reps: '8-10', note: 'resistencia y estabilidad postural' },
  'Peso muerto rumano con mancuernas': { name: 'Peso muerto rumano con mancuernas', sets: '3', reps: '8-10', note: 'control de glúteos e isquios' },
};

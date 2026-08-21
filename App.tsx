import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { StatusBar } from 'expo-status-bar';
import { equipmentList, getExerciseImage, intensityLabel, intensityMultiplier, type EquipmentName } from './src/constants/workoutData';
import type { Exercise, ExerciseProgress, Intensity, RoutineDay, WeeklySummary } from './src/types/workout';
import {
  loadCustomRoutine,
  loadHistory,
  loadProgressState,
  removeCustomRoutine,
  saveCustomRoutine as saveRoutineToStorage,
  saveHistory as saveHistoryToStorage,
  saveProgressState,
  createTrainerAssignment,
  createRoutineAssignment,
  createRoutineTemplate,
  loadTrainerAssignments,
  loadRoutineAssignments,
  loadRoutineTemplates,
  removeRoutineAssignment,
  removeRoutineTemplate,
  updateTrainerAssignmentStatus,
} from './src/services/workoutStorage';
import type { RoutineAssignment, RoutineTemplate, TrainerAssignment } from './src/types/user';


const getWeekStart = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  copy.setDate(copy.getDate() + diff);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const getWeekKey = (date: Date) => getWeekStart(date).toISOString().slice(0, 10);

const getWeekLabel = (weekKey: string) => {
  const date = new Date(`${weekKey}T00:00:00`);
  const monday = getWeekStart(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'short' });
  return `${monday.getDate()} ${monthFormatter.format(monday)} – ${sunday.getDate()} ${monthFormatter.format(sunday)}`;
};

const sanitizeExerciseName = (value: string | undefined) => {
  const sanitized = String(value ?? '').trim();
  return sanitized.length > 0 ? sanitized : 'Ejercicio';
};

const normalizeRoutine = (input: RoutineDay[] | null | undefined, fallback: RoutineDay[]): RoutineDay[] => {
  const source = Array.isArray(input) && input.length > 0 ? input : fallback;

  return source.map((day, dayIndex) => ({
    day: String(day?.day ?? `Día ${dayIndex + 1}`).trim() || `Día ${dayIndex + 1}`,
    title: String(day?.title ?? 'Entrenamiento').trim() || 'Entrenamiento',
    exercises: Array.isArray(day?.exercises) && day.exercises.length > 0
      ? day.exercises.map((exercise) => ({
          name: sanitizeExerciseName(exercise?.name),
          sets: String(exercise?.sets ?? '3 series').trim() || '3 series',
          reps: String(exercise?.reps ?? '8-10').trim() || '8-10',
          note: String(exercise?.note ?? 'Trabajo constante').trim() || 'Trabajo constante',
          image: exercise?.image ?? getExerciseImage(sanitizeExerciseName(exercise?.name)),
        }))
      : [{ name: 'Ejercicio base', sets: '3 series', reps: '8-10', note: 'Trabajo constante' }],
  }));
};

const createBlankRoutine = (): RoutineDay[] =>
  ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day) => ({
    day,
    title: 'Nuevo entrenamiento',
    exercises: [{ name: 'Nuevo ejercicio', sets: '3 series', reps: '8-10', note: 'Añade una nota' }],
  }));

const getRoutine = (selectedEquipment: EquipmentName[], intensity: Intensity): RoutineDay[] => {
  const multiplier = intensityMultiplier[intensity];
  const hasBarra = selectedEquipment.includes('Barra Olímpica');
  const hasMancuernas = selectedEquipment.includes('Mancuernas');
  const hasCardio = selectedEquipment.includes('Caminadora');

  const basePlan: RoutineDay[] = [
    {
      day: 'Lunes',
      title: 'Pecho + triceps',
      exercises: [
        { name: hasBarra ? 'Press de banca' : 'Press con mancuernas', sets: `${Math.max(3, Math.round(4 * multiplier))} series`, reps: '8-10', note: 'bajada controlada y pausa corta al pecho' },
        { name: hasMancuernas ? 'Press inclinado con mancuernas' : 'Press inclinado', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '8-10', note: 'trabajo de pecho superior y hombros' },
        { name: 'Dips o extensión de tríceps', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '8-12', note: 'triceps fuerte y estable' },
      ],
    },
    {
      day: 'Martes',
      title: 'Piernas + fuerza',
      exercises: [
        { name: hasBarra ? 'Sentadilla con barra' : 'Sentadilla goblet', sets: `${Math.max(4, Math.round(4 * multiplier))} series`, reps: '8-10', note: 'profundidad completa y espalda neutra' },
        { name: hasBarra ? 'Peso muerto' : 'Peso muerto con mancuernas', sets: `${Math.max(3, Math.round(4 * multiplier))} series`, reps: '6-8', note: 'extensión de cadera explosiva y control' },
        { name: hasCardio ? 'Caminata inclinada' : 'Step-ups', sets: `${Math.max(1, Math.round(1 * multiplier))} series`, reps: '12-15 min', note: 'cardio de base y calentamiento final' },
      ],
    },
    {
      day: 'Miércoles',
      title: 'Espalda + hombros',
      exercises: [
        { name: hasBarra ? 'Dominadas o jalar barra' : 'Remo con banda', sets: `${Math.max(4, Math.round(4 * multiplier))} series`, reps: '6-10', note: 'aductores y espalda en tensión sostenida' },
        { name: hasBarra ? 'Peso muerto rumano' : 'Peso muerto rumano con mancuernas', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '8-10', note: 'glúteos e isquios con control' },
        { name: 'Press militar o press de hombro', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '8-10', note: 'hombros estables y fuerza horizontal' },
      ],
    },
    {
      day: 'Jueves',
      title: 'Volumen + resistencia',
      exercises: [
        { name: hasMancuernas ? 'Curl biceps alterno' : 'Curl con banda', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '10-12', note: 'contracción lenta y control al subir' },
        { name: 'Zancadas con mancuernas', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '10 por pierna', note: 'equilibrio, pelviana y fuerza estable' },
        { name: hasCardio ? 'Intervalos en caminadora' : 'Burpees', sets: `${Math.max(4, Math.round(5 * multiplier))} series`, reps: '30s/30s', note: 'resistencia y tonificación total' },
      ],
    },
    {
      day: 'Viernes',
      title: 'Cardio + abdomen',
      exercises: [
        { name: hasCardio ? 'Cardio HIIT' : 'Marcha vigorosa', sets: `${Math.max(1, Math.round(1 * multiplier))} series`, reps: '10-20 min', note: 'tono cardiovascular y trabajo aeróbico' },
        { name: 'Plancha abdominal', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '30-45s', note: 'core rígido y tensión continua' },
        { name: 'Abdominales crunch', sets: `${Math.max(3, Math.round(3 * multiplier))} series`, reps: '15-20', note: 'superior abdominal con control total' },
      ],
    },
  ];

  return basePlan.map((dayPlan) => ({
    ...dayPlan,
    exercises: dayPlan.exercises.map((exercise) => ({
      ...exercise,
      name: exercise.name,
      sets: exercise.sets,
      reps: exercise.reps,
      note: exercise.note,
    })),
  }));
};

const getExerciseKey = (day: string, exerciseName: string, index: number) => `${day}-${(exerciseName || 'ejercicio').trim() || 'ejercicio'}-${index}`;

const createDefaultProgress = (routine: RoutineDay[]) => {
  const progress: Record<string, ExerciseProgress> = {};
  routine.forEach((day) => {
    day.exercises.forEach((exercise, index) => {
      progress[getExerciseKey(day.day, exercise.name, index)] = {
        done: false,
        weights: [''],
      };
    });
  });
  return progress;
};

const mergeProgressWithRoutine = (existing: Record<string, ExerciseProgress>, routine: RoutineDay[]) => {
  const next = createDefaultProgress(routine);
  Object.entries(existing).forEach(([key, value]) => {
    const safeValue = value && Array.isArray(value.weights) ? value : { done: Boolean(value?.done), weights: [''] };
    if (next[key]) {
      next[key] = {
        done: safeValue.done ?? false,
        weights: safeValue.weights && safeValue.weights.length > 0 ? safeValue.weights : [''],
      };
    }
  });
  return next;
};

const countCompletedExercises = (progress: Record<string, ExerciseProgress>) =>
  Object.values(progress).filter((item) => item.done).length;

type AppScreen = 'modify' | 'today' | 'routines' | 'trainer' | 'trainerPanel';

const getTodayName = () => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date().getDay()];
};

const createRoutineShareLink = (title: string, routine: RoutineDay[]) => {
  if (typeof window === 'undefined') return '';
  const payload = encodeURIComponent(JSON.stringify({ title, routine }));
  return `${window.location.origin}${window.location.pathname}?sharedRoutine=${payload}`;
};

const readSharedRoutineFromUrl = (): { title: string; routine: RoutineDay[] } | null => {
  if (typeof window === 'undefined') return null;
  const encodedRoutine = new URLSearchParams(window.location.search).get('sharedRoutine');
  if (!encodedRoutine) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(encodedRoutine)) as Partial<{ title: string; routine: RoutineDay[] }>;
    if (!parsed.title || !Array.isArray(parsed.routine) || parsed.routine.length === 0) return null;
    return { title: parsed.title, routine: parsed.routine };
  } catch {
    return null;
  }
};

export default function App() {
  const currentWeekKey = getWeekKey(new Date());
  const [activeScreen, setActiveScreen] = useState<AppScreen>('today');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentName[]>(['Barra Olímpica', 'Mancuernas', 'Caminadora', 'Banco', 'Bandas', 'Suelo / Colchonetas']);
  const [intensity, setIntensity] = useState<Intensity>('Media');
  const [weekProgress, setWeekProgress] = useState<Record<string, ExerciseProgress>>({});
  const [history, setHistory] = useState<WeeklySummary[]>([]);
  const [savedWeekKey, setSavedWeekKey] = useState<string>(currentWeekKey);
  const [customRoutine, setCustomRoutine] = useState<RoutineDay[] | null>(null);
  const [trainerAssignments, setTrainerAssignments] = useState<TrainerAssignment[]>([]);
  const [routineAssignments, setRoutineAssignments] = useState<RoutineAssignment[]>([]);
  const [routineTemplates, setRoutineTemplates] = useState<RoutineTemplate[]>([]);
  const [trainerCode, setTrainerCode] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
  const [routineTitle, setRoutineTitle] = useState('Rutina personalizada');
  const [routineAssignmentMessage, setRoutineAssignmentMessage] = useState('');
  const [selectedEditRoutineId, setSelectedEditRoutineId] = useState('default');
  const [isEditingWeek, setIsEditingWeek] = useState(false);
  const [editorRoutine, setEditorRoutine] = useState<RoutineDay[]>(() =>
    normalizeRoutine(null, getRoutine(['Barra Olímpica', 'Mancuernas', 'Caminadora', 'Banco', 'Bandas', 'Suelo / Colchonetas'], 'Media')),
  );

  const routine = useMemo(
    () => normalizeRoutine(customRoutine, getRoutine(selectedEquipment, intensity)),
    [customRoutine, selectedEquipment, intensity],
  );
  const totalExercises = routine.reduce((count, day) => count + day.exercises.length, 0);
  const completedExercises = countCompletedExercises(weekProgress);
  const progressPercent = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;
  const todayName = getTodayName();
  const todayPlan = routine.find((dayPlan) => dayPlan.day === todayName);

  useEffect(() => {
    const loadState = async () => {
      try {
        const saved = await loadProgressState();
        const parsedHistoryFromStorage = await loadHistory();
        const savedRoutine = await loadCustomRoutine();
        const savedAssignments = await loadTrainerAssignments();
        const savedRoutineAssignments = await loadRoutineAssignments();
        const savedRoutineTemplates = await loadRoutineTemplates();
        const sharedRoutine = readSharedRoutineFromUrl();

        let parsedProgress = {} as Record<string, ExerciseProgress>;
        let parsedWeekKey = currentWeekKey;
        let parsedHistory: WeeklySummary[] = parsedHistoryFromStorage;

        if (saved) {
          parsedProgress = saved.progress;
          parsedWeekKey = saved.weekKey || currentWeekKey;
        }

        if (savedRoutine) {
          setCustomRoutine(savedRoutine);
          setEditorRoutine(savedRoutine);
        }

        setTrainerAssignments(savedAssignments);
        setRoutineAssignments(savedRoutineAssignments);
        if (sharedRoutine) {
          const importedTemplate = await createRoutineTemplate(
            'local-client',
            sharedRoutine.title,
            sharedRoutine.routine,
            'user',
          );
          const templatesWithSharedRoutine = [...savedRoutineTemplates, importedTemplate];
          setRoutineTemplates(templatesWithSharedRoutine);
          setRoutineAssignmentMessage(`Se importó "${sharedRoutine.title}" desde el enlace.`);
          if (typeof window !== 'undefined') {
            window.history.replaceState({}, '', window.location.pathname);
          }
        } else {
          setRoutineTemplates(savedRoutineTemplates);
        }

        const defaultProgress = createDefaultProgress(routine);
        const normalizedProgress = mergeProgressWithRoutine(parsedProgress, routine);

        if (parsedWeekKey !== currentWeekKey) {
          const completed = countCompletedExercises(normalizedProgress);
          const previousSummary: WeeklySummary = {
            weekKey: parsedWeekKey,
            label: getWeekLabel(parsedWeekKey),
            completed,
            total: totalExercises,
          };
          parsedHistory = [previousSummary, ...parsedHistory].slice(0, 5);
          setSavedWeekKey(currentWeekKey);
          setWeekProgress(defaultProgress);
          await saveProgressState({ weekKey: currentWeekKey, progress: defaultProgress });
          await saveHistoryToStorage(parsedHistory);
          return;
        }

        setSavedWeekKey(parsedWeekKey);
        setWeekProgress(normalizedProgress);
        setHistory(parsedHistory);
      } catch (error) {
        console.log('fallo al cargar estado', error);
        setWeekProgress(createDefaultProgress(routine));
      }
    };

    void loadState();
  }, []);

  useEffect(() => {
    const saveState = async () => {
      try {
        await saveProgressState({ weekKey: savedWeekKey, progress: weekProgress });
      } catch (error) {
        console.log('fallo al guardar progreso', error);
      }
    };

    if (Object.keys(weekProgress).length > 0) {
      void saveState();
    }
  }, [savedWeekKey, weekProgress]);

  useEffect(() => {
    const saveHistory = async () => {
      try {
        await saveHistoryToStorage(history);
      } catch (error) {
        console.log('fallo al guardar historial', error);
      }
    };

    if (history.length > 0) {
      void saveHistory();
    }
  }, [history]);

  const toggleEquipment = (item: EquipmentName) => {
    setSelectedEquipment((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  };

  const toggleExerciseDone = (day: string, exerciseName: string, index: number) => {
    const key = getExerciseKey(day, exerciseName, index);
    setWeekProgress((current) => ({
      ...current,
      [key]: {
        done: !(current[key]?.done ?? false),
        weights: current[key]?.weights ?? [''],
      },
    }));
  };

  const updateWeight = (day: string, exerciseName: string, index: number, weightIndex: number, value: string) => {
    const key = getExerciseKey(day, exerciseName, index);
    setWeekProgress((current) => {
      const prev = current[key] ?? { done: false, weights: [''] };
      const weights = [...prev.weights];
      weights[weightIndex] = value;
      return {
        ...current,
        [key]: {
          done: prev.done,
          weights,
        },
      };
    });
  };

  const addWeightEntry = (day: string, exerciseName: string, index: number) => {
    const key = getExerciseKey(day, exerciseName, index);
    setWeekProgress((current) => {
      const prev = current[key] ?? { done: false, weights: [''] };
      return {
        ...current,
        [key]: {
          done: prev.done,
          weights: [...prev.weights, ''],
        },
      };
    });
  };

  const removeWeightEntry = (day: string, exerciseName: string, index: number, weightIndex: number) => {
    const key = getExerciseKey(day, exerciseName, index);
    setWeekProgress((current) => {
      const prev = current[key] ?? { done: false, weights: [''] };
      const nextWeights = prev.weights.filter((_, itemIndex) => itemIndex !== weightIndex);
      return {
        ...current,
        [key]: {
          done: prev.done,
          weights: nextWeights.length > 0 ? nextWeights : [''],
        },
      };
    });
  };

  const resetCurrentWeek = async () => {
    const summary: WeeklySummary = {
      weekKey: savedWeekKey,
      label: getWeekLabel(savedWeekKey),
      completed: completedExercises,
      total: totalExercises,
    };
    const nextHistory = [summary, ...history].slice(0, 5);
    setHistory(nextHistory);
    setWeekProgress(createDefaultProgress(routine));
    await saveHistoryToStorage(nextHistory);
    await saveProgressState({ weekKey: savedWeekKey, progress: createDefaultProgress(routine) });
  };

  const openWeekEditor = () => {
    const safeRoutine = normalizeRoutine(routine, getRoutine(selectedEquipment, intensity));
    setEditorRoutine(
      safeRoutine.map((day) => ({
        ...day,
        exercises: Array.isArray(day.exercises)
          ? day.exercises.map((exercise) => ({ ...exercise }))
          : [{ name: 'Ejercicio base', sets: '3 series', reps: '8-10', note: 'Trabajo constante' }],
      })),
    );
    setIsEditingWeek(true);
  };

  const createCustomRoutine = () => {
    setSelectedEditRoutineId('new');
    setEditorRoutine(createBlankRoutine());
    setIsEditingWeek(true);
  };

  const editSelectedRoutine = (routineId: string, selectedRoutine: RoutineDay[]) => {
    setSelectedEditRoutineId(routineId);
    setEditorRoutine(normalizeRoutine(selectedRoutine, routine));
    setIsEditingWeek(true);
  };

  const updateEditorExercise = (dayIndex: number, exerciseIndex: number, field: 'name' | 'sets' | 'reps' | 'note' | 'image', value: string) => {
    setEditorRoutine((current) =>
      current.map((day, currentDayIndex) =>
        currentDayIndex !== dayIndex
          ? day
          : {
              ...day,
              exercises: day.exercises.map((exercise, currentExerciseIndex) =>
                currentExerciseIndex !== exerciseIndex
                  ? exercise
                  : { ...exercise, [field]: value },
              ),
            },
      ),
    );
  };

  const addEditorExercise = (dayIndex: number) => {
    setEditorRoutine((current) => current.map((day, currentDayIndex) => (
      currentDayIndex !== dayIndex
        ? day
        : {
            ...day,
            exercises: [
              ...day.exercises,
              { name: 'Nuevo ejercicio', sets: '3 series', reps: '8-10', note: 'Añade una nota' },
            ],
          }
    )));
  };

  const removeEditorExercise = (dayIndex: number, exerciseIndex: number) => {
    setEditorRoutine((current) => current.map((day, currentDayIndex) => {
      if (currentDayIndex !== dayIndex || day.exercises.length <= 1) return day;
      return {
        ...day,
        exercises: day.exercises.filter((_, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex),
      };
    }));
  };

  const pickExerciseImage = async (dayIndex: number, exerciseIndex: number) => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      updateEditorExercise(dayIndex, exerciseIndex, 'image', result.assets[0].uri);
    }
  };

  const saveCustomRoutine = async () => {
    const safeRoutine = normalizeRoutine(editorRoutine, routine);
    setCustomRoutine(safeRoutine);
    setIsEditingWeek(false);
    const resetProgress = createDefaultProgress(safeRoutine);
    setWeekProgress(resetProgress);
    await saveRoutineToStorage(safeRoutine);
    await saveProgressState({ weekKey: savedWeekKey, progress: resetProgress });
  };
  
  const resetRoutineToDefault = async () => {
    const nextRoutine = normalizeRoutine(getRoutine(selectedEquipment, intensity), routine);
    setCustomRoutine(null);
    setEditorRoutine(nextRoutine);
    const resetProgress = createDefaultProgress(nextRoutine);
    setWeekProgress(resetProgress);
    await removeCustomRoutine();
    await saveProgressState({ weekKey: savedWeekKey, progress: resetProgress });
  };

  const sendTrainerRequest = async () => {
    const normalizedCode = trainerCode.trim().toUpperCase();
    if (normalizedCode.length < 4) {
      setAssignmentMessage('Escribe un código de al menos 4 caracteres.');
      return;
    }

    const existingRequest = trainerAssignments.find(
      (assignment) => assignment.trainerId === normalizedCode && assignment.status === 'pending',
    );
    if (existingRequest) {
      setAssignmentMessage('Ya tienes una solicitud pendiente para este entrenador.');
      return;
    }

    const assignment = await createTrainerAssignment(normalizedCode, 'local-client');
    setTrainerAssignments((current) => [...current, assignment]);
    setTrainerCode('');
    setAssignmentMessage('Solicitud enviada. El entrenador debe aceptarla.');
  };

  const changeAssignmentStatus = async (assignmentId: string, status: 'active' | 'rejected') => {
    const updatedAssignment = await updateTrainerAssignmentStatus(assignmentId, status);
    if (!updatedAssignment) return;

    setTrainerAssignments((current) => current.map((assignment) => (
      assignment.id === assignmentId ? updatedAssignment : assignment
    )));
  };

  const endTrainerConnection = async (assignmentId: string) => {
    const updatedAssignment = await updateTrainerAssignmentStatus(assignmentId, 'ended');
    if (!updatedAssignment) return;

    setTrainerAssignments((current) => current.map((assignment) => (
      assignment.id === assignmentId ? updatedAssignment : assignment
    )));
    setRoutineAssignmentMessage('La relación con el entrenador ha terminado.');
  };

  const deleteSavedRoutine = async (templateId: string) => {
    await removeRoutineTemplate(templateId);
    setRoutineTemplates((current) => current.filter((template) => template.id !== templateId));
    setRoutineAssignmentMessage('La rutina guardada fue eliminada.');
  };

  const deleteRoutineFromHistory = async (assignmentId: string) => {
    await removeRoutineAssignment(assignmentId);
    setRoutineAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    setRoutineAssignmentMessage('La rutina del historial fue eliminada.');
  };

  const assignRoutineToClient = async (clientAssignment: TrainerAssignment) => {
    const title = routineTitle.trim();
    if (!title) {
      setRoutineAssignmentMessage('Escribe un nombre para la rutina.');
      return;
    }

    const routineAssignment = await createRoutineAssignment(
      clientAssignment.trainerId,
      clientAssignment.clientId,
      title,
      routine,
    );
    setRoutineAssignments((current) => [
      ...current.filter((item) => item.id !== routineAssignment.id && item.clientId !== clientAssignment.clientId),
      routineAssignment,
    ]);
    setRoutineAssignmentMessage(`Rutina asignada a ${clientAssignment.clientId}.`);
  };

  const saveCurrentRoutineAsTemplate = async () => {
    const title = routineTitle.trim();
    if (!title) {
      setRoutineAssignmentMessage('Escribe un nombre para guardar la plantilla.');
      return;
    }

    const template = await createRoutineTemplate('local-trainer', title, routine);
    setRoutineTemplates((current) => [...current, template]);
    setRoutineAssignmentMessage(`Plantilla "${template.title}" guardada.`);
  };

  const assignTemplateToClient = async (template: RoutineTemplate, clientAssignment: TrainerAssignment) => {
    const routineAssignment = await createRoutineAssignment(
      clientAssignment.trainerId,
      clientAssignment.clientId,
      template.title,
      template.routine,
      template.id,
    );
    setRoutineAssignments((current) => [
      ...current.filter((item) => item.clientId !== clientAssignment.clientId),
      routineAssignment,
    ]);
    setRoutineAssignmentMessage(`"${template.title}" asignada a ${clientAssignment.clientId}.`);
  };

  const saveCurrentRoutineAsUserTemplate = async () => {
    const title = routineTitle.trim();
    if (!title) {
      setRoutineAssignmentMessage('Escribe un nombre para guardar tu rutina.');
      return;
    }

    const template = await createRoutineTemplate('local-client', title, routine, 'user');
    setRoutineTemplates((current) => [...current, template]);
    setRoutineAssignmentMessage(`Tu rutina "${template.title}" quedó guardada.`);
  };

  const shareRoutine = async (title: string, sharedRoutine: RoutineDay[]) => {
    const link = createRoutineShareLink(title, sharedRoutine);
    if (!link) {
      setRoutineAssignmentMessage('Los enlaces compartidos están disponibles en la versión web.');
      return;
    }

    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(link);
        setRoutineAssignmentMessage(`Enlace de "${title}" copiado.`);
        return;
      }
    } catch {
      // Continue with the native share dialog when clipboard access is unavailable.
    }

    await Share.share({
      message: `Prueba esta rutina de FitFlow: ${link}`,
      url: link,
    });
  };

  const activateUserRoutine = async (template: RoutineTemplate) => {
    const nextRoutine = normalizeRoutine(template.routine, routine);
    setCustomRoutine(nextRoutine);
    setEditorRoutine(nextRoutine);
    setWeekProgress(createDefaultProgress(nextRoutine));
    await saveRoutineToStorage(nextRoutine);
    await saveProgressState({ weekKey: savedWeekKey, progress: createDefaultProgress(nextRoutine) });
    setRoutineAssignmentMessage(`Ahora estás usando "${template.title}".`);
  };

  const activateAssignedRoutine = async (assignment: RoutineAssignment) => {
    const nextRoutine = normalizeRoutine(assignment.routine, routine);
    setCustomRoutine(nextRoutine);
    setEditorRoutine(nextRoutine);
    setWeekProgress(createDefaultProgress(nextRoutine));
    await saveRoutineToStorage(nextRoutine);
    await saveProgressState({ weekKey: savedWeekKey, progress: createDefaultProgress(nextRoutine) });
    setRoutineAssignmentMessage(`Ahora estás usando "${assignment.title}".`);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.appShell}>
        <View style={styles.sidebar}>
          <View style={styles.brandRow}>
            <Image source={require('./assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.title}>FitFlow</Text>
              <Text style={styles.sidebarSubtitle}>FITNESS OS</Text>
            </View>
          </View>
          <Text style={styles.sidebarLabel}>ENTRENAMIENTO</Text>
          <Pressable
            onPress={() => setActiveScreen('today')}
            style={[styles.navigationButton, activeScreen === 'today' && styles.navigationButtonActive]}
          >
            <Text style={styles.navigationIcon}>01</Text>
            <Text style={[styles.navigationText, activeScreen === 'today' && styles.navigationTextActive]}>Hoy</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveScreen('modify')}
            style={[styles.navigationButton, activeScreen === 'modify' && styles.navigationButtonActive]}
          >
            <Text style={styles.navigationIcon}>02</Text>
            <Text style={[styles.navigationText, activeScreen === 'modify' && styles.navigationTextActive]}>Modificar rutina</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveScreen('routines')}
            style={[styles.navigationButton, activeScreen === 'routines' && styles.navigationButtonActive]}
          >
            <Text style={styles.navigationIcon}>03</Text>
            <Text style={[styles.navigationText, activeScreen === 'routines' && styles.navigationTextActive]}>Mis rutinas</Text>
          </Pressable>
          <Text style={styles.sidebarLabel}>COMUNIDAD</Text>
          <Pressable
            onPress={() => setActiveScreen('trainer')}
            style={[styles.navigationButton, activeScreen === 'trainer' && styles.navigationButtonActive]}
          >
            <Text style={styles.navigationIcon}>04</Text>
            <Text style={[styles.navigationText, activeScreen === 'trainer' && styles.navigationTextActive]}>Mi entrenador</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveScreen('trainerPanel')}
            style={[styles.navigationButton, activeScreen === 'trainerPanel' && styles.navigationButtonActive]}
          >
            <Text style={styles.navigationIcon}>05</Text>
            <Text style={[styles.navigationText, activeScreen === 'trainerPanel' && styles.navigationTextActive]}>Panel entrenador</Text>
          </Pressable>
          <View style={styles.sidebarFooter}>
            <Text style={styles.sidebarFooterTitle}>FOCUS MODE</Text>
            <Text style={styles.sidebarFooterText}>Construye constancia, una sesión a la vez.</Text>
          </View>
        </View>

        <View style={styles.mainContent}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.topbar}>
          <View>
            <Text style={styles.eyebrow}>TU ESPACIO DE ENTRENAMIENTO</Text>
            <Text style={styles.pageTitle}>{activeScreen === 'today' ? 'Entrenamiento de hoy' : activeScreen === 'modify' ? 'Diseña tu rutina' : activeScreen === 'routines' ? 'Tu biblioteca' : activeScreen === 'trainer' ? 'Tu coach' : 'Centro del entrenador'}</Text>
          </View>
          <View style={styles.topbarBadge}>
            <Text style={styles.topbarBadgeText}>{progressPercent}% SEMANA</Text>
          </View>
        </View>

        {activeScreen === 'trainer' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Conectar con un entrenador</Text>
            <Text style={styles.cardDescription}>
              Introduce el código que te compartió tu entrenador para enviarle una solicitud.
            </Text>
            <TextInput
              value={trainerCode}
              onChangeText={(value) => {
                setTrainerCode(value.toUpperCase());
                setAssignmentMessage('');
              }}
              placeholder="Ej. FIT-2048"
              placeholderTextColor="#64748b"
              autoCapitalize="characters"
              style={styles.trainerCodeInput}
            />
            <Pressable onPress={() => void sendTrainerRequest()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Enviar solicitud</Text>
            </Pressable>
            {assignmentMessage ? <Text style={styles.assignmentMessage}>{assignmentMessage}</Text> : null}

            <Text style={styles.sectionTitle}>Mis solicitudes</Text>
            {trainerAssignments.length === 0 ? (
              <Text style={styles.emptyState}>Todavía no tienes solicitudes de entrenador.</Text>
            ) : (
              trainerAssignments.map((assignment) => (
                <View key={assignment.id} style={styles.assignmentItem}>
                  <View style={styles.assignmentDetails}>
                    <Text style={styles.assignmentTrainer}>Código: {assignment.trainerId}</Text>
                    <Text style={styles.historyText}>Solicitud enviada</Text>
                  </View>
                  <View style={styles.assignmentActions}>
                    <Text style={styles.assignmentStatus}>{assignment.status}</Text>
                    {assignment.status === 'active' ? (
                      <Pressable
                        onPress={() => void endTrainerConnection(assignment.id)}
                        style={styles.rejectButton}
                      >
                        <Text style={styles.actionButtonText}>Quitar entrenador</Text>
                      </Pressable>
                    ) : null}
                  </View>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeScreen === 'routines' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mis rutinas guardadas</Text>
            <Text style={styles.cardDescription}>
              Guarda planes para casa, gimnasio o los que te comparta tu coach. Solo una rutina se usa como activa.
            </Text>
            <TextInput
              value={routineTitle}
              onChangeText={(value) => {
                setRoutineTitle(value);
                setRoutineAssignmentMessage('');
              }}
              placeholder="Ej. Rutina casa"
              placeholderTextColor="#64748b"
              style={styles.trainerCodeInput}
            />
            <Pressable onPress={() => void saveCurrentRoutineAsUserTemplate()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Guardar rutina actual</Text>
            </Pressable>
            {routineTemplates.filter((template) => template.ownerRole === 'user').length === 0 ? (
              <Text style={styles.emptyState}>Todavía no tienes rutinas guardadas.</Text>
            ) : (
              routineTemplates
                .filter((template) => template.ownerRole === 'user')
                .map((template) => (
                  <View key={template.id} style={styles.templateItem}>
                    <View style={styles.assignmentDetails}>
                      <Text style={styles.assignmentTrainer}>{template.title}</Text>
                      <Text style={styles.historyText}>{template.routine.length} días programados</Text>
                    </View>
                    <View style={styles.assignmentActions}>
                      <Pressable onPress={() => void activateUserRoutine(template)} style={styles.acceptButton}>
                        <Text style={styles.actionButtonText}>Usar rutina</Text>
                      </Pressable>
                      <Pressable onPress={() => void shareRoutine(template.title, template.routine)} style={styles.shareButton}>
                        <Text style={styles.actionButtonText}>Compartir</Text>
                      </Pressable>
                      <Pressable onPress={() => void deleteSavedRoutine(template.id)} style={styles.rejectButton}>
                        <Text style={styles.actionButtonText}>Borrar</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
            )}
            <Text style={styles.sectionTitle}>Rutinas de mis coaches</Text>
            {routineAssignments.filter((assignment) => assignment.clientId === 'local-client').length === 0 ? (
              <Text style={styles.emptyState}>Todavía no te han asignado una rutina.</Text>
            ) : (
              routineAssignments
                .filter((assignment) => assignment.clientId === 'local-client')
                .map((assignment) => (
                  <View key={assignment.id} style={styles.templateItem}>
                    <View style={styles.assignmentDetails}>
                      <Text style={styles.assignmentTrainer}>{assignment.title}</Text>
                      <Text style={styles.historyText}>
                        Coach: {assignment.trainerId} · {assignment.status}
                      </Text>
                    </View>
                    <View style={styles.assignmentActions}>
                      {assignment.status === 'active' ? (
                        <Pressable onPress={() => void activateAssignedRoutine(assignment)} style={styles.acceptButton}>
                          <Text style={styles.actionButtonText}>Usar rutina</Text>
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => void shareRoutine(assignment.title, assignment.routine)} style={styles.shareButton}>
                        <Text style={styles.actionButtonText}>Compartir</Text>
                      </Pressable>
                      <Pressable onPress={() => void deleteRoutineFromHistory(assignment.id)} style={styles.rejectButton}>
                        <Text style={styles.actionButtonText}>Borrar</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
            )}
            {routineAssignmentMessage ? (
              <Text style={styles.assignmentMessage}>{routineAssignmentMessage}</Text>
            ) : null}
          </View>
        ) : null}

        {activeScreen === 'trainerPanel' ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Solicitudes de clientes</Text>
            <Text style={styles.cardDescription}>
              Revisa las solicitudes y decide qué clientes pueden trabajar contigo.
            </Text>
            {trainerAssignments.length === 0 ? (
              <Text style={styles.emptyState}>No hay solicitudes disponibles.</Text>
            ) : (
              trainerAssignments.map((assignment) => (
                <View key={assignment.id} style={styles.assignmentItem}>
                  <View style={styles.assignmentDetails}>
                    <Text style={styles.assignmentTrainer}>Cliente: {assignment.clientId}</Text>
                    <Text style={styles.historyText}>Código: {assignment.trainerId}</Text>
                    <Text style={styles.assignmentStatus}>{assignment.status}</Text>
                  </View>
                  {assignment.status === 'pending' ? (
                    <View style={styles.assignmentActions}>
                      <Pressable
                        onPress={() => void changeAssignmentStatus(assignment.id, 'active')}
                        style={styles.acceptButton}
                      >
                        <Text style={styles.actionButtonText}>Aceptar</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void changeAssignmentStatus(assignment.id, 'rejected')}
                        style={styles.rejectButton}
                      >
                        <Text style={styles.actionButtonText}>Rechazar</Text>
                      </Pressable>
                    </View>
                  ) : assignment.status === 'active' ? (
                    <Pressable
                      onPress={() => void endTrainerConnection(assignment.id)}
                      style={styles.rejectButton}
                    >
                      <Text style={styles.actionButtonText}>Quitar cliente</Text>
                    </Pressable>
                  ) : null}
                </View>
              ))
            )}
            <Text style={styles.sectionTitle}>Biblioteca de rutinas</Text>
            <Text style={styles.cardDescription}>
              Guarda varias rutinas por nivel u objetivo y asígnalas sin crearlas de nuevo.
            </Text>
            <TextInput
              value={routineTitle}
              onChangeText={(value) => {
                setRoutineTitle(value);
                setRoutineAssignmentMessage('');
              }}
              placeholder="Nombre de la rutina"
              placeholderTextColor="#64748b"
              style={styles.trainerCodeInput}
            />
            <Pressable onPress={() => void saveCurrentRoutineAsTemplate()} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Guardar rutina actual</Text>
            </Pressable>
            {routineTemplates.filter((template) => template.ownerRole === 'trainer').length === 0 ? (
              <Text style={styles.emptyState}>Todavía no tienes rutinas guardadas.</Text>
            ) : (
              routineTemplates
                .filter((template) => template.ownerRole === 'trainer')
                .map((template) => (
                <View key={template.id} style={styles.templateItem}>
                  <View style={styles.assignmentDetails}>
                    <Text style={styles.assignmentTrainer}>{template.title}</Text>
                    <Text style={styles.historyText}>{template.routine.length} días programados</Text>
                  </View>
                  <View style={styles.templateClientList}>
                    {trainerAssignments
                      .filter((assignment) => assignment.status === 'active')
                      .map((assignment) => (
                        <Pressable
                          key={`${template.id}-${assignment.id}`}
                          onPress={() => void assignTemplateToClient(template, assignment)}
                          style={styles.acceptButton}
                        >
                          <Text style={styles.actionButtonText}>A {assignment.clientId}</Text>
                        </Pressable>
                      ))}
                    <Pressable onPress={() => void deleteSavedRoutine(template.id)} style={styles.rejectButton}>
                      <Text style={styles.actionButtonText}>Borrar rutina</Text>
                    </Pressable>
                  </View>
                </View>
                ))
            )}
            {routineAssignmentMessage ? (
              <Text style={styles.assignmentMessage}>{routineAssignmentMessage}</Text>
            ) : null}
          </View>
        ) : null}

        {activeScreen !== 'trainer' && activeScreen !== 'routines' && activeScreen !== 'trainerPanel' ? <View>
        {activeScreen === 'modify' ? <>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Equipo disponible</Text>
          <View style={styles.chipWrap}>
            {equipmentList.map((item) => {
              const active = selectedEquipment.includes(item);
              return (
                <Pressable
                  key={item}
                  onPress={() => toggleEquipment(item)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Intensidad</Text>
          <View style={styles.intensityRow}>
            {(['Baja', 'Media', 'Alta', 'Máxima'] as Intensity[]).map((level) => (
              <Pressable
                key={level}
                onPress={() => setIntensity(level)}
                style={[styles.intensityButton, level === intensity && styles.intensityButtonActive]}
              >
                <Text style={[styles.intensityText, level === intensity && styles.intensityTextActive]}>{level}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={styles.intensityDescription}>{intensityLabel[intensity]}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Plan semanal</Text>
          <Text style={styles.cardDescription}>¿Qué rutina quieres modificar?</Text>
          <View style={styles.routineOptions}>
            <Pressable
              onPress={() => editSelectedRoutine('default', getRoutine(selectedEquipment, intensity))}
              style={[styles.routineOption, selectedEditRoutineId === 'default' && styles.routineOptionActive]}
            >
              <Text style={[styles.routineOptionTitle, selectedEditRoutineId === 'default' && styles.routineOptionTitleActive]}>
                Rutina default
              </Text>
              <Text style={styles.routineOptionMeta}>Generada por FitFlow</Text>
            </Pressable>
            {routineTemplates
              .filter((template) => template.ownerRole === 'user')
              .map((template) => (
                <Pressable
                  key={`edit-template-${template.id}`}
                  onPress={() => editSelectedRoutine(template.id, template.routine)}
                  style={[styles.routineOption, selectedEditRoutineId === template.id && styles.routineOptionActive]}
                >
                  <Text style={[styles.routineOptionTitle, selectedEditRoutineId === template.id && styles.routineOptionTitleActive]}>
                    {template.title}
                  </Text>
                  <Text style={styles.routineOptionMeta}>Rutina guardada</Text>
                </Pressable>
              ))}
            {routineAssignments
              .filter((assignment) => assignment.clientId === 'local-client')
              .map((assignment) => (
                <Pressable
                  key={`edit-assignment-${assignment.id}`}
                  onPress={() => editSelectedRoutine(assignment.id, assignment.routine)}
                  style={[styles.routineOption, selectedEditRoutineId === assignment.id && styles.routineOptionActive]}
                >
                  <Text style={[styles.routineOptionTitle, selectedEditRoutineId === assignment.id && styles.routineOptionTitleActive]}>
                    {assignment.title}
                  </Text>
                  <Text style={styles.routineOptionMeta}>Rutina del coach</Text>
                </Pressable>
              ))}
            <Pressable
              onPress={createCustomRoutine}
              style={[styles.routineOption, selectedEditRoutineId === 'new' && styles.routineOptionActive]}
            >
              <Text style={[styles.routineOptionTitle, selectedEditRoutineId === 'new' && styles.routineOptionTitleActive]}>
                Crear nueva
              </Text>
              <Text style={styles.routineOptionMeta}>Empieza desde cero</Text>
            </Pressable>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.progressText}>
              {customRoutine ? 'Rutina personalizada' : 'Rutina default generada'}
            </Text>
            <Pressable onPress={openWeekEditor} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>
                {customRoutine ? 'Editar rutina' : 'Modificar default'}
              </Text>
            </Pressable>
          </View>
          {customRoutine ? (
            <Pressable onPress={resetRoutineToDefault} style={styles.defaultButton}>
              <Text style={styles.defaultButtonText}>Usar rutina default</Text>
            </Pressable>
          ) : (
            <Pressable onPress={createCustomRoutine} style={styles.defaultButton}>
              <Text style={styles.defaultButtonText}>Crear rutina propia</Text>
            </Pressable>
          )}
        </View>

        {isEditingWeek ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Modificar ejercicios de la semana</Text>
            {editorRoutine.map((dayPlan, dayIndex) => (
              <View key={`${dayPlan.day}-${dayIndex}`} style={styles.dayCard}>
                <Text style={styles.dayLabel}>{dayPlan.day}</Text>
                <TextInput
                  value={dayPlan.title}
                  onChangeText={(value) =>
                    setEditorRoutine((current) =>
                      current.map((day, currentDayIndex) =>
                        currentDayIndex !== dayIndex ? day : { ...day, title: value },
                      ),
                    )
                  }
                  style={styles.editorInput}
                />
                {dayPlan.exercises.map((exercise, exerciseIndex) => (
                  <View key={`${dayPlan.day}-${exercise.name}-${exerciseIndex}`} style={styles.editorExerciseCard}>
                    <View style={styles.editorExerciseHeader}>
                      <Text style={styles.editorExerciseLabel}>Ejercicio {exerciseIndex + 1}</Text>
                      <Pressable
                        onPress={() => removeEditorExercise(dayIndex, exerciseIndex)}
                        style={styles.removeExerciseButton}
                      >
                        <Text style={styles.removeExerciseText}>Eliminar</Text>
                      </Pressable>
                    </View>
                    <TextInput
                      value={exercise.name}
                      onChangeText={(value) => updateEditorExercise(dayIndex, exerciseIndex, 'name', value)}
                      placeholder="Nombre del ejercicio"
                      style={styles.editorInput}
                    />
                    <View style={styles.editorInlineRow}>
                      <TextInput
                        value={exercise.sets}
                        onChangeText={(value) => updateEditorExercise(dayIndex, exerciseIndex, 'sets', value)}
                        placeholder="4 series"
                        style={[styles.editorInput, styles.editorHalfInput]}
                      />
                      <TextInput
                        value={exercise.reps}
                        onChangeText={(value) => updateEditorExercise(dayIndex, exerciseIndex, 'reps', value)}
                        placeholder="8-10"
                        style={[styles.editorInput, styles.editorHalfInput]}
                      />
                    </View>
                    <TextInput
                      value={exercise.note}
                      onChangeText={(value) => updateEditorExercise(dayIndex, exerciseIndex, 'note', value)}
                      placeholder="Descripción del ejercicio"
                      multiline
                      style={[styles.editorInput, styles.editorTextArea]}
                    />
                    <TextInput
                      value={typeof exercise.image === 'string' ? exercise.image : ''}
                      onChangeText={(value) => updateEditorExercise(dayIndex, exerciseIndex, 'image', value)}
                      placeholder="URL de imagen (opcional)"
                      autoCapitalize="none"
                      style={styles.editorInput}
                    />
                    <Pressable
                      onPress={() => void pickExerciseImage(dayIndex, exerciseIndex)}
                      style={styles.imagePickerButton}
                    >
                      <Text style={styles.imagePickerButtonText}>Elegir imagen desde el dispositivo</Text>
                    </Pressable>
                  </View>
                ))}
                <Pressable onPress={() => addEditorExercise(dayIndex)} style={styles.addExerciseButton}>
                  <Text style={styles.addExerciseText}>+ Agregar otro ejercicio</Text>
                </Pressable>
              </View>
            ))}
            <View style={styles.summaryRow}>
              <Pressable onPress={() => setIsEditingWeek(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={saveCustomRoutine} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Guardar cambios</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
        </> : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Entrenamiento de hoy · {todayName}</Text>
            {todayPlan ? (
              <>
                <Text style={styles.dayTitle}>{todayPlan.title}</Text>
                <Text style={styles.progressText}>Completa los ejercicios y registra tus pesos.</Text>
              </>
            ) : (
              <Text style={styles.emptyState}>No hay entrenamiento programado para hoy.</Text>
            )}
          </View>
        )}

        {activeScreen === 'modify' ? <View style={styles.card}>
          <Text style={styles.sectionTitle}>Progreso semanal</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.progressText}>{completedExercises}/{totalExercises} ejercicios completados</Text>
            <Pressable onPress={resetCurrentWeek} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>Reiniciar semana</Text>
            </Pressable>
          </View>
          <View style={styles.progressBarBackground}>
            <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
          </View>
        </View> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Historial semanal</Text>
          {history.length === 0 ? (
            <Text style={styles.emptyState}>Todavía no hay semanas registradas.</Text>
          ) : (
            history.map((week) => (
              <View key={week.weekKey} style={styles.historyItem}>
                <Text style={styles.historyLabel}>{week.label}</Text>
                <Text style={styles.historyText}>{week.completed}/{week.total} completados</Text>
              </View>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Calendario semanal · {getWeekLabel(savedWeekKey)}</Text>
          {(activeScreen === 'today' ? (todayPlan ? [todayPlan] : []) : routine).map((dayPlan) => (
            <View key={dayPlan.day} style={styles.dayCard}>
              <Text style={styles.dayLabel}>{dayPlan.day}</Text>
              <Text style={styles.dayTitle}>{dayPlan.title}</Text>
              {dayPlan.exercises.map((exercise, exerciseIndex) => {
                const key = getExerciseKey(dayPlan.day, exercise.name, exerciseIndex);
                const currentProgress = weekProgress[key] ?? { done: false, weights: [''] };

                return (
                  <View key={key} style={styles.exerciseRow}>
                    <View style={styles.exerciseHeaderRow}>
                      {exercise.image ? (
                        <Image
                          source={typeof exercise.image === 'number' ? exercise.image : { uri: exercise.image }}
                          style={styles.exerciseImage}
                          resizeMode="cover"
                        />
                      ) : null}
                      <Pressable
                        onPress={() => toggleExerciseDone(dayPlan.day, exercise.name, exerciseIndex)}
                        style={[styles.checkbox, currentProgress.done && styles.checkboxActive]}
                      >
                        {currentProgress.done ? <Text style={styles.checkmark}>✓</Text> : null}
                      </Pressable>

                      <View style={styles.exerciseInfo}>
                        <Text style={styles.exerciseName}>{exercise.name}</Text>
                        <Text style={styles.exerciseMeta}>{exercise.sets} • {exercise.reps}</Text>
                      </View>
                    </View>

                    <Text style={styles.exerciseNote}>{exercise.note}</Text>

                    <View style={styles.weightList}>
                      {(currentProgress.weights ?? ['']).map((weightValue, weightIndex) => (
                        <View key={`${key}-weight-${weightIndex}`} style={styles.weightRow}>
                          <Text style={styles.weightLabel}>Peso {weightIndex + 1}:</Text>
                          <TextInput
                            value={weightValue}
                            onChangeText={(value) => updateWeight(dayPlan.day, exercise.name, exerciseIndex, weightIndex, value)}
                            placeholder="ej. 20 kg"
                            placeholderTextColor="#64748b"
                            style={styles.weightInput}
                          />
                          {currentProgress.weights.length > 1 ? (
                            <Pressable onPress={() => removeWeightEntry(dayPlan.day, exercise.name, exerciseIndex, weightIndex)} style={styles.removeWeightButton}>
                              <Text style={styles.removeWeightText}>−</Text>
                            </Pressable>
                          ) : null}
                        </View>
                      ))}
                    </View>

                    <Pressable onPress={() => addWeightEntry(dayPlan.day, exercise.name, exerciseIndex)} style={styles.addWeightButton}>
                      <Text style={styles.addWeightText}>+ Añadir peso</Text>
                    </Pressable>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
        </View> : null}
      </ScrollView>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b151d',
  },
  appShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0b151d',
  },
  sidebar: {
    width: 220,
    backgroundColor: '#0f1e27',
    borderRightWidth: 1,
    borderRightColor: '#233b47',
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  mainContent: {
    flex: 1,
    minWidth: 0,
  },
  sidebarSubtitle: {
    color: '#27b6f2',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
  },
  sidebarLabel: {
    color: '#5c7b89',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.4,
    marginTop: 32,
    marginBottom: 10,
  },
  sidebarFooter: {
    marginTop: 'auto',
    borderWidth: 1,
    borderColor: '#29434f',
    borderRadius: 14,
    padding: 14,
    backgroundColor: '#132832',
  },
  sidebarFooterTitle: {
    color: '#ffcf3f',
    fontSize: 11,
    fontWeight: '900',
    marginBottom: 6,
  },
  sidebarFooterText: {
    color: '#9ab0bb',
    fontSize: 11,
    lineHeight: 16,
  },
  scrollContent: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    paddingHorizontal: 30,
    paddingTop: 24,
    paddingBottom: 40,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  eyebrow: {
    color: '#27b6f2',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  pageTitle: {
    color: '#f5fbff',
    fontSize: 28,
    fontWeight: '900',
  },
  topbarBadge: {
    backgroundColor: '#162f3d',
    borderWidth: 1,
    borderColor: '#28627a',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  topbarBadgeText: {
    color: '#7ed8ff',
    fontSize: 10,
    fontWeight: '900',
  },
  header: {
    marginBottom: 18,
  },
  navigationRow: {
    flexDirection: 'row',
    marginBottom: 18,
    gap: 10,
  },
  navigationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 11,
    marginBottom: 5,
  },
  navigationButtonActive: {
    backgroundColor: '#1b566c',
    borderWidth: 1,
    borderColor: '#2ebcf2',
  },
  navigationIcon: {
    color: '#5f8493',
    fontSize: 10,
    fontWeight: '900',
    width: 26,
  },
  navigationText: {
    color: '#9ab0bb',
    fontSize: 12,
    fontWeight: '800',
  },
  navigationTextActive: {
    color: '#f3fbff',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 68,
    height: 68,
  },
  title: {
    color: '#f8fafc',
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    color: '#9ab0bb',
    fontSize: 12,
  },
  card: {
    backgroundColor: '#10232c',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#29434f',
  },
  sectionTitle: {
    color: '#f2fbff',
    fontSize: 17,
    fontWeight: '900',
    marginBottom: 14,
  },
  cardDescription: {
    color: '#9ab0bb',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  trainerCodeInput: {
    backgroundColor: '#0c1b23',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#315161',
    color: '#f2fbff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 15,
    letterSpacing: 1,
    marginBottom: 10,
  },
  assignmentMessage: {
    color: '#d7ddb2',
    fontSize: 13,
    marginTop: 12,
    marginBottom: 20,
  },
  assignmentItem: {
    backgroundColor: '#132c37',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#294f5e',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  routineAssignmentItem: {
    backgroundColor: '#1a2d27',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#355744',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  templateItem: {
    backgroundColor: '#1a2d27',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#355744',
    marginBottom: 8,
  },
  templateClientList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  assignmentTrainer: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  assignmentStatus: {
    color: '#d7ddb2',
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  assignmentDetails: {
    flex: 1,
    marginRight: 10,
  },
  assignmentActions: {
    gap: 6,
  },
  acceptButton: {
    backgroundColor: '#27b6f2',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  shareButton: {
    backgroundColor: '#386a7c',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  rejectButton: {
    backgroundColor: '#a9435b',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  actionButtonText: {
    color: '#071923',
    fontSize: 11,
    fontWeight: '800',
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#1b3540',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#ffcf3f',
  },
  chipText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#18242a',
  },
  intensityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  intensityButton: {
    backgroundColor: '#1b3540',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  intensityButtonActive: {
    backgroundColor: '#27b6f2',
  },
  intensityText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  intensityTextActive: {
    color: '#08202b',
  },
  intensityDescription: {
    color: '#cbd5e1',
    marginTop: 8,
    fontSize: 14,
  },
  routineOptions: {
    gap: 8,
    marginBottom: 16,
  },
  routineOption: {
    backgroundColor: '#173541',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2d5666',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  routineOptionActive: {
    backgroundColor: '#27b6f2',
    borderColor: '#7ed8ff',
  },
  routineOptionTitle: {
    color: '#f8fafc',
    fontSize: 14,
    fontWeight: '800',
  },
  routineOptionTitleActive: {
    color: '#122018',
  },
  routineOptionMeta: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    color: '#f8fafc',
    fontSize: 14,
    flex: 1,
  },
  resetButton: {
    backgroundColor: '#b86b55',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  progressBarBackground: {
    height: 10,
    borderRadius: 999,
    backgroundColor: '#1e293b',
    overflow: 'hidden',
    marginTop: 12,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#27b6f2',
    borderRadius: 999,
  },
  historyItem: {
    backgroundColor: '#132c37',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#294f5e',
    marginBottom: 8,
  },
  historyLabel: {
    color: '#f8fafc',
    fontWeight: '700',
    fontSize: 14,
    marginBottom: 2,
  },
  historyText: {
    color: '#cbd5e1',
    fontSize: 12,
  },
  emptyState: {
    color: '#94a3b8',
    fontSize: 12,
  },
  dayCard: {
    backgroundColor: '#132c37',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#294f5e',
  },
  dayLabel: {
    color: '#ffcf3f',
    fontWeight: '800',
    fontSize: 14,
    marginBottom: 4,
  },
  dayTitle: {
    color: '#f8fafc',
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 8,
  },
  exerciseRow: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1f2937',
    paddingBottom: 10,
  },
  exerciseHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseImage: {
    width: 140,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#26352d',
    marginRight: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#94a3b8',
    marginRight: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0f172a',
  },
  checkboxActive: {
    backgroundColor: '#27b6f2',
    borderColor: '#27b6f2',
  },
  checkmark: {
    color: '#052e16',
    fontWeight: '800',
    fontSize: 14,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: '#f8fafc',
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseMeta: {
    color: '#cbd5e1',
    fontSize: 12,
    marginTop: 2,
  },
  exerciseNote: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 8,
  },
  weightList: {
    gap: 8,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  weightLabel: {
    color: '#cbd5e1',
    fontSize: 12,
    marginRight: 8,
    minWidth: 62,
  },
  weightInput: {
    flex: 1,
    backgroundColor: '#0c1b23',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#315161',
    color: '#f8fafc',
    paddingHorizontal: 10,
    paddingVertical: 6,
    fontSize: 12,
  },
  removeWeightButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  removeWeightText: {
    color: '#f8fafc',
    fontSize: 16,
    fontWeight: '700',
    lineHeight: 16,
  },
  addWeightButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#617a59',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  defaultButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#738f6a',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginTop: 8,
  },
  defaultButtonText: {
    color: '#eff6ff',
    fontSize: 12,
    fontWeight: '700',
  },
  editorExerciseCard: {
    marginBottom: 10,
    backgroundColor: '#173541',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#2d5666',
  },
  editorExerciseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  editorExerciseLabel: {
    color: '#ffcf3f',
    fontSize: 12,
    fontWeight: '800',
  },
  removeExerciseButton: {
    backgroundColor: '#5b3030',
    borderRadius: 7,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  removeExerciseText: {
    color: '#fecaca',
    fontSize: 11,
    fontWeight: '700',
  },
  addExerciseButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#617a59',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 2,
  },
  addExerciseText: {
    color: '#eff6ff',
    fontSize: 12,
    fontWeight: '700',
  },
  editorInlineRow: {
    flexDirection: 'row',
    gap: 8,
  },
  editorHalfInput: {
    flex: 1,
  },
  editorTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  editorInput: {
    backgroundColor: '#0c1b23',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#315161',
    color: '#f2fbff',
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
    fontSize: 12,
  },
  imagePickerButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#738f6a',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginBottom: 8,
  },
  imagePickerButtonText: {
    color: '#122018',
    fontSize: 12,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: '#27b6f2',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#071923',
    fontWeight: '800',
    fontSize: 12,
  },
  secondaryButton: {
    backgroundColor: '#29434f',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  secondaryButtonText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 12,
  },  addWeightText: {
    color: '#eff6ff',
    fontSize: 12,
    fontWeight: '700',
  },
});

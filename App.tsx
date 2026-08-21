import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
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
  loadTrainerAssignments,
} from './src/services/workoutStorage';
import type { TrainerAssignment } from './src/types/user';


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

type AppScreen = 'modify' | 'today' | 'trainer';

const getTodayName = () => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date().getDay()];
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
  const [trainerCode, setTrainerCode] = useState('');
  const [assignmentMessage, setAssignmentMessage] = useState('');
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
    setEditorRoutine(createBlankRoutine());
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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image source={require('./assets/images/logo.png')} style={styles.logo} resizeMode="contain" />
            <View>
              <Text style={styles.title}>FitFlow</Text>
              <Text style={styles.subtitle}>Plan de 5 días · Masa + tonificación</Text>
            </View>
          </View>
        </View>

        <View style={styles.navigationRow}>
          <Pressable
            onPress={() => setActiveScreen('today')}
            style={[styles.navigationButton, activeScreen === 'today' && styles.navigationButtonActive]}
          >
            <Text style={[styles.navigationText, activeScreen === 'today' && styles.navigationTextActive]}>Entrenamiento de hoy</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveScreen('modify')}
            style={[styles.navigationButton, activeScreen === 'modify' && styles.navigationButtonActive]}
          >
            <Text style={[styles.navigationText, activeScreen === 'modify' && styles.navigationTextActive]}>Modificar rutina</Text>
          </Pressable>
          <Pressable
            onPress={() => setActiveScreen('trainer')}
            style={[styles.navigationButton, activeScreen === 'trainer' && styles.navigationButtonActive]}
          >
            <Text style={[styles.navigationText, activeScreen === 'trainer' && styles.navigationTextActive]}>Mi entrenador</Text>
          </Pressable>
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
                  <View>
                    <Text style={styles.assignmentTrainer}>Código: {assignment.trainerId}</Text>
                    <Text style={styles.historyText}>Solicitud enviada</Text>
                  </View>
                  <Text style={styles.assignmentStatus}>{assignment.status}</Text>
                </View>
              ))
            )}
          </View>
        ) : null}

        {activeScreen !== 'trainer' ? <View>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#171b1a',
  },
  scrollContent: {
    width: '100%',
    maxWidth: 1180,
    alignSelf: 'center',
    padding: 20,
    paddingBottom: 40,
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
    flex: 1,
    backgroundColor: '#26352d',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  navigationButtonActive: {
    backgroundColor: '#7e9b6d',
  },
  navigationText: {
    color: '#cbd5e1',
    fontWeight: '700',
    textAlign: 'center',
  },
  navigationTextActive: {
    color: '#102018',
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
    fontSize: 32,
    fontWeight: '800',
  },
  subtitle: {
    color: '#cbd5e1',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#17251f',
    borderRadius: 18,
    padding: 18,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#355744',
  },
  sectionTitle: {
    color: '#edf5e8',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  cardDescription: {
    color: '#cbd5e1',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  trainerCodeInput: {
    backgroundColor: '#23352d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d5f4d',
    color: '#f8fafc',
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  chip: {
    backgroundColor: '#2b362f',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginRight: 8,
    marginBottom: 8,
  },
  chipActive: {
    backgroundColor: '#7e9b6d',
  },
  chipText: {
    color: '#e2e8f0',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextActive: {
    color: '#102018',
  },
  intensityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  intensityButton: {
    backgroundColor: '#2b362f',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginRight: 8,
    marginBottom: 8,
  },
  intensityButtonActive: {
    backgroundColor: '#a4b98e',
  },
  intensityText: {
    color: '#e2e8f0',
    fontWeight: '700',
  },
  intensityTextActive: {
    color: '#17211b',
  },
  intensityDescription: {
    color: '#cbd5e1',
    marginTop: 8,
    fontSize: 14,
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
    backgroundColor: '#7e9b6d',
    borderRadius: 999,
  },
  historyItem: {
    backgroundColor: '#1a2d27',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#355744',
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
    backgroundColor: '#1a2d27',
    borderRadius: 14,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#355744',
  },
  dayLabel: {
    color: '#d7ddb2',
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
    backgroundColor: '#7e9b6d',
    borderColor: '#7e9b6d',
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
    backgroundColor: '#223a31',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d5f4d',
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
    backgroundColor: '#1f352d',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#3d5f4d',
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
    backgroundColor: '#23352d',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3d5f4d',
    color: '#f8fafc',
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
    backgroundColor: '#7e9b6d',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#122018',
    fontWeight: '800',
    fontSize: 12,
  },
  secondaryButton: {
    backgroundColor: '#334155',
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

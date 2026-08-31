import React, { useEffect, useMemo, useState } from 'react';
import {
  Animated,
  Platform,
  Pressable as NativePressable,
  SafeAreaView,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
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
  loadUserProfile,
  removeRoutineAssignment,
  removeRoutineTemplate,
  saveUserProfile,
  updateTrainerAssignmentStatus,
} from './src/services/workoutStorage';
import {
  loginUser,
  loginWithGoogleIdToken,
  loginWithGoogleWeb,
  logoutUser,
  onAuthStateChange,
  registerUser,
  resetUserPassword,
} from './src/services/authService';
import type { RoutineAssignment, RoutineTemplate, TrainerAssignment, UserProfile } from './src/types/user';
import type { User as FirebaseUser } from 'firebase/auth';

WebBrowser.maybeCompleteAuthSession();


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

const createEmptyProfile = (): UserProfile => ({
  id: 'local-user',
  name: '',
  email: '',
  role: 'user',
  level: 'Principiante',
  goals: [],
  equipment: [],
  dailyMinutes: 45,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const normalizeGoal = (goalValue?: string): 'fuerza' | 'masa' | 'resistencia' | 'tonificacion' => {
  const value = String(goalValue ?? '').trim().toLowerCase();
  if (!value) return 'fuerza';
  if (value.includes('masa') || value.includes('hipertrofia')) return 'masa';
  if (value.includes('resist') || value.includes('cardio') || value.includes('condicion')) return 'resistencia';
  if (value.includes('ton') || value.includes('defin') || value.includes('estilo')) return 'tonificacion';
  return 'fuerza';
};

const getRecommendedIntensity = (level?: UserProfile['level']): Intensity => {
  if (level === 'Avanzado') return 'Alta';
  if (level === 'Intermedio') return 'Media';
  return 'Baja';
};

const getRoutine = (
  selectedEquipment: EquipmentName[],
  intensity: Intensity,
  userGoal?: string,
  dailyMinutes = 45,
): RoutineDay[] => {
  const multiplier = intensityMultiplier[intensity];
  const goal = normalizeGoal(userGoal);
  const hasBarra = selectedEquipment.includes('Barra Olímpica');
  const hasMancuernas = selectedEquipment.includes('Mancuernas');
  const hasCardio = selectedEquipment.includes('Caminadora');
  const hasBanco = selectedEquipment.includes('Banco');
  const hasBandas = selectedEquipment.includes('Bandas');
  const durationFactor = dailyMinutes <= 30 ? 0.8 : dailyMinutes <= 45 ? 1 : dailyMinutes <= 60 ? 1.18 : 1.35;
  const sets = (base: number) => `${Math.max(2, Math.round(base * multiplier * durationFactor))} series`;

  if (dailyMinutes <= 30) {
    return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'].map((day) => ({
      day,
      title: 'Tiempo insuficiente para el plan semanal',
      exercises: [{
        name: 'Movilidad y caminata ligera',
        sets: '1 serie',
        reps: '10-15 min',
        note: 'Indica más de 30 minutos diarios para recibir una rutina semanal personalizada.',
      }],
    }));
  }

  const goalTitles: Record<typeof goal, { push: string; lower: string; cardio: string; core: string }> = {
    fuerza: {
      push: 'Empuje + fuerza',
      lower: 'Piernas + potencia',
      cardio: 'Tracción + hombros',
      core: 'Fuerza + abdomen',
    },
    masa: {
      push: 'Volumen + pecho',
      lower: 'Piernas + hipertrofia',
      cardio: 'Espalda + hombros',
      core: 'Masa + resistencia',
    },
    resistencia: {
      push: 'Resistencia + fuerza',
      lower: 'Piernas + cardio',
      cardio: 'Tracción + acondicionamiento',
      core: 'Core + energía',
    },
    tonificacion: {
      push: 'Tonificación + empuje',
      lower: 'Piernas + definicion',
      cardio: 'Espalda + postura',
      core: 'Core + control',
    },
  };

  const plan = [
    {
      day: 'Lunes',
      title: goalTitles[goal].push,
      exercises: [
        { name: hasBarra ? 'Press de banca' : hasMancuernas ? 'Press inclinado con mancuernas' : 'Press con mancuernas', sets: sets(goal === 'resistencia' ? 3 : 4), reps: goal === 'resistencia' ? '8-12' : '6-10', note: goal === 'fuerza' ? 'empuje horizontal con control total y hombros estables' : goal === 'masa' ? 'volumen progresivo para ganar fuerza útil y tono' : goal === 'tonificacion' ? 'movimiento limpio y control muscular' : 'baja con control y mantiene la técnica' },
        { name: hasMancuernas ? 'Fly de pecho' : hasBanco ? 'Dip en banco' : 'Flexiones', sets: sets(3), reps: goal === 'resistencia' ? '10-15' : '8-12', note: 'acción de pecho con control y sinBalance arrastrado' },
        { name: hasCardio ? 'Intervalos en caminadora' : 'Mountain climbers', sets: sets(goal === 'resistencia' ? 4 : 3), reps: hasCardio ? '30s/30s' : '20-30s', note: 'aceleración moderada para sostener la intensidad del día' },
      ],
    },
    {
      day: 'Martes',
      title: goalTitles[goal].lower,
      exercises: [
        { name: hasBarra ? 'Sentadilla con barra' : hasMancuernas ? 'Zancadas con mancuernas' : 'Sentadilla goblet', sets: sets(4), reps: goal === 'resistencia' ? '8-12' : '6-10', note: 'profundidad controlada y pie estable para generar fuerza en piernas' },
        { name: hasBarra ? 'Peso muerto' : hasMancuernas ? 'Peso muerto con mancuernas' : 'Step-up', sets: sets(3), reps: goal === 'resistencia' ? '8-12' : '6-8', note: 'bisagra de cadera con torso alineado y glúteos activos' },
        { name: hasMancuernas ? 'Puente de glúteos' : 'Step-up', sets: sets(3), reps: '12-15', note: 'actividad de cadera para estabilidad y fuerza general' },
      ],
    },
    {
      day: 'Miércoles',
      title: goalTitles[goal].cardio,
      exercises: [
        { name: hasBarra ? 'Dominadas' : hasBandas ? 'Remo con banda' : 'Remo apoyado', sets: sets(4), reps: goal === 'resistencia' ? '8-12' : '6-10', note: 'tracción con espalda y hombros acoplados para mantener postura' },
        { name: hasMancuernas ? 'Press militar con mancuernas' : hasBandas ? 'Press de hombro con banda' : 'Press de hombro', sets: sets(3), reps: '8-12', note: 'carga estable y hombros alineados con la caja torácica' },
        { name: hasCardio ? 'Caminata inclinada' : 'Band pull apart', sets: sets(goal === 'resistencia' ? 4 : 3), reps: hasCardio ? '15-20 min' : '12-15', note: 'mantén la intensidad constante sin perder técnica ni respiración' },
      ],
    },
    {
      day: 'Jueves',
      title: goal === 'resistencia' ? 'Cardio + leg day' : 'Accesorios + volumen',
      exercises: [
        { name: hasMancuernas ? 'Curl biceps alterno' : 'Curl con banda', sets: sets(3), reps: goal === 'masa' ? '8-12' : '10-15', note: 'flexión de codo con control total y tiempo bajo tensión' },
        { name: hasMancuernas ? 'Elevaciones laterales' : 'Band pull apart', sets: sets(3), reps: '12-15', note: 'ejercicio de hombro y postura para un movimiento más estable' },
        { name: hasCardio ? 'Cardio HIIT' : 'Burpees', sets: sets(goal === 'resistencia' ? 5 : 3), reps: hasCardio ? '30s/30s' : '8-12', note: 'tono y energía para cerrar con una sesión más exigente' },
      ],
    },
    {
      day: 'Viernes',
      title: goalTitles[goal].core,
      exercises: [
        { name: hasCardio ? 'Cardio HIIT' : 'Marcha vigorosa', sets: sets(goal === 'resistencia' ? 2 : 1), reps: hasCardio ? '10-15 min' : '15-20 min', note: 'concluye con un trabajo cardiovascular y energía sostenida' },
        { name: 'Plancha abdominal', sets: sets(3), reps: '30-45s', note: 'core activado, cadera alineada y tensión constante' },
        { name: 'Abdominales crunch', sets: sets(3), reps: '12-20', note: 'tracción abdominal sin forzar cuello ni espalda' },
        { name: 'Puente de glúteos', sets: sets(3), reps: '12-15', note: 'ayuda a cerrar la semana con glúteos y columna más estables' },
      ],
    },
  ];

  return plan.map((dayPlan) => ({
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

type AppScreen = 'modify' | 'today' | 'routines' | 'trainer' | 'trainerPanel' | 'profile';
type AuthMode = 'login' | 'register';

const AnimatedSection = ({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) => {
  const motion = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    motion.setValue(0);
    Animated.sequence([
      Animated.delay(delay),
      Animated.timing(motion, {
        toValue: 1,
        duration: 360,
        useNativeDriver: Platform.OS !== 'web',
      }),
    ]).start();
  }, [delay, motion]);

  return (
    <Animated.View
      style={{
        opacity: motion,
        transform: [{ translateY: motion.interpolate({ inputRange: [0, 1], outputRange: [-18, 0] }) }],
      }}
    >
      {children}
    </Animated.View>
  );
};

const AnimatedButton = ({ children, style, onPress, ...props }: React.ComponentProps<typeof NativePressable>) => {
  const scale = React.useRef(new Animated.Value(1)).current;
  const [isPressed, setIsPressed] = React.useState(false);
  const [isReleasing, setIsReleasing] = React.useState(false);

  const animateScale = (toValue: number) => {
    Animated.spring(scale, {
      toValue,
      friction: 7,
      tension: 160,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return (
    <NativePressable
      {...props}
      onPress={onPress}
      onPressIn={() => {
        setIsPressed(true);
        animateScale(0.94);
      }}
      onPressOut={() => {
        setIsPressed(false);
        setIsReleasing(true);
        animateScale(1.04);
        setTimeout(() => {
          setIsReleasing(false);
          animateScale(1);
        }, 170);
      }}
      style={typeof style === 'function'
        ? (state) => [style(state), { transform: [{ scale: isPressed ? 0.94 : isReleasing ? 1.04 : 1 }], opacity: isPressed ? 0.68 : 1 }]
        : [style, { transform: [{ scale: isPressed ? 0.94 : isReleasing ? 1.04 : 1 }], opacity: isPressed ? 0.68 : 1 }]}
    >
      {children}
    </NativePressable>
  );
};

const Pressable = AnimatedButton;

const AnimatedCheckmark = ({ visible }: { visible: boolean }) => {
  const motion = React.useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) {
      motion.setValue(0);
      return;
    }

    motion.setValue(0);
    Animated.spring(motion, {
      toValue: 1,
      friction: 5,
      tension: 180,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [motion, visible]);

  return (
    <Animated.Text
      style={[
        styles.checkmark,
        {
          opacity: motion,
          transform: [
            { scale: motion.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) },
            { rotate: motion.interpolate({ inputRange: [0, 1], outputRange: ['-35deg', '0deg'] }) },
          ],
        },
      ]}
    >
      {visible ? '✓' : ''}
    </Animated.Text>
  );
};

const getTodayName = () => {
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[new Date().getDay()];
};

const createRoutineShareLink = (
  title: string,
  routine: RoutineDay[],
  requirements?: { equipment?: string[]; intensity?: Intensity },
) => {
  if (typeof window === 'undefined') return '';
  const payload = encodeURIComponent(JSON.stringify({ title, routine, ...requirements }));
  return `${window.location.origin}${window.location.pathname}?sharedRoutine=${payload}`;
};

const readSharedRoutineFromUrl = (): { title: string; routine: RoutineDay[]; equipment?: string[]; intensity?: Intensity } | null => {
  if (typeof window === 'undefined') return null;
  const encodedRoutine = new URLSearchParams(window.location.search).get('sharedRoutine');
  if (!encodedRoutine) return null;

  try {
    const parsed = JSON.parse(decodeURIComponent(encodedRoutine)) as Partial<{
      title: string;
      routine: RoutineDay[];
      equipment: string[];
      intensity: Intensity;
    }>;
    if (!parsed.title || !Array.isArray(parsed.routine) || parsed.routine.length === 0) return null;
    return {
      title: parsed.title,
      routine: parsed.routine,
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : undefined,
      intensity: parsed.intensity,
    };
  } catch {
    return null;
  }
};

export default function App() {
  const { width: viewportWidth } = useWindowDimensions();
  const isCompactLayout = viewportWidth < 860;
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarContentVisible, setSidebarContentVisible] = useState(true);
  const sidebarWidth = React.useRef(new Animated.Value(240)).current;
  const sidebarContentOpacity = React.useRef(new Animated.Value(1)).current;
  const pageMotion = React.useRef(new Animated.Value(0)).current;
  const currentWeekKey = getWeekKey(new Date());
  const [activeScreen, setActiveScreen] = useState<AppScreen>('today');
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentName[]>(['Barra Olímpica', 'Mancuernas', 'Caminadora', 'Banco', 'Bandas', 'Suelo / Colchonetas']);
  const [intensity, setIntensity] = useState<Intensity>('Baja');
  const [draftEquipment, setDraftEquipment] = useState<EquipmentName[]>(['Barra Olímpica', 'Mancuernas', 'Caminadora', 'Banco', 'Bandas', 'Suelo / Colchonetas']);
  const [draftIntensity, setDraftIntensity] = useState<Intensity>('Media');
  const [dailyMinutes, setDailyMinutes] = useState<number>(45);
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
  const [profile, setProfile] = useState<UserProfile>(() => createEmptyProfile());
  const [profileMessage, setProfileMessage] = useState('');
  const [signOutConfirmVisible, setSignOutConfirmVisible] = useState(false);
  const [isEditingWeek, setIsEditingWeek] = useState(false);
  const [editorRoutine, setEditorRoutine] = useState<RoutineDay[]>(() =>
    normalizeRoutine(null, getRoutine(['Barra Olímpica', 'Mancuernas', 'Caminadora', 'Banco', 'Bandas', 'Suelo / Colchonetas'], 'Baja')),
  );
  const [sessionUser, setSessionUser] = useState<FirebaseUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  const [authLoading, setAuthLoading] = useState(false);
  const [passwordResetLoading, setPasswordResetLoading] = useState(false);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);
  const [authPromptVisible, setAuthPromptVisible] = useState(false);
  const [authPromptText, setAuthPromptText] = useState('');
  const authGlow = React.useRef(new Animated.Value(0)).current;
  const authShake = React.useRef(new Animated.Value(0)).current;
  const currentUserId = sessionUser?.uid ?? 'local-client';
  const isGuest = !sessionUser;
  const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  const googleAndroidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID;
  const hasGoogleAuthConfig = Boolean(googleWebClientId || googleIosClientId || googleAndroidClientId);
  const [, googleResponse, promptGoogleAuth] = Google.useAuthRequest({
    clientId: process.env.EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID,
    iosClientId: googleIosClientId,
    androidClientId: googleAndroidClientId,
    webClientId: googleWebClientId || 'missing-web-client-id.apps.googleusercontent.com',
  });

  const defaultRoutine = useMemo(
    () => getRoutine(selectedEquipment, intensity, profile.goals?.[0], dailyMinutes),
    [selectedEquipment, intensity, profile.goals, dailyMinutes],
  );
  const draftRoutine = useMemo(
    () => getRoutine(draftEquipment, draftIntensity, profile.goals?.[0], dailyMinutes),
    [draftEquipment, draftIntensity, profile.goals, dailyMinutes],
  );
  const routine = useMemo(
    () => normalizeRoutine(customRoutine, defaultRoutine),
    [customRoutine, defaultRoutine],
  );
  const totalExercises = routine.reduce((count, day) => count + day.exercises.length, 0);
  const completedExercises = countCompletedExercises(weekProgress);
  const progressPercent = totalExercises > 0 ? Math.round((completedExercises / totalExercises) * 100) : 0;
  const todayName = getTodayName();
  const todayPlan = routine.find((dayPlan) => dayPlan.day === todayName);

  useEffect(() => {
    pageMotion.setValue(0);
    Animated.timing(pageMotion, {
      toValue: 1,
      duration: 560,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [activeScreen, pageMotion]);

  const toggleSidebar = () => {
    const nextCollapsed = !sidebarCollapsed;
    if (nextCollapsed) {
      Animated.timing(sidebarContentOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: Platform.OS !== 'web',
      }).start(() => {
        setSidebarContentVisible(false);
        setSidebarCollapsed(true);
      });
    } else {
      setSidebarCollapsed(false);
      setSidebarContentVisible(true);
      sidebarContentOpacity.setValue(0);
      Animated.sequence([
        Animated.delay(180),
        Animated.timing(sidebarContentOpacity, {
          toValue: 1,
          duration: 180,
          useNativeDriver: Platform.OS !== 'web',
        }),
      ]).start();
    }
    Animated.timing(sidebarWidth, {
      toValue: nextCollapsed ? 112 : 240,
      duration: 260,
      useNativeDriver: false,
    }).start();
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChange((user) => {
      setSessionUser(user);
      setAuthReady(true);
      if (user) {
        setAuthMessage('');
      }
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    let isCurrentSession = true;

    if (!sessionUser) {
      setProfile(createEmptyProfile());
      return () => {
        isCurrentSession = false;
      };
    }

    setProfile((current) => ({
      ...current,
      id: sessionUser.uid,
      name: sessionUser.displayName ?? '',
      email: sessionUser.email ?? '',
      updatedAt: new Date().toISOString(),
    }));

    const loadProfile = async () => {
      const savedProfile = await loadUserProfile();
      if (isCurrentSession && savedProfile) {
        setProfile(savedProfile);
        if (typeof savedProfile.dailyMinutes === 'number') {
          setDailyMinutes(savedProfile.dailyMinutes);
        }
        if (Array.isArray(savedProfile.equipment)) {
          setSelectedEquipment(savedProfile.equipment.filter((item): item is EquipmentName => equipmentList.includes(item as EquipmentName)));
        }
        setIntensity(getRecommendedIntensity(savedProfile.level));
      }
    };

    void loadProfile();

    return () => {
      isCurrentSession = false;
    };
  }, [sessionUser]);

  useEffect(() => {
    const resolveGoogleAuth = async () => {
      if (!googleResponse || Platform.OS === 'web') return;

      if (googleResponse.type === 'success') {
        const idToken =
          googleResponse.authentication?.idToken
          || (typeof googleResponse.params?.id_token === 'string' ? googleResponse.params.id_token : undefined);

        if (!idToken) {
          setAuthMessage('No se obtuvo token de Google.');
          return;
        }

        try {
          setGoogleAuthLoading(true);
          setAuthMessage('');
          await loginWithGoogleIdToken(idToken);
          setAuthPromptVisible(false);
          setAuthPromptText('');
        } catch {
          setAuthMessage('No se pudo iniciar con Google. Intenta de nuevo.');
        } finally {
          setGoogleAuthLoading(false);
        }
      }
    };

    void resolveGoogleAuth();
  }, [googleResponse]);

  useEffect(() => {
    if (!authReady) return;

    const loadState = async () => {
      try {
        const saved = await loadProgressState();
        const parsedHistoryFromStorage = await loadHistory();
        const savedRoutine = await loadCustomRoutine();
        const savedAssignments = await loadTrainerAssignments();
        const savedRoutineAssignments = await loadRoutineAssignments();
        const savedRoutineTemplates = await loadRoutineTemplates();
        const savedProfile = await loadUserProfile();
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
        if (sessionUser && savedProfile) {
          setProfile(savedProfile);
        } else if (sessionUser) {
          setProfile((current) => ({
            ...current,
            id: currentUserId,
            name: sessionUser.displayName ?? current.name,
            email: sessionUser.email ?? current.email,
            updatedAt: new Date().toISOString(),
          }));
        } else {
          setProfile(createEmptyProfile());
        }
        if (sharedRoutine) {
          if (sessionUser) {
            const importedTemplate = await createRoutineTemplate(
              currentUserId,
              sharedRoutine.title,
              sharedRoutine.routine,
              'user',
            );
            const templatesWithSharedRoutine = [...savedRoutineTemplates, importedTemplate];
            setRoutineTemplates(templatesWithSharedRoutine);
            setRoutineAssignmentMessage(`Se importó "${sharedRoutine.title}" desde el enlace.`);
          } else {
            const previewRoutine = normalizeRoutine(sharedRoutine.routine, routine);
            setCustomRoutine(previewRoutine);
            setEditorRoutine(previewRoutine);
            setRoutineAssignmentMessage('Estás viendo una rutina compartida. Regístrate para guardarla o editarla.');
          }
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
  }, [authReady, sessionUser, currentUserId]);

  const requireAuthForAction = (actionLabel: string) => {
    if (!isGuest) return true;
    setAuthMode('login');
    setAuthPromptText(`Para ${actionLabel}, inicia sesión.`);
    setAuthMessage('');
    setAuthPromptVisible(true);
    authGlow.setValue(0);
    authShake.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(authGlow, { toValue: 1, duration: 170, useNativeDriver: false }),
        Animated.timing(authGlow, { toValue: 0.2, duration: 170, useNativeDriver: false }),
        Animated.timing(authGlow, { toValue: 1, duration: 170, useNativeDriver: false }),
      ]),
      Animated.sequence([
        Animated.timing(authShake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(authShake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(authShake, { toValue: -0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(authShake, { toValue: 0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(authShake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
    ]).start();
    return false;
  };

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
    if (!customRoutine) {
      setWeekProgress((current) => mergeProgressWithRoutine(current, defaultRoutine));
    }
  }, [customRoutine, defaultRoutine]);

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
    if (!requireAuthForAction('modificar tu equipo')) return;
    setSelectedEquipment((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  };

  const toggleDraftEquipment = (item: EquipmentName) => {
    if (!requireAuthForAction('modificar el equipo de esta rutina')) return;
    setDraftEquipment((current) =>
      current.includes(item) ? current.filter((value) => value !== item) : [...current, item],
    );
  };

  const toggleExerciseDone = (day: string, exerciseName: string, index: number) => {
    if (!requireAuthForAction('registrar progreso')) return;
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
    if (!requireAuthForAction('guardar pesos')) return;
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
    if (!requireAuthForAction('agregar pesos')) return;
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
    if (!requireAuthForAction('editar pesos')) return;
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
    if (!requireAuthForAction('reiniciar tu semana')) return;
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
    if (!requireAuthForAction('editar la rutina')) return;
    const safeRoutine = normalizeRoutine(customRoutine ?? draftRoutine, defaultRoutine);
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
    if (!requireAuthForAction('crear una rutina')) return;
    setSelectedEditRoutineId('new');
    setEditorRoutine(createBlankRoutine());
    setIsEditingWeek(true);
  };

  const editSelectedRoutine = (routineId: string, selectedRoutine: RoutineDay[]) => {
    if (!requireAuthForAction('modificar una rutina')) return;
    setSelectedEditRoutineId(routineId);
    setEditorRoutine(normalizeRoutine(selectedRoutine, routine));
    setIsEditingWeek(true);
  };

  const updateEditorExercise = (dayIndex: number, exerciseIndex: number, field: 'name' | 'sets' | 'reps' | 'note' | 'image', value: string) => {
    if (!requireAuthForAction('editar ejercicios')) return;
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
    if (!requireAuthForAction('agregar ejercicios')) return;
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
    if (!requireAuthForAction('eliminar ejercicios')) return;
    setEditorRoutine((current) => current.map((day, currentDayIndex) => {
      if (currentDayIndex !== dayIndex || day.exercises.length <= 1) return day;
      return {
        ...day,
        exercises: day.exercises.filter((_, currentExerciseIndex) => currentExerciseIndex !== exerciseIndex),
      };
    }));
  };

  const pickExerciseImage = async (dayIndex: number, exerciseIndex: number) => {
    if (!requireAuthForAction('cambiar imágenes de ejercicios')) return;
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

  const pickProfileImage = async () => {
    if (!requireAuthForAction('cambiar foto de perfil')) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]?.uri) {
      setProfile((current) => ({
        ...current,
        avatarUrl: result.assets[0].uri,
        updatedAt: new Date().toISOString(),
      }));
      setProfileMessage('Imagen seleccionada. Guarda el perfil para conservarla.');
    }
  };

  const saveCustomRoutine = async () => {
    if (!requireAuthForAction('guardar una rutina')) return;
    const safeRoutine = normalizeRoutine(editorRoutine, routine);
    setCustomRoutine(safeRoutine);
    setIsEditingWeek(false);
    const resetProgress = createDefaultProgress(safeRoutine);
    setWeekProgress(resetProgress);
    await saveRoutineToStorage(safeRoutine);
    await saveProgressState({ weekKey: savedWeekKey, progress: resetProgress });
  };
  
  const resetRoutineToDefault = async () => {
    if (!requireAuthForAction('restablecer la rutina')) return;
    const nextRoutine = normalizeRoutine(defaultRoutine, routine);
    setCustomRoutine(null);
    setEditorRoutine(nextRoutine);
    const resetProgress = createDefaultProgress(nextRoutine);
    setWeekProgress(resetProgress);
    await removeCustomRoutine();
    await saveProgressState({ weekKey: savedWeekKey, progress: resetProgress });
  };

  const sendTrainerRequest = async () => {
    if (!requireAuthForAction('enviar solicitudes a entrenador')) return;
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

    const assignment = await createTrainerAssignment(normalizedCode, currentUserId);
    setTrainerAssignments((current) => [...current, assignment]);
    setTrainerCode('');
    setAssignmentMessage('Solicitud enviada. El entrenador debe aceptarla.');
  };

  const changeAssignmentStatus = async (assignmentId: string, status: 'active' | 'rejected') => {
    if (!requireAuthForAction('gestionar solicitudes')) return;
    const updatedAssignment = await updateTrainerAssignmentStatus(assignmentId, status);
    if (!updatedAssignment) return;

    setTrainerAssignments((current) => current.map((assignment) => (
      assignment.id === assignmentId ? updatedAssignment : assignment
    )));
  };

  const endTrainerConnection = async (assignmentId: string) => {
    if (!requireAuthForAction('terminar conexiones')) return;
    const updatedAssignment = await updateTrainerAssignmentStatus(assignmentId, 'ended');
    if (!updatedAssignment) return;

    setTrainerAssignments((current) => current.map((assignment) => (
      assignment.id === assignmentId ? updatedAssignment : assignment
    )));
    setRoutineAssignmentMessage('La relación con el entrenador ha terminado.');
  };

  const deleteSavedRoutine = async (templateId: string) => {
    if (!requireAuthForAction('eliminar rutinas')) return;
    await removeRoutineTemplate(templateId);
    setRoutineTemplates((current) => current.filter((template) => template.id !== templateId));
    setRoutineAssignmentMessage('La rutina guardada fue eliminada.');
  };

  const deleteRoutineFromHistory = async (assignmentId: string) => {
    if (!requireAuthForAction('eliminar historial')) return;
    await removeRoutineAssignment(assignmentId);
    setRoutineAssignments((current) => current.filter((assignment) => assignment.id !== assignmentId));
    setRoutineAssignmentMessage('La rutina del historial fue eliminada.');
  };

  const assignRoutineToClient = async (clientAssignment: TrainerAssignment) => {
    if (!requireAuthForAction('asignar rutinas')) return;
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
    if (!requireAuthForAction('guardar plantillas')) return;
    const title = routineTitle.trim();
    if (!title) {
      setRoutineAssignmentMessage('Escribe un nombre para guardar la plantilla.');
      return;
    }

    const template = await createRoutineTemplate(currentUserId, title, draftRoutine, 'trainer', {
      equipment: draftEquipment,
      intensity: draftIntensity,
    });
    setRoutineTemplates((current) => [...current, template]);
    setRoutineAssignmentMessage(`Plantilla "${template.title}" guardada.`);
  };

  const assignTemplateToClient = async (template: RoutineTemplate, clientAssignment: TrainerAssignment) => {
    if (!requireAuthForAction('asignar plantillas')) return;
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
    if (!requireAuthForAction('guardar tu rutina')) return;
    const title = routineTitle.trim();
    if (!title) {
      setRoutineAssignmentMessage('Escribe un nombre para guardar tu rutina.');
      return;
    }

    const template = await createRoutineTemplate(currentUserId, title, draftRoutine, 'user', {
      equipment: draftEquipment,
      intensity: draftIntensity,
    });
    setRoutineTemplates((current) => [...current, template]);
    setRoutineAssignmentMessage(`Tu rutina "${template.title}" quedó guardada.`);
  };

  const shareRoutine = async (
    title: string,
    sharedRoutine: RoutineDay[],
    requirements?: { equipment?: string[]; intensity?: Intensity },
  ) => {
    const link = createRoutineShareLink(title, sharedRoutine, requirements);
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
    if (!requireAuthForAction('usar esta rutina')) return;
    const nextRoutine = normalizeRoutine(template.routine, routine);
    setCustomRoutine(nextRoutine);
    setEditorRoutine(nextRoutine);
    setWeekProgress(createDefaultProgress(nextRoutine));
    await saveRoutineToStorage(nextRoutine);
    await saveProgressState({ weekKey: savedWeekKey, progress: createDefaultProgress(nextRoutine) });
    setRoutineAssignmentMessage(`Ahora estás usando "${template.title}".`);
  };

  const activateAssignedRoutine = async (assignment: RoutineAssignment) => {
    if (!requireAuthForAction('activar rutinas asignadas')) return;
    const nextRoutine = normalizeRoutine(assignment.routine, routine);
    setCustomRoutine(nextRoutine);
    setEditorRoutine(nextRoutine);
    setWeekProgress(createDefaultProgress(nextRoutine));
    await saveRoutineToStorage(nextRoutine);
    await saveProgressState({ weekKey: savedWeekKey, progress: createDefaultProgress(nextRoutine) });
    setRoutineAssignmentMessage(`Ahora estás usando "${assignment.title}".`);
  };

  const updateProfileField = (field: 'name' | 'email' | 'level', value: string) => {
    setProfile((current) => ({ ...current, [field]: value, updatedAt: new Date().toISOString() }));
    setProfileMessage('');
  };

  const saveProfile = async () => {
    if (!requireAuthForAction('guardar perfil')) return;
    if (!profile.name.trim() || !profile.email.trim()) {
      setProfileMessage('Completa tu nombre y correo para guardar el perfil.');
      return;
    }

    const nextProfile = {
      ...profile,
      id: currentUserId,
      name: profile.name.trim(),
      email: profile.email.trim(),
      equipment: selectedEquipment,
      dailyMinutes,
      updatedAt: new Date().toISOString(),
    };
    setProfile(nextProfile);
    await saveUserProfile(nextProfile);
    setProfileMessage('Perfil guardado correctamente.');
  };

  const submitAuth = async () => {
    const email = authEmail.trim();
    const password = authPassword.trim();
    const name = authName.trim();

    if (!email || !password) {
      setAuthMessage('Completa correo y contraseña.');
      return;
    }

    if (authMode === 'register' && !name) {
      setAuthMessage('Escribe tu nombre para registrarte.');
      return;
    }

    if (password.length < 6) {
      setAuthMessage('La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    try {
      setAuthLoading(true);
      setAuthMessage('');

      if (authMode === 'register') {
        await registerUser(email, password, name);
      } else {
        await loginUser(email, password);
      }
      setAuthPromptVisible(false);
      setAuthName('');
      setAuthEmail('');
      setAuthPassword('');
      setAuthPromptText('');
    } catch (error: any) {
      const code = String(error?.code ?? '');
      if (code.includes('auth/invalid-credential')) {
        setAuthMessage('Correo o contraseña incorrectos.');
      } else if (code.includes('auth/email-already-in-use')) {
        setAuthMessage('Ese correo ya está registrado.');
      } else if (code.includes('auth/weak-password')) {
        setAuthMessage('La contraseña es muy débil.');
      } else if (code.includes('auth/invalid-email')) {
        setAuthMessage('El correo no es válido.');
      } else {
        setAuthMessage('No se pudo autenticar. Intenta de nuevo.');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const submitPasswordReset = async () => {
    const email = authEmail.trim();
    if (!email) {
      setAuthMessage('Escribe tu correo para recuperar la contraseña.');
      return;
    }

    try {
      setPasswordResetLoading(true);
      setAuthMessage('');
      await resetUserPassword(email);
      setAuthMessage('Te enviamos un enlace para crear una nueva contraseña. Revisa tu correo y la carpeta de spam.');
    } catch (error: any) {
      const code = String(error?.code ?? '');
      if (code.includes('auth/invalid-email')) {
        setAuthMessage('El correo no es válido.');
      } else if (code.includes('auth/user-not-found')) {
        setAuthMessage('No encontramos una cuenta con ese correo.');
      } else {
        setAuthMessage('No se pudo enviar el enlace. Intenta de nuevo.');
      }
    } finally {
      setPasswordResetLoading(false);
    }
  };

  const submitGoogleAuth = async () => {
    try {
      setAuthMessage('');
      setGoogleAuthLoading(true);

      if (!hasGoogleAuthConfig) {
        setAuthMessage('Falta configurar Google OAuth en variables de entorno.');
        return;
      }

      if (Platform.OS === 'web') {
        await loginWithGoogleWeb();
        setAuthPromptVisible(false);
        setAuthPromptText('');
      } else {
        await promptGoogleAuth();
      }
    } catch {
      setAuthMessage('No se pudo iniciar con Google. Verifica la configuración.');
    } finally {
      if (Platform.OS === 'web') {
        setGoogleAuthLoading(false);
      }
    }
  };

  const signOutCurrentUser = async () => {
    try {
      await logoutUser();
      setSignOutConfirmVisible(false);
      setActiveScreen('today');
      setProfile(createEmptyProfile());
      setProfileMessage('');
      setProfileMessage('Sesión cerrada.');
    } catch {
      setProfileMessage('No se pudo cerrar sesión.');
    }
  };

  const confirmSignOut = () => {
    setSignOutConfirmVisible(true);
  };

  if (!authReady) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.authWrapper}>
          <Text style={styles.pageTitle}>Cargando FitFlow...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <View style={[styles.appShell, isCompactLayout && styles.appShellCompact]}>
        <Animated.View
          style={[
            styles.sidebar,
            isCompactLayout && styles.sidebarCompact,
            !isCompactLayout && sidebarCollapsed && styles.sidebarCollapsed,
            { width: sidebarWidth },
          ]}
        >
          <View style={[styles.brandRow, !isCompactLayout && sidebarCollapsed && styles.brandRowCollapsed]}>
            <Image
              source={require('./assets/images/logo.png')}
              style={[styles.logo, !isCompactLayout && sidebarCollapsed && styles.logoCollapsed]}
              resizeMode="contain"
            />
            {sidebarContentVisible ? (
              <Animated.View style={{ opacity: sidebarContentOpacity }}>
                <View style={styles.brandCopy}>
                <Text style={styles.title} numberOfLines={1}>FitFlow</Text>
                <Text style={styles.sidebarSubtitle}>FITNESS OS</Text>
                </View>
              </Animated.View>
            ) : null}
            {!isCompactLayout ? (
              <AnimatedButton
                accessibilityLabel={sidebarCollapsed ? 'Abrir barra lateral' : 'Cerrar barra lateral'}
                onPress={toggleSidebar}
                style={styles.sidebarToggle}
              >
                <Text style={styles.sidebarToggleText}>{sidebarCollapsed ? '+' : '−'}</Text>
              </AnimatedButton>
            ) : null}
          </View>
          {sidebarContentVisible ? <Animated.View style={{ opacity: sidebarContentOpacity }}>
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
          <Text style={styles.sidebarLabel}>CUENTA</Text>
          <Pressable
            onPress={() => setActiveScreen('profile')}
            style={[styles.navigationButton, activeScreen === 'profile' && styles.navigationButtonActive]}
          >
            <Text style={styles.navigationIcon}>06</Text>
            <Text style={[styles.navigationText, activeScreen === 'profile' && styles.navigationTextActive]}>Mi perfil</Text>
          </Pressable>
          <View style={styles.sidebarFooter}>
            <Text style={styles.sidebarFooterTitle}>FOCUS MODE</Text>
            <Text style={styles.sidebarFooterText}>Construye constancia, una sesión a la vez.</Text>
          </View>
          </Animated.View> : null}
        </Animated.View>

        {isCompactLayout ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.mobileNavigationScroll}
            contentContainerStyle={styles.mobileNavigation}
          >
            {[
              ['01', 'Hoy', 'today'],
              ['02', 'Editar', 'modify'],
              ['03', 'Rutinas', 'routines'],
              ['04', 'Coach', 'trainer'],
              ['05', 'Panel', 'trainerPanel'],
              ['06', 'Perfil', 'profile'],
            ].map(([number, label, screen]) => (
              <AnimatedButton
                key={screen}
                onPress={() => setActiveScreen(screen as AppScreen)}
                style={[styles.mobileNavigationButton, activeScreen === screen && styles.mobileNavigationButtonActive]}
              >
                <Text style={styles.mobileNavigationNumber}>{number}</Text>
                <Text style={styles.mobileNavigationText}>{label}</Text>
              </AnimatedButton>
            ))}
          </ScrollView>
        ) : null}

        <Animated.View
          style={[
            styles.mainContent,
            {
              opacity: pageMotion,
              transform: [{ translateY: pageMotion.interpolate({ inputRange: [0, 1], outputRange: [-26, 0] }) }],
            },
          ]}
        >
        <ScrollView contentContainerStyle={[styles.scrollContent, isCompactLayout && styles.scrollContentCompact]}>
        <View style={styles.topbar}>
          <View style={styles.topbarCopy}>
            <Text style={styles.eyebrow}>TU ESPACIO DE ENTRENAMIENTO</Text>
            <Text style={styles.pageTitle}>{activeScreen === 'today' ? 'Entrenamiento de hoy' : activeScreen === 'modify' ? 'Diseña tu rutina' : activeScreen === 'routines' ? 'Tu biblioteca' : activeScreen === 'trainer' ? 'Tu coach' : activeScreen === 'profile' ? 'Mi perfil' : 'Centro del entrenador'}</Text>
          </View>
          <View style={[styles.topbarRight, isCompactLayout && styles.topbarRightCompact]}>
            <View style={styles.topbarBadge}>
              <Text style={styles.topbarBadgeText}>{isGuest ? 'MODO INVITADO' : `${progressPercent}% SEMANA`}</Text>
            </View>
            {isGuest ? (
              <Pressable
                onPress={() => {
                  setAuthMode('login');
                  setAuthPromptText('Inicia sesión para guardar progreso y rutinas.');
                  setAuthPromptVisible((current) => !current);
                }}
                style={styles.topbarAuthButton}
              >
                <Text style={styles.topbarAuthButtonText}>Empezar ahora</Text>
              </Pressable>
            ) : null}
          </View>
        </View>

        {activeScreen === 'profile' ? (
          <View style={styles.profileGrid}>
            <View style={styles.profileHero}>
              <Pressable onPress={() => void pickProfileImage()} style={styles.profileAvatarButton}>
                {profile.avatarUrl ? (
                  <Image source={{ uri: profile.avatarUrl }} style={styles.profileAvatar} resizeMode="cover" />
                ) : (
                  <View style={styles.profileAvatar}>
                    <Text style={styles.profileAvatarText}>{profile.name.trim().charAt(0).toUpperCase() || 'F'}</Text>
                  </View>
                )}
                <Text style={styles.profileAvatarAction}>Cambiar</Text>
              </Pressable>
              <View style={styles.profileHeroCopy}>
                <Text style={styles.eyebrow}>PERFIL PERSONAL</Text>
                <Text style={styles.profileHeroTitle}>{profile.name || 'Tu perfil FitFlow'}</Text>
                <Text style={styles.cardDescription}>Configura tus datos para recibir mejores rutinas y recomendaciones.</Text>
              </View>
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Datos personales</Text>
              <TextInput
                value={profile.name}
                onChangeText={(value) => updateProfileField('name', value)}
                placeholder="Nombre completo"
                placeholderTextColor="#5f8493"
                style={styles.profileInput}
              />
              <TextInput
                value={profile.email}
                onChangeText={(value) => updateProfileField('email', value)}
                placeholder="Correo electrónico"
                placeholderTextColor="#5f8493"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.profileInput}
              />
              <TextInput
                value={profile.goals?.[0] ?? ''}
                onChangeText={(value) => setProfile((current) => ({ ...current, goals: value ? [value] : [], updatedAt: new Date().toISOString() }))}
                placeholder="Objetivo principal: fuerza, masa, resistencia..."
                placeholderTextColor="#5f8493"
                style={styles.profileInput}
              />
            </View>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>¿Cómo empiezas?</Text>
              <View style={styles.intensityRow}>
                {[
                  ['Desde cero', 'Principiante'],
                  ['Ya tengo conocimiento', 'Intermedio'],
                ].map(([label, level]) => (
                  <Pressable
                    key={level}
                    onPress={() => {
                      updateProfileField('level', level);
                      setIntensity(getRecommendedIntensity(level as UserProfile['level']));
                    }}
                    style={[styles.intensityButton, profile.level === level && styles.intensityButtonActive]}
                  >
                    <Text style={[styles.intensityText, profile.level === level && styles.intensityTextActive]}>{label}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.sectionTitle}>Tiempo diario disponible</Text>
              <TextInput
                value={String(dailyMinutes)}
                onChangeText={(value) => {
                  const nextMinutes = Number.parseInt(value.replace(/[^0-9]/g, ''), 10);
                  setDailyMinutes(Number.isFinite(nextMinutes) ? Math.min(nextMinutes, 180) : 0);
                }}
                placeholder="Minutos por día"
                placeholderTextColor="#5f8493"
                keyboardType="number-pad"
                style={styles.profileInput}
              />
              <Text style={styles.cardDescription}>
                {dailyMinutes > 30
                  ? `Tu plan semanal se actualiza al instante para ${dailyMinutes} minutos al día.`
                  : 'Indica más de 30 minutos diarios para activar tu rutina semanal personalizada.'}
              </Text>
              <Text style={styles.sectionTitle}>Equipo disponible</Text>
              <View style={styles.chipWrap}>
                {equipmentList.map((item) => {
                  const active = selectedEquipment.includes(item);
                  return (
                    <Pressable key={item} onPress={() => toggleEquipment(item)} style={[styles.chip, active && styles.chipActive]}>
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.profileActions}>
                <Pressable onPress={() => void saveProfile()} style={[styles.primaryButton, styles.profileActionButton]}>
                  <Text style={styles.primaryButtonText}>Guardar perfil</Text>
                </Pressable>
                {sessionUser ? (
                  <Pressable onPress={confirmSignOut} style={[styles.secondaryButton, styles.profileActionButton, styles.signOutButton]}>
                    <Text style={styles.secondaryButtonText}>Cerrar sesión</Text>
                  </Pressable>
                ) : (
                  <Pressable
                    onPress={() => {
                      setAuthMode('register');
                      setAuthPromptText('Regístrate para guardar perfil y personalizar tu experiencia.');
                      setAuthPromptVisible(true);
                    }}
                    style={[styles.secondaryButton, styles.profileActionButton]}
                  >
                    <Text style={styles.secondaryButtonText}>Crear cuenta</Text>
                  </Pressable>
                )}
              </View>
              {profileMessage ? <Text style={styles.assignmentMessage}>{profileMessage}</Text> : null}
            </View>
          </View>
        ) : null}

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
                      {template.equipment?.length ? (
                        <Text style={styles.historyText}>Equipo: {template.equipment.join(', ')}</Text>
                      ) : null}
                      {template.intensity ? <Text style={styles.historyText}>Intensidad: {template.intensity}</Text> : null}
                    </View>
                    <View style={styles.assignmentActions}>
                      <Pressable onPress={() => void activateUserRoutine(template)} style={styles.acceptButton}>
                        <Text style={styles.actionButtonText}>Usar rutina</Text>
                      </Pressable>
                      <Pressable
                        onPress={() => void shareRoutine(template.title, template.routine, {
                          equipment: template.equipment,
                          intensity: template.intensity,
                        })}
                        style={styles.shareButton}
                      >
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
            {routineAssignments.filter((assignment) => assignment.clientId === currentUserId).length === 0 ? (
              <Text style={styles.emptyState}>Todavía no te han asignado una rutina.</Text>
            ) : (
              routineAssignments
                .filter((assignment) => assignment.clientId === currentUserId)
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

        {activeScreen !== 'trainer' && activeScreen !== 'routines' && activeScreen !== 'trainerPanel' && activeScreen !== 'profile' ? <View>
        {activeScreen === 'modify' ? <>
        <AnimatedSection delay={0}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Equipo para este borrador</Text>
          <Text style={styles.cardDescription}>
            Estos requisitos pertenecen sólo a esta rutina. Podrás mostrarlos cuando la compartas; no cambian tu rutina default.
          </Text>
          <View style={styles.chipWrap}>
            {equipmentList.map((item) => {
              const active = draftEquipment.includes(item);
              return (
                <AnimatedButton
                  key={item}
                  onPress={() => toggleDraftEquipment(item)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{item}</Text>
                </AnimatedButton>
              );
            })}
          </View>
        </View>
        </AnimatedSection>

        <AnimatedSection delay={90}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Intensidad del borrador</Text>
          <View style={styles.intensityRow}>
            {(['Baja', 'Media', 'Alta', 'Máxima'] as Intensity[]).map((level) => (
              <AnimatedButton
                key={level}
                onPress={() => setDraftIntensity(level)}
                style={[styles.intensityButton, level === draftIntensity && styles.intensityButtonActive]}
              >
                <Text style={[styles.intensityText, level === draftIntensity && styles.intensityTextActive]}>{level}</Text>
              </AnimatedButton>
            ))}
          </View>
          <Text style={styles.intensityDescription}>{intensityLabel[draftIntensity]}</Text>
        </View>
        </AnimatedSection>

        <AnimatedSection delay={180}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Plan semanal</Text>
          <Text style={styles.cardDescription}>¿Qué rutina quieres modificar?</Text>
          <View style={styles.routineOptions}>
            <AnimatedButton
              onPress={() => editSelectedRoutine('default', draftRoutine)}
              style={[styles.routineOption, selectedEditRoutineId === 'default' && styles.routineOptionActive]}
            >
              <Text style={[styles.routineOptionTitle, selectedEditRoutineId === 'default' && styles.routineOptionTitleActive]}>
                Rutina default
              </Text>
              <Text style={styles.routineOptionMeta}>Vista previa con este equipo e intensidad</Text>
            </AnimatedButton>
            {routineTemplates
              .filter((template) => template.ownerRole === 'user')
              .map((template) => (
                <AnimatedButton
                  key={`edit-template-${template.id}`}
                  onPress={() => editSelectedRoutine(template.id, template.routine)}
                  style={[styles.routineOption, selectedEditRoutineId === template.id && styles.routineOptionActive]}
                >
                  <Text style={[styles.routineOptionTitle, selectedEditRoutineId === template.id && styles.routineOptionTitleActive]}>
                    {template.title}
                  </Text>
                  <Text style={styles.routineOptionMeta}>Rutina guardada</Text>
                </AnimatedButton>
              ))}
            {routineAssignments
              .filter((assignment) => assignment.clientId === currentUserId)
              .map((assignment) => (
                <AnimatedButton
                  key={`edit-assignment-${assignment.id}`}
                  onPress={() => editSelectedRoutine(assignment.id, assignment.routine)}
                  style={[styles.routineOption, selectedEditRoutineId === assignment.id && styles.routineOptionActive]}
                >
                  <Text style={[styles.routineOptionTitle, selectedEditRoutineId === assignment.id && styles.routineOptionTitleActive]}>
                    {assignment.title}
                  </Text>
                  <Text style={styles.routineOptionMeta}>Rutina del coach</Text>
                </AnimatedButton>
              ))}
            <AnimatedButton
              onPress={createCustomRoutine}
              style={[styles.routineOption, selectedEditRoutineId === 'new' && styles.routineOptionActive]}
            >
              <Text style={[styles.routineOptionTitle, selectedEditRoutineId === 'new' && styles.routineOptionTitleActive]}>
                Crear nueva
              </Text>
              <Text style={styles.routineOptionMeta}>Empieza desde cero</Text>
            </AnimatedButton>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.progressText}>
              {customRoutine ? 'Rutina personalizada activa' : 'Borrador sin activar'}
            </Text>
            <AnimatedButton onPress={openWeekEditor} style={styles.resetButton}>
              <Text style={styles.resetButtonText}>
                {customRoutine ? 'Editar rutina' : 'Editar borrador'}
              </Text>
            </AnimatedButton>
          </View>
          <AnimatedButton onPress={createCustomRoutine} style={styles.defaultButton}>
            <Text style={styles.defaultButtonText}>Crear rutina propia</Text>
          </AnimatedButton>
        </View>
        </AnimatedSection>

        {isEditingWeek ? (
          <AnimatedSection delay={270}>
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
                      <AnimatedButton
                        onPress={() => removeEditorExercise(dayIndex, exerciseIndex)}
                        style={styles.removeExerciseButton}
                      >
                        <Text style={styles.removeExerciseText}>Eliminar</Text>
                      </AnimatedButton>
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
                    <AnimatedButton
                      onPress={() => void pickExerciseImage(dayIndex, exerciseIndex)}
                      style={styles.imagePickerButton}
                    >
                      <Text style={styles.imagePickerButtonText}>Elegir imagen desde el dispositivo</Text>
                    </AnimatedButton>
                  </View>
                ))}
                <AnimatedButton onPress={() => addEditorExercise(dayIndex)} style={styles.addExerciseButton}>
                  <Text style={styles.addExerciseText}>+ Agregar otro ejercicio</Text>
                </AnimatedButton>
              </View>
            ))}
            <View style={styles.summaryRow}>
              <AnimatedButton onPress={() => setIsEditingWeek(false)} style={styles.secondaryButton}>
                <Text style={styles.secondaryButtonText}>Cancelar</Text>
              </AnimatedButton>
              <AnimatedButton onPress={saveCustomRoutine} style={styles.primaryButton}>
                <Text style={styles.primaryButtonText}>Guardar cambios</Text>
              </AnimatedButton>
            </View>
          </View>
          </AnimatedSection>
        ) : null}
        </> : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Entrenamiento de hoy · {todayName}</Text>
            {todayPlan ? (
              <>
                <Text style={styles.dayTitle}>{todayPlan.title}</Text>
                <Text style={styles.progressText}>Completa los ejercicios y registra tus pesos.</Text>
                {customRoutine ? (
                  <AnimatedButton onPress={() => void resetRoutineToDefault()} style={styles.defaultButton}>
                    <Text style={styles.defaultButtonText}>Usar rutina default del perfil</Text>
                  </AnimatedButton>
                ) : (
                  <Text style={styles.cardDescription}>Estás usando la rutina default creada desde tu perfil.</Text>
                )}
              </>
            ) : (
              <Text style={styles.emptyState}>No hay entrenamiento programado para hoy.</Text>
            )}
          </View>
        )}

        {activeScreen === 'modify' ? <AnimatedSection delay={360}><View style={styles.card}>
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
        </View></AnimatedSection> : null}

        <AnimatedSection delay={450}>
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
        </AnimatedSection>

        <AnimatedSection delay={540}>
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
                      ) : <View style={styles.exerciseImagePlaceholder} />}
                      <Pressable
                        onPress={() => toggleExerciseDone(dayPlan.day, exercise.name, exerciseIndex)}
                        style={[styles.checkbox, currentProgress.done && styles.checkboxActive]}
                      >
                        <AnimatedCheckmark visible={currentProgress.done} />
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
        </AnimatedSection>
        </View> : null}
      </ScrollView>
        {isGuest && authPromptVisible ? (
          <View style={styles.authOverlayBackdrop}>
            <Pressable
              style={StyleSheet.absoluteFillObject}
              onPress={() => {
                setAuthPromptVisible(false);
                setAuthMessage('');
                setAuthPromptText('');
              }}
            />
            <View style={styles.authOverlayContainer}>
              <Animated.View
                style={[
                  styles.authFloatingPanel,
                  isCompactLayout && { width: Math.max(280, viewportWidth - 24) },
                  {
                    borderColor: authGlow.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['#29434f', '#7ed8ff'],
                    }),
                    transform: [{ translateX: authShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] }) }],
                  },
                ]}
              >
                <Text style={styles.eyebrow}>MODO INVITADO</Text>
                <Text style={styles.sectionTitle}>{authMode === 'register' ? 'Crear cuenta para editar' : 'Empezar ahora'}</Text>
                {authPromptText ? <Text style={styles.cardDescription}>{authPromptText}</Text> : null}

              {authMode === 'register' ? (
                <TextInput
                  value={authName}
                  onChangeText={(value) => {
                    setAuthName(value);
                    setAuthMessage('');
                  }}
                  placeholder="Nombre"
                  placeholderTextColor="#5f8493"
                  style={styles.profileInput}
                />
              ) : null}

              <TextInput
                value={authEmail}
                onChangeText={(value) => {
                  setAuthEmail(value);
                  setAuthMessage('');
                }}
                placeholder="Correo"
                placeholderTextColor="#5f8493"
                keyboardType="email-address"
                autoCapitalize="none"
                style={styles.profileInput}
              />

              <TextInput
                value={authPassword}
                onChangeText={(value) => {
                  setAuthPassword(value);
                  setAuthMessage('');
                }}
                placeholder="Contraseña"
                placeholderTextColor="#5f8493"
                secureTextEntry
                style={styles.profileInput}
              />

              {authMode === 'login' ? (
                <Pressable onPress={() => void submitPasswordReset()} style={styles.passwordResetButton}>
                  <Text style={styles.passwordResetText}>
                    {passwordResetLoading ? 'Enviando enlace...' : '¿Olvidaste tu contraseña?'}
                  </Text>
                </Pressable>
              ) : null}

              <View style={styles.summaryRow}>
                <Pressable onPress={() => void submitAuth()} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>
                      {authLoading ? 'Procesando...' : authMode === 'register' ? 'Crear cuenta' : 'Empezar ahora'}
                  </Text>
                </Pressable>
                <Pressable onPress={() => setAuthPromptVisible(false)} style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Seguir viendo</Text>
                </Pressable>
              </View>

              <Pressable onPress={() => void submitGoogleAuth()} style={styles.googleButton}>
                <Text style={styles.googleButtonText}>{googleAuthLoading ? 'Conectando con Google...' : 'Continuar con Google'}</Text>
              </Pressable>

              <Pressable
                onPress={() => {
                  setAuthMode((current) => (current === 'login' ? 'register' : 'login'));
                  setAuthMessage('');
                }}
                style={styles.authSwitchButton}
              >
                <Text style={styles.authSwitchText}>
                  {authMode === 'login' ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
                </Text>
              </Pressable>

                {authMessage ? <Text style={styles.assignmentMessage}>{authMessage}</Text> : null}
              </Animated.View>
            </View>
          </View>
        ) : null}
        {signOutConfirmVisible ? (
          <View style={styles.confirmationOverlay}>
            <View style={styles.confirmationCard}>
              <Text style={styles.eyebrow}>CUENTA</Text>
              <Text style={styles.sectionTitle}>¿Cerrar sesión?</Text>
              <Text style={styles.cardDescription}>Tu sesión se cerrará en este dispositivo.</Text>
              <View style={styles.profileActions}>
                <Pressable onPress={() => setSignOutConfirmVisible(false)} style={[styles.secondaryButton, styles.profileActionButton]}>
                  <Text style={styles.secondaryButtonText}>Cancelar</Text>
                </Pressable>
                <Pressable onPress={() => void signOutCurrentUser()} style={[styles.secondaryButton, styles.profileActionButton, styles.signOutButton]}>
                  <Text style={styles.secondaryButtonText}>Cerrar sesión</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b151d',
  },
  authWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  authCard: {
    width: '100%',
    maxWidth: 440,
    backgroundColor: '#10232c',
    borderRadius: 14,
    padding: 20,
    borderWidth: 1,
    borderColor: '#29434f',
  },
  authCardInline: {
    backgroundColor: '#10232c',
    borderRadius: 14,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#29434f',
  },
  authSwitchButton: {
    marginTop: 12,
    alignSelf: 'flex-start',
  },
  authSwitchText: {
    color: '#7ed8ff',
    fontSize: 13,
    fontWeight: '700',
  },
  passwordResetButton: {
    alignSelf: 'flex-start',
    marginTop: -2,
    marginBottom: 10,
  },
  passwordResetText: {
    color: '#9edff7',
    fontSize: 12,
    fontWeight: '700',
  },
  appShell: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#0b151d',
  },
  appShellCompact: {
    flexDirection: 'column',
  },
  sidebar: {
    width: 240,
    backgroundColor: '#0f1e27',
    borderRightWidth: 1,
    borderRightColor: '#233b47',
    paddingHorizontal: 16,
    paddingVertical: 22,
  },
  sidebarCollapsed: {
    width: 112,
    paddingHorizontal: 10,
    alignItems: 'center',
  },
  sidebarCompact: {
    display: 'none',
  },
  brandCopy: {
    flex: 1,
  },
  logoCollapsed: {
    width: 48,
    height: 48,
    marginRight: 4,
  },
  sidebarToggle: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#173541',
    borderWidth: 1,
    borderColor: '#3b7f98',
    borderRadius: 14,
  },
  sidebarToggleText: {
    color: '#7ed8ff',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 21,
  },
  buttonPressed: {
    opacity: 0.72,
    transform: [{ scale: 0.96 }],
  },
  mobileNavigation: {
    minWidth: '100%',
    paddingHorizontal: 8,
    paddingVertical: 7,
    gap: 4,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  mobileNavigationScroll: {
    flexGrow: 0,
    height: 66,
  },
  mobileNavigationButton: {
    width: 58,
    height: 52,
    backgroundColor: '#132832',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#29434f',
    paddingHorizontal: 4,
    paddingVertical: 7,
    alignItems: 'center',
  },
  mobileNavigationButtonActive: {
    backgroundColor: '#1b566c',
    borderColor: '#2ebcf2',
  },
  mobileNavigationNumber: {
    color: '#5f8493',
    fontSize: 9,
    fontWeight: '900',
    marginBottom: 2,
    textAlign: 'center',
  },
  mobileNavigationText: {
    color: '#e2e8f0',
    fontSize: 10,
    fontWeight: '800',
    textAlign: 'center',
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
  scrollContentCompact: {
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  topbarCopy: {
    flex: 1,
    minWidth: 0,
    marginRight: 12,
  },
  topbarRight: {
    position: 'relative',
    alignItems: 'flex-end',
  },
  topbarRightCompact: {
    alignItems: 'flex-end',
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
  topbarAuthButton: {
    marginTop: 8,
    backgroundColor: '#274353',
    borderWidth: 1,
    borderColor: '#3b6d84',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  topbarAuthButtonText: {
    color: '#d8f4ff',
    fontSize: 12,
    fontWeight: '800',
  },
  authFloatingPanel: {
    width: 380,
    backgroundColor: '#10232c',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    elevation: 7,
    zIndex: 40,
  },
  authOverlayBackdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4, 12, 17, 0.2)',
    zIndex: 250,
    elevation: 25,
  },
  authOverlayContainer: {
    position: 'absolute',
    top: 28,
    right: 24,
    zIndex: 300,
    elevation: 30,
  },
  profileGrid: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  profileHero: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#143443',
    borderWidth: 1,
    borderColor: '#28627a',
    borderRadius: 14,
    padding: 22,
    marginBottom: 16,
  },
  profileAvatar: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#ffcf3f',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  profileAvatarButton: {
    alignItems: 'center',
    marginRight: 16,
  },
  profileAvatarAction: {
    color: '#7ed8ff',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 6,
  },
  profileAvatarText: {
    color: '#18242a',
    fontSize: 28,
    fontWeight: '900',
  },
  profileHeroCopy: {
    flex: 1,
  },
  profileActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 4,
  },
  profileActionButton: {
    minWidth: 148,
    alignItems: 'center',
  },
  signOutButton: {
    backgroundColor: '#3a2630',
    borderWidth: 1,
    borderColor: '#a9435b',
  },
  confirmationOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(4, 12, 17, 0.72)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 500,
    elevation: 50,
    padding: 20,
  },
  confirmationCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#10232c',
    borderWidth: 1,
    borderColor: '#a9435b',
    borderRadius: 14,
    padding: 20,
  },
  profileHeroTitle: {
    color: '#f5fbff',
    fontSize: 24,
    fontWeight: '900',
    marginBottom: 4,
  },
  profileInput: {
    backgroundColor: '#0c1b23',
    borderRadius: 9,
    borderWidth: 1,
    borderColor: '#315161',
    color: '#f2fbff',
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    marginBottom: 10,
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
  brandRowCollapsed: {
    justifyContent: 'center',
    gap: 8,
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
  exerciseImagePlaceholder: {
    width: 140,
    height: 100,
    marginRight: 10,
    backgroundColor: 'transparent',
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
  googleButton: {
    marginTop: 10,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  googleButtonText: {
    color: '#0f172a',
    fontWeight: '800',
    fontSize: 12,
    textAlign: 'center',
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

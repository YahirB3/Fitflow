# FitFlow

FitFlow es una plataforma multiplataforma para planificar entrenamientos, registrar progreso y conectar usuarios con entrenadores. Se construirá con React Native, Expo, React Native Web y Firebase.

## Objetivo

Convertir la aplicación actual de generación de rutinas en un producto demostrable para portafolio, con cuentas de usuario, datos sincronizados entre dispositivos y un panel web para entrenadores.

## Stack

- React Native + Expo + React Native Web
- TypeScript
- Firebase Authentication
- Cloud Firestore
- Firebase Storage
- Cloud Functions y Cloud Messaging en fases posteriores

## MVP

- Registro, inicio de sesión y recuperación de cuenta
- Perfil con objetivo, nivel, disponibilidad y equipo
- Rutinas personalizadas
- Registro de series, repeticiones, peso, notas y sesiones completadas
- Sincronización entre móvil y web
- Reglas de seguridad de Firestore
- Estados de carga, error, vacío y modo offline

## Flujo de selección de rutina

Al entrar, el usuario selecciona el equipo disponible y el nivel de intensidad. FitFlow genera una rutina default basada en esas opciones.

Después puede elegir entre:

- **Usar rutina default:** conserva la rutina generada automáticamente.
- **Modificar default:** edita ejercicios, series, repeticiones y notas; el resultado se convierte en una rutina personalizada.
- **Crear rutina propia:** comienza una rutina editable desde cero.
- **Usar rutina default nuevamente:** descarta la personalización y regresa a la propuesta automática.

La rutina default depende del equipo y la intensidad. La rutina personalizada se conserva aunque el usuario vuelva a abrir la aplicación.

## Ideas futuras: apartado social

Estas funciones quedan fuera de la línea de tiempo actual y se retomarán después de completar el MVP:

- Compartir una rutina mediante un enlace.
- Consultar perfiles públicos de otros usuarios.
- Guardar múltiples rutinas sin perder las anteriores.
- Duplicar o importar rutinas compartidas.
- Ranking de rutinas más descargadas o compartidas.
- Apartado social para descubrir rutinas populares.

## Línea de tiempo

Duración: **6 semanas**, del **24 de agosto al 4 de octubre de 2026**.

| Semana | Fase | Resultado esperado |
| --- | --- | --- |
| 1 | Diseño y arquitectura | Roles, navegación, modelo Firestore y sistema visual definidos |
| 2 | Firebase y autenticación | Cuentas, perfiles y reglas básicas de seguridad funcionando |
| 3 | Rutinas sincronizadas | Rutinas guardadas y editables desde Firestore |
| 4 | Registro de progreso | Sesiones, pesos, notas y estados de interfaz funcionando |
| 5 | Diferenciadores | Panel de entrenador y gráficas de progreso |
| 6 | Calidad y publicación | Pruebas, despliegue web, build móvil y documentación |

## Semana 1: qué hacer

La meta de esta semana no es añadir muchas pantallas. Es ordenar la base para que Firebase, la autenticación y el panel web puedan añadirse sin convertir `App.tsx` en un archivo difícil de mantener.

### 1. Definir los usuarios

FitFlow tendrá tres tipos de usuario:

- **Usuario:** crea su perfil, genera una rutina y registra sus entrenamientos.
- **Entrenador:** revisa clientes y asigna rutinas desde la web.
- **Administrador:** gestiona usuarios y contenido del sistema.

Matriz inicial de permisos:

| Acción | Usuario | Entrenador | Administrador |
| --- | --- | --- | --- |
| Gestionar su propio perfil | Crear y editar | Crear y editar | Crear y editar |
| Crear y editar sus rutinas | Sí | Sí | Sí |
| Registrar sus entrenamientos y progreso | Sí | No | No |
| Consultar el progreso de sus clientes | No | Sí, solo clientes asignados | Sí |
| Asignar rutinas a clientes | No | Sí, solo clientes asignados | Sí |
| Gestionar usuarios y contenido global | No | No | Sí |

Las reglas de Firestore deben validar el `userId` del documento y el rol almacenado en el perfil. El rol no podrá ser cambiado por el propio usuario desde la aplicación.

Resultado: una lista clara de permisos antes de escribir las reglas de Firestore.

### 2. Definir las pantallas

El flujo inicial será:

1. Inicio de sesión o registro.
2. Inicio con resumen de la semana.
3. Rutinas para generar o editar el plan.
4. Entrenamiento para marcar ejercicios y guardar pesos.
5. Progreso para consultar historial y estadísticas.
6. Perfil para editar objetivos, nivel y equipo.
7. Panel de entrenador en la versión web.

Navegación inicial:

| Origen | Destino | Condición |
| --- | --- | --- |
| Sesión no iniciada | Inicio de sesión o registro | El usuario puede consultar contenido público, pero debe autenticarse para guardar cambios |
| Inicio | Rutinas | Siempre disponible para usuarios autenticados |
| Inicio | Entrenamiento | Existe una rutina activa |
| Inicio | Progreso | Existe historial de entrenamientos |
| Inicio | Perfil | Siempre disponible para usuarios autenticados |
| Usuario entrenador | Panel de entrenador | El perfil tiene rol `trainer` |
| Usuario administrador | Administración | El perfil tiene rol `admin` |

En móvil se usará una navegación inferior para Inicio, Rutinas, Entrenamiento, Progreso y Perfil. En web, el panel de entrenador y las vistas administrativas se mostrarán desde una barra lateral responsive.

Resultado: cada pantalla tendrá una responsabilidad concreta y no se mezclará autenticación con lógica de entrenamiento.

### 3. Separar responsabilidades

La aplicación actual funciona, pero concentra tipos, datos, persistencia, estado y componentes visuales en `App.tsx`. La separación prevista es:

```text
src/
	components/       Componentes visuales reutilizables
	features/         Funciones de rutinas, progreso y perfil
	services/         AsyncStorage y, después, Firebase
	types/            Tipos compartidos de TypeScript
	constants/        Ejercicios, equipo e intensidades
```

Primero se moverán tipos y constantes sin cambiar el comportamiento. Después se extraerán los servicios de persistencia. Cada movimiento se validará con `npx.cmd tsc --noEmit`.

### 4. Diseñar los datos de Firebase

La primera propuesta de colecciones es:

```text
users/{userId}
users/{userId}/routines/{routineId}
users/{userId}/workouts/{workoutId}
users/{userId}/progress/{progressId}
trainerAssignments/{assignmentId}
```

Modelo inicial de documentos:

| Colección | Campos principales | Propietario o acceso |
| --- | --- | --- |
| `users/{userId}` | `displayName`, `email`, `role`, `goal`, `level`, `availability`, `equipment`, `createdAt`, `updatedAt` | El usuario administra su perfil; entrenador y administrador consultan según permisos |
| `users/{userId}/routines/{routineId}` | `name`, `source`, `equipment`, `intensity`, `days`, `exercises`, `createdAt`, `updatedAt` | El usuario administra sus rutinas; el entrenador puede administrar copias asignadas |
| `users/{userId}/workouts/{workoutId}` | `routineId`, `date`, `duration`, `completed`, `notes`, `createdAt`, `updatedAt` | Solo el usuario escribe; entrenador y administrador pueden consultar cuando corresponda |
| `users/{userId}/progress/{progressId}` | `workoutId`, `exerciseId`, `sets`, `repetitions`, `weight`, `notes`, `recordedAt` | Solo el usuario escribe su progreso |
| `trainerAssignments/{assignmentId}` | `trainerId`, `clientId`, `routineId`, `status`, `createdAt`, `updatedAt` | Entrenador asignado y administrador |

Reglas del modelo:

- Cada documento debe incluir `createdAt` y `updatedAt` cuando sea editable.
- Los subdocumentos de `users/{userId}` deben usar el mismo `userId` del propietario.
- `trainerAssignments` relaciona únicamente a un entrenador con un cliente y una rutina.
- Las fechas se guardarán como `Timestamp` de Firestore.
- Las rutinas conservarán los ejercicios como datos serializables, incluyendo `exerciseId`, `sets`, `repetitions`, `rest` y `notes`.

Esto permitirá proteger los datos por usuario y consultar el historial sin depender de datos globales.

### 5. Sistema visual mínimo

Antes de construir muchas pantallas se definirán colores, tipografía, espaciado, botones, campos y estados de carga/error. El objetivo es que móvil y web parezcan el mismo producto, aunque sus tamaños de pantalla sean distintos.

### Checklist de cierre de la semana 1

- [x] El proyecto se identifica como FitFlow.
- [x] Usuarios y permisos documentados.
- [x] Navegación inicial documentada.
- [x] Tipos y constantes separados de `App.tsx`.
- [x] Persistencia aislada detrás de un servicio.
- [x] Modelo inicial de Firestore documentado.
- [ ] `npx.cmd tsc --noEmit` sin errores.

Archivos creados en esta etapa:

- `src/types/workout.ts`: tipos compartidos de rutinas, ejercicios y progreso.
- `src/constants/workoutData.ts`: equipos, intensidades y datos estáticos de ejercicios.
- `src/services/workoutStorage.ts`: lectura y escritura de rutinas, progreso e historial.

## Comandos en Windows

Si PowerShell bloquea `npm.ps1` o `npx.ps1` por la política de ejecución, usa las variantes `.cmd`:

```powershell
cd "C:\Users\yahir\OneDrive\Documentos\vsProyeects\Proyectitos\gym"
npm.cmd install
npx.cmd expo start
```

En la terminal de Expo, presiona `w` para abrir Web, `a` para Android o escanea el código QR con Expo Go.

## Hitos

- **30 de agosto:** base de producto definida.
- **13 de septiembre:** MVP con cuenta y sincronización.
- **27 de septiembre:** versión demostrable para portafolio.
- **4 de octubre:** release candidata publicada y documentada.

## Control del proyecto

Cada semana se revisará:

- Estado de tareas: `not_started`, `in_progress`, `blocked` o `done`.
- Horas estimadas frente a horas reales.
- Bloqueos y decisiones técnicas.
- Evidencia del avance mediante capturas, pruebas o enlaces.
- Cumplimiento de los criterios de terminado.

## Criterios de terminado

- La funcionalidad principal funciona en Android y Web.
- Los datos están protegidos por reglas de Firebase.
- No existen errores de TypeScript.
- Las pruebas críticas pasan.
- El README permite ejecutar el proyecto desde cero.
- Existe una demo web y un build móvil verificable.

## Ejecutar localmente

```bash
npm install
npm start
```

Para abrir la versión web:

```bash
npm run web
```

La configuración de Firebase se añadirá mediante variables de entorno y nunca se deben subir secretos al repositorio.

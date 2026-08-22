# Firebase Setup para FitFlow

## Paso 1: Crear Proyecto en Firebase

1. Ve a [Firebase Console](https://console.firebase.google.com)
2. Haz clic en "Crear proyecto"
3. Nombre: `fitflow` (o tu preferencia)
4. Desactiva Google Analytics (opcional)
5. Crea el proyecto

## Paso 2: Obtener Credenciales

1. En la consola, ve a **Configuración del proyecto** (engranaje)
2. En la sección **Apps**, haz clic en **Agregar aplicación** y selecciona **Web**
3. Dale un nombre (ej: "FitFlow Web")
4. **COPIA** la configuración de Firebase (los valores apiKey, projectId, etc.)

## Paso 3: Crear archivo .env.local

1. En la raíz del proyecto (`gym/`), crea un archivo llamado `.env.local`
2. Pega el siguiente contenido reemplazando con tus valores:

```env
EXPO_PUBLIC_FIREBASE_API_KEY=tu_api_key
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=tu-proyecto.firebaseapp.com
EXPO_PUBLIC_FIREBASE_PROJECT_ID=tu-proyecto
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=tu-proyecto.appspot.com
EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=tu_messaging_sender_id
EXPO_PUBLIC_FIREBASE_APP_ID=1:tu_app_id
```

## Paso 4: Habilitar Firestore Database

1. En Firebase Console, ve a **Firestore Database**
2. Haz clic en **Crear base de datos**
3. Selecciona: **Iniciar en modo de prueba**
4. Región: **nam5** (North America) o tu preferencia
5. Crea la base de datos

> **Nota:** En producción cambiarás las reglas de seguridad. Por ahora "modo prueba" permite lectura/escritura.

## Paso 5: Habilitar Autenticación

1. En Firebase Console, ve a **Authentication**
2. Haz clic en **Comenzar**
3. En la pestaña **Sign-in method**, habilita:
   - **Email/Password** (lo usaremos para login)

## Paso 6: Configurar Reglas de Seguridad (Importante)

En **Firestore Database**, ve a la pestaña **Rules** y reemplaza con esto:

```javascript
rules_version = '3';
service cloud.firestore {
  match /databases/{database}/documents {
    // Los usuarios solo pueden acceder a su propio documento
    match /users/{userId} {
      allow read, write: if request.auth.uid == userId;
    }
    
    // Trainer assignments: el cliente puede leer sus asignaciones
    match /trainerAssignments/{document=**} {
      allow read: if request.auth.uid == resource.data.clientId 
                  || request.auth.uid == resource.data.trainerId;
      allow write: if request.auth.uid == resource.data.trainerId;
    }
    
    // Routine assignments: similar a trainer assignments
    match /routineAssignments/{document=**} {
      allow read: if request.auth.uid == resource.data.clientId 
                  || request.auth.uid == resource.data.trainerId;
      allow write: if request.auth.uid == resource.data.trainerId;
    }
    
    // Templates: el dueño puede hacer todo, otros solo leer
    match /routineTemplates/{document=**} {
      allow read: if true; // Todos pueden ver (públicos)
      allow write: if request.auth.uid == resource.data.ownerId;
    }
  }
}
```

**Haz clic en "Publicar"**

## Paso 7: Verificar TypeScript

```bash
cd gym
npm run typecheck
```

## Paso 8: Ejecutar la App

```bash
cd gym
npm start
```

---

## Próximos Pasos

Ahora que Firebase está configurado, el App.tsx:
- Usará `firebaseService.ts` en lugar de AsyncStorage
- Los datos se sincronizarán automáticamente con la nube
- Los usuarios pueden autenticarse con email/password
- Los datos son persistentes entre dispositivos

### Para Habilitar Login en la App

Necesitaremos agregar pantalla de Login/Registro en App.tsx:
1. Detectar si hay usuario autenticado con `onAuthStateChange()`
2. Mostrar pantalla de login si no hay usuario
3. Mostrar app principal si hay usuario autenticado

¿Quieres que agregue la pantalla de autenticación ahora?

/**
 * Firebase Configuration
 * 
 * To enable Multiplayer/Room features:
 * 1. Create a project at https://console.firebase.google.com/
 * 2. Create a specific Web App in the settings.
 * 3. Copy the "firebaseConfig" object below.
 * 4. Enable "Realtime Database" in the Firebase Console.
 * 5. Update the Database Rules to allow read/write (see README or FIREBASE_SETUP.md).
 * 
 * If this config is empty or invalid, the app will run in "Local Mode".
 */
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456",
    measurementId: "G-ABCDEF123"
};

# Firebase Setup Guide for Wheel of Names

This project uses Firebase Realtime Database to enable multiplayer features (Rooms/Hosting). Because these features require a backend database, you must provide your own free Firebase configuration.

## Step 1: Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add project**.
3. Name it `wheel-of-names` (or anything you like).
4. Disable Google Analytics (optional, simpler without it).
5. Click **Create project**.

## Step 2: Create a Web App
1. On your project dashboard, click the **Web icon (`</>`)** to add an allowance.
2. Register the app (name it `WheelApp`).
3. **Important:** You will see a `firebaseConfig` object. Keep this tab open or copy it!

## Step 3: Enable Realtime Database
1. In the left menu, go to **Build** > **Realtime Database**.
2. Click **Create Database**.
3. Choose a location (e.g., `us-central1`).
4. Start in **Test mode** (or Locked mode, we will change rules anyway).
5. Click **Enable**.

## Step 4: Update Security Rules
To make the app work without complicated authentication (for this demo), we need to allow anyone to read/write to the specific `rooms` path.

1. Go to the **Rules** tab in Realtime Database.
2. Replace the rules with this configuration:

```json
{
  "rules": {
    "rooms": {
      ".read": true,
      ".write": true,
      "$roomId": {
        // Optional: specific sub-validations (e.g. data types)
      }
    }
  }
}
```
3. Click **Publish**.

> [!WARNING] 
> These rules allow anyone with your API key to write to the `rooms` path. For a pure hobby project this is usually fine, but be aware.

## Step 5: Configure the Code
1. Open the file `js/config.js` in your project folder.
2. Uncomment the `firebaseConfig` object.
3. Replace the placeholder values with the ones you copied in **Step 2**.

```javascript
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.firebasestorage.app",
    messagingSenderId: "123456789",
    appId: "1:12345:web:abcde"
};
```

**That's it!** Refresh your page (or restart the local server), and the "Rooms" interface will appear.

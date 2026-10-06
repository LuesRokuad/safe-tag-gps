// SAFE TAG — CONFIGURATION FIREBASE
// Cette configuration Web Firebase peut être publique côté navigateur.
// Ne jamais mettre ici de mot de passe Wi‑Fi, clé privée Admin SDK ou secret serveur.

window.SAFETAG_FIREBASE_CONFIG = {
  apiKey: "AIzaSyAnYINGLTJpDc7ECJZmQeVC6RWT38JlG60",
  authDomain: "safetag-e5811.firebaseapp.com",
  databaseURL: "https://safetag-e5811-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "safetag-e5811",
  storageBucket: "safetag-e5811.firebasestorage.app",
  messagingSenderId: "1080650349997",
  appId: "1:1080650349997:web:007750284d70b1b51c3524",
  measurementId: "G-V6D0WPSHCD"
};

// Le Wemos écrit dans :
// https://safetag-e5811-default-rtdb.asia-southeast1.firebasedatabase.app/safetag/position.json
window.SAFETAG_GPS_PATH = "safetag/position";

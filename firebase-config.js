// ======================================================
// SAFE TAG — CONFIGURATION FIREBASE
// ======================================================
//
// Tant que Firebase n'est pas prêt, LAISSEZ null.
// Le site n'affichera aucune fausse donnée.
//
// Quand votre camarade vous donne le firebaseConfig,
// remplacez null par l'objet reçu.
//
// Exemple :
// window.SAFETAG_FIREBASE_CONFIG = {
//   apiKey: "...",
//   authDomain: "...",
//   databaseURL: "https://...",
//   projectId: "...",
//   storageBucket: "...",
//   messagingSenderId: "...",
//   appId: "..."
// };
//
// Le chemin doit correspondre à l'endroit où le Wemos
// écrit les données GPS dans Realtime Database.
//
window.SAFETAG_FIREBASE_CONFIG = null;
window.SAFETAG_GPS_PATH = "gps";

const config = window.SAFETAG_FIREBASE_CONFIG;

if (!config) {
  throw new Error("Configuration Firebase manquante.");
}

if (!firebase.apps.length) {
  firebase.initializeApp(config);
}

const auth = firebase.auth();
const db = firebase.database();

const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");

function emailKey(email) {
  return btoa(unescape(encodeURIComponent(email.trim().toLowerCase())))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function showForm(mode) {
  const login = mode === "login";
  loginTab.classList.toggle("active", login);
  registerTab.classList.toggle("active", !login);
  loginForm.classList.toggle("hidden", !login);
  registerForm.classList.toggle("hidden", login);
}

function setMessage(id, text, type = "") {
  const el = document.getElementById(id);
  el.textContent = text;
  el.className = "auth-message" + (type ? " " + type : "");
}

function friendlyError(error) {
  const code = error?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "E-mail ou mot de passe incorrect.";
  if (code.includes("user-not-found")) return "Aucun compte ne correspond à cet e-mail.";
  if (code.includes("email-already-in-use")) return "Un compte existe déjà avec cet e-mail.";
  if (code.includes("weak-password")) return "Le mot de passe doit contenir au moins 6 caractères.";
  if (code.includes("invalid-email")) return "Adresse e-mail invalide.";
  if (code.includes("too-many-requests")) return "Trop de tentatives. Réessaie un peu plus tard.";
  return error?.message || "Une erreur est survenue.";
}

loginTab.addEventListener("click", () => showForm("login"));
registerTab.addEventListener("click", () => showForm("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  setMessage("loginMessage", "Connexion…");

  try {
    await auth.signInWithEmailAndPassword(
      document.getElementById("loginEmail").value.trim(),
      document.getElementById("loginPassword").value
    );
    location.replace("./dashboard.html");
  } catch (error) {
    setMessage("loginMessage", friendlyError(error), "error");
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = document.getElementById("registerName").value.trim();
  const email = document.getElementById("registerEmail").value.trim().toLowerCase();
  const password = document.getElementById("registerPassword").value;
  const confirm = document.getElementById("registerPasswordConfirm").value;

  if (password !== confirm) {
    setMessage("registerMessage", "Les mots de passe ne correspondent pas.", "error");
    return;
  }

  setMessage("registerMessage", "Création du compte…");

  try {
    const credential = await auth.createUserWithEmailAndPassword(email, password);
    await credential.user.updateProfile({ displayName: name });

    const profile = {
      displayName: name,
      email,
      createdAt: firebase.database.ServerValue.TIMESTAMP
    };

    const updates = {};
    updates["profiles/" + credential.user.uid] = profile;
    updates["directory/" + emailKey(email)] = {
      uid: credential.user.uid,
      displayName: name,
      email
    };

    await db.ref().update(updates);
    location.replace("./dashboard.html");
  } catch (error) {
    setMessage("registerMessage", friendlyError(error), "error");
  }
});

auth.onAuthStateChanged((user) => {
  if (user) location.replace("./dashboard.html");
});
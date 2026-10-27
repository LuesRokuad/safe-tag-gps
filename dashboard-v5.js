const config = window.SAFETAG_FIREBASE_CONFIG;
if (!config) throw new Error("Configuration Firebase manquante.");
if (!firebase.apps.length) firebase.initializeApp(config);

const auth = firebase.auth();
const db = firebase.database();

let currentUser = null;
let currentDeviceId = null;
let currentRole = null;
let currentMeta = null;
let positionRef = null;
let legacyPositionRef = null;
let membersRef = null;
let map;
let gpsMarker = null;
let lastPosition = null;
let history = [];
let lastFirebaseEventAt = 0;
let lastUpdateFromDevice = null;
let offlineTimer = null;
let legacyFallbackUsed = false;

const fields = [
  "lat","lng","accuracy","satellites","satHero","hdop","hdopHero","hdopText",
  "qualityBadge","altitude","altText","speed","speedText","age","chars","fixes",
  "errors","gpsTime","gpsDate","wifiRSSI","gpsStatus","lastUpdateHero","satText"
];

const $ = (id) => document.getElementById(id);
const setText = (id, value) => { const el = $(id); if (el) el.textContent = value ?? ""; };

function emailKey(email) {
  return btoa(unescape(encodeURIComponent(email.trim().toLowerCase())))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function setInlineMessage(id, text, type = "") {
  const el = $(id);
  el.textContent = text;
  el.className = "inline-message" + (type ? " " + type : "");
}

function setConnection(state, text) {
  setText("connectionText", text);
  $("statusDot").className =
    state === "online" ? "status-dot online" :
    state === "error" ? "status-dot error" :
    "status-dot waiting";
}

function clearTelemetry({ keepMarker = false } = {}) {
  fields.forEach(id => setText(id, ""));
  document.querySelectorAll("#signalBars span").forEach(bar => bar.style.opacity = ".12");

  if (!keepMarker && gpsMarker) {
    gpsMarker.remove();
    gpsMarker = null;
    lastPosition = null;
  }

  if (!keepMarker) {
    $("focusBtn").disabled = true;
    $("mapEmpty").classList.remove("hidden");
  }

  $("mapStatusText").textContent = keepMarker ? "Dernière position connue" : "En attente";
  $("mapStatusDot").className = keepMarker ? "status-dot error" : "status-dot waiting";
}

function initMap() {
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: [0, 0],
    zoom: 2,
    attributionControl: true
  });

  map.addControl(new maplibregl.NavigationControl(), "bottom-right");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 120, unit: "metric" }), "bottom-left");
}

function getNumber(data, ...keys) {
  for (const key of keys) {
    if (data && data[key] !== undefined && data[key] !== null && data[key] !== "") {
      const n = Number(data[key]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function getValue(data, ...keys) {
  for (const key of keys) {
    if (data && data[key] !== undefined && data[key] !== null && data[key] !== "") return data[key];
  }
  return null;
}

function qualityFromHdop(hdop) {
  if (hdop === null) return null;
  if (hdop < 1) return { label: "Excellente", detail: "Très précis", accuracy: "± 5 m", bars: 5 };
  if (hdop < 2) return { label: "Très bonne", detail: "Bonne précision", accuracy: "± 10 m", bars: 4 };
  if (hdop < 5) return { label: "Correcte", detail: "Précision moyenne", accuracy: "± 20 m", bars: 3 };
  return { label: "Faible", detail: "Signal faible", accuracy: "± 50 m+", bars: 2 };
}

function updateBars(count) {
  document.querySelectorAll("#signalBars span").forEach((bar, index) => {
    bar.style.opacity = count && index < count ? "1" : ".12";
  });
}

function addHistory(lat, lng, time) {
  const prev = history[0];
  if (prev && Math.abs(prev.lat - lat) < 0.000001 && Math.abs(prev.lng - lng) < 0.000001) return;
  history.unshift({ lat, lng, time });
  history = history.slice(0, 12);
  renderHistory();
}

function renderHistory() {
  const list = $("historyList");
  list.innerHTML = "";
  history.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-item";
    row.innerHTML = `
      <div class="coords">
        <strong>${item.lat.toFixed(6)}, ${item.lng.toFixed(6)}</strong>
        <small>${item.time}</small>
      </div>
      <span>📍</span>
    `;
    list.appendChild(row);
  });
  $("clearHistoryBtn").disabled = history.length === 0;
}

function updateUI(raw) {
  lastFirebaseEventAt = Date.now();

  const lat = getNumber(raw, "latitude", "lat");
  const lng = getNumber(raw, "longitude", "lng", "lon");
  const satellites = getNumber(raw, "satellites", "sat");
  const hdop = getNumber(raw, "hdop");
  const altitude = getNumber(raw, "altitude", "alt");
  const speed = getNumber(raw, "speed", "vitesse");
  const age = getNumber(raw, "age");
  const chars = getNumber(raw, "chars");
  const fixes = getNumber(raw, "fixes");
  const errors = getNumber(raw, "errors");
  const gpsTime = getValue(raw, "time", "gpsTime", "heure");
  const gpsDate = getValue(raw, "date");
  const wifiRSSI = getNumber(raw, "wifiRSSI");
  const valid = getValue(raw, "valid");
  const lastUpdate = getNumber(raw, "lastUpdate", "timestamp", "updatedAt");

  lastUpdateFromDevice = lastUpdate;

  setText("lat", lat !== null ? lat.toFixed(6) : "");
  setText("lng", lng !== null ? lng.toFixed(6) : "");
  setText("satellites", satellites !== null ? String(satellites) : "");
  setText("satHero", satellites !== null ? String(satellites) : "");
  setText("satText", satellites !== null ? "Donnée Firebase" : "");
  setText("hdop", hdop !== null ? hdop.toFixed(2) : "");
  setText("hdopHero", hdop !== null ? hdop.toFixed(2) : "");
  setText("altitude", altitude !== null ? `${altitude.toFixed(1)} m` : "");
  setText("altText", altitude !== null ? "Donnée Firebase" : "");
  setText("speed", speed !== null ? `${speed.toFixed(1)} km/h` : "");
  setText("speedText", speed !== null ? "Donnée Firebase" : "");
  setText("age", age !== null ? `${age} ms` : "");
  setText("chars", chars !== null ? String(chars) : "");
  setText("fixes", fixes !== null ? String(fixes) : "");
  setText("errors", errors !== null ? String(errors) : "");
  setText("gpsTime", gpsTime !== null ? String(gpsTime) : "");
  setText("gpsDate", gpsDate !== null ? String(gpsDate) : "");
  setText("wifiRSSI", wifiRSSI !== null ? `${wifiRSSI} dBm` : "");

  if (valid === true || valid === "true") setText("gpsStatus", "Position valide");
  else if (valid === false || valid === "false") setText("gpsStatus", "Position invalide");
  else setText("gpsStatus", "");

  const q = qualityFromHdop(hdop);
  setText("qualityBadge", q ? q.label : "");
  setText("hdopText", q ? q.detail : "");
  setText("accuracy", q ? q.accuracy : "");
  updateBars(q ? q.bars : 0);

  const now = new Date().toLocaleTimeString("fr-FR");
  setText("lastUpdateHero", now);

  if (lat !== null && lng !== null) {
    lastPosition = [lat, lng];

    const popupHtml =
      "<strong>" + (currentMeta?.name || currentDeviceId || "SafeTag") + "</strong><br>" +
      "Position GPS actuelle<br>" +
      "Latitude : " + lat.toFixed(6) + "<br>" +
      "Longitude : " + lng.toFixed(6) +
      (satellites !== null ? "<br>Satellites : " + satellites : "") +
      (hdop !== null ? "<br>HDOP : " + hdop.toFixed(2) : "");

    if (!gpsMarker) {
      const markerEl = document.createElement("div");
      markerEl.className = "safe-marker";

      gpsMarker = new maplibregl.Marker({ element: markerEl, anchor: "center" })
        .setLngLat([lng, lat])
        .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupHtml))
        .addTo(map);

      map.jumpTo({ center: [lng, lat], zoom: 17 });
    } else {
      gpsMarker.setLngLat([lng, lat]);
      gpsMarker.getPopup().setHTML(popupHtml);
    }

    $("mapEmpty").classList.add("hidden");
    $("focusBtn").disabled = false;
    $("mapStatusText").textContent = "Position reçue";
    $("mapStatusDot").className = "status-dot online";
    addHistory(lat, lng, now);
  }
}

function telemetryAgeMs() {
  if (lastUpdateFromDevice !== null) {
    const ts = lastUpdateFromDevice < 100000000000 ? lastUpdateFromDevice * 1000 : lastUpdateFromDevice;
    return Math.max(0, Date.now() - ts);
  }
  return lastFirebaseEventAt ? Date.now() - lastFirebaseEventAt : Infinity;
}

function updateOnlineState() {
  if (!currentDeviceId) return;
  const age = telemetryAgeMs();

  if (age <= 10000) {
    setConnection("online", "SafeTag connecté");
    if (lastPosition) {
      $("mapStatusText").textContent = "Position en direct";
      $("mapStatusDot").className = "status-dot online";
    }
  } else {
    setConnection("error", "SafeTag hors ligne");
    if (lastPosition) {
      $("mapStatusText").textContent = "Dernière position connue";
      $("mapStatusDot").className = "status-dot error";
      setText("lastUpdateHero", age === Infinity ? "Inconnue" : "il y a " + Math.floor(age / 1000) + " s");
    }
  }
}

function detachDeviceListeners() {
  if (positionRef) positionRef.off();
  if (legacyPositionRef) legacyPositionRef.off();
  if (membersRef) membersRef.off();
  positionRef = legacyPositionRef = membersRef = null;
  lastFirebaseEventAt = 0;
  lastUpdateFromDevice = null;
  legacyFallbackUsed = false;
}

async function loadDevices() {
  const snap = await db.ref("userDevices/" + currentUser.uid).once("value");
  const devices = snap.val() || {};
  const ids = Object.keys(devices);

  const select = $("deviceSelect");
  select.innerHTML = "";

  if (!ids.length) {
    currentDeviceId = null;
    $("trackerContent").classList.add("hidden");
    $("noDevicePanel").classList.remove("hidden");
    $("manageAccessBtn").classList.add("hidden");
    return;
  }

  $("noDevicePanel").classList.add("hidden");
  ids.forEach(id => {
    const option = document.createElement("option");
    option.value = id;
    option.textContent = devices[id]?.name || id;
    select.appendChild(option);
  });

  const preferred = localStorage.getItem("safetag.device");
  const chosen = preferred && ids.includes(preferred) ? preferred : ids[0];
  select.value = chosen;
  await selectDevice(chosen);
}

async function selectDevice(deviceId) {
  detachDeviceListeners();
  clearTelemetry();
  history = [];
  renderHistory();
  currentDeviceId = deviceId;
  localStorage.setItem("safetag.device", deviceId);

  const [metaSnap, memberSnap] = await Promise.all([
    db.ref("devices/" + deviceId + "/meta").once("value"),
    db.ref("devices/" + deviceId + "/members/" + currentUser.uid).once("value")
  ]);

  currentMeta = metaSnap.val() || {};
  const membership = memberSnap.val();

  if (!membership && currentMeta.ownerUid !== currentUser.uid) {
    alert("Tu n'as plus accès à cet appareil.");
    await db.ref("userDevices/" + currentUser.uid + "/" + deviceId).remove();
    return loadDevices();
  }

  currentRole = currentMeta.ownerUid === currentUser.uid ? "owner" : (membership?.role || "viewer");

  setText("deviceNameHero", currentMeta.name || deviceId);
  setText(
    "deviceRoleText",
    currentRole === "owner" ? "Tu es propriétaire de cet appareil." :
    currentRole === "admin" ? "Tu es administrateur de cet appareil." :
    "Tu as un accès membre à cet appareil."
  );

  const canManage = currentRole === "owner" || currentRole === "admin";
  $("manageAccessBtn").classList.toggle("hidden", !canManage);
  $("trackerContent").classList.remove("hidden");
  $("adminPanel").classList.add("hidden");

  setTimeout(() => {
    if (map) map.resize();
  }, 100);

  positionRef = db.ref("devices/" + deviceId + "/position");
  positionRef.on("value", async (snapshot) => {
    if (snapshot.exists()) {
      if (legacyPositionRef) { legacyPositionRef.off(); legacyPositionRef = null; }
      legacyFallbackUsed = false;
      updateUI(snapshot.val());
      return;
    }

    if (deviceId === "ST-0001" && !legacyFallbackUsed) {
      legacyFallbackUsed = true;
      legacyPositionRef = db.ref(window.SAFETAG_GPS_PATH || "safetag/position");
      legacyPositionRef.on("value", legacySnap => {
        if (legacySnap.exists()) updateUI(legacySnap.val());
      });
    }
  });

  if (canManage) watchMembers();
}

async function claimPrototype() {
  setInlineMessage("claimMessage", "Vérification de ST-0001…");
  const metaRef = db.ref("devices/ST-0001/meta");

  try {
    const metaSnap = await metaRef.once("value");
    const meta = metaSnap.val();

    if (meta?.ownerUid && meta.ownerUid !== currentUser.uid) {
      setInlineMessage("claimMessage", "ST-0001 possède déjà un propriétaire. Demande-lui de t'ajouter.", "error");
      return;
    }

    if (!meta?.ownerUid) {
      setInlineMessage("claimMessage", "1/3 — Création du propriétaire…");
      try {
        await metaRef.set({
          name: "SafeTag Prototype",
          ownerUid: currentUser.uid,
          createdAt: firebase.database.ServerValue.TIMESTAMP
        });
      } catch (error) {
        throw new Error("Étape 1 (propriétaire) refusée : " + (error.code || error.message));
      }
    }

    setInlineMessage("claimMessage", "2/3 — Création de ton accès propriétaire…");
    try {
      await db.ref("devices/ST-0001/members/" + currentUser.uid).set({
        role: "owner",
        email: currentUser.email,
        displayName: currentUser.displayName || currentUser.email,
        addedAt: firebase.database.ServerValue.TIMESTAMP
      });
    } catch (error) {
      throw new Error("Étape 2 (membre owner) refusée : " + (error.code || error.message));
    }

    setInlineMessage("claimMessage", "3/3 — Ajout de l'appareil à ton compte…");
    try {
      await db.ref("userDevices/" + currentUser.uid + "/ST-0001").set({
        name: "SafeTag Prototype",
        role: "owner"
      });
    } catch (error) {
      throw new Error("Étape 3 (userDevices) refusée : " + (error.code || error.message));
    }

    setInlineMessage("claimMessage", "Appareil associé avec succès.", "success");
    await loadDevices();
  } catch (error) {
    console.error("Association ST-0001:", error);
    setInlineMessage("claimMessage", error.message || "Association impossible.", "error");
  }
}

function watchMembers() {
  membersRef = db.ref("devices/" + currentDeviceId + "/members");
  membersRef.on("value", snapshot => renderMembers(snapshot.val() || {}));
}

function renderMembers(members) {
  const list = $("membersList");
  list.innerHTML = "";

  Object.entries(members).forEach(([uid, member]) => {
    const isOwner = uid === currentMeta.ownerUid || member.role === "owner";
    const row = document.createElement("div");
    row.className = "member-row";

    const main = document.createElement("div");
    main.className = "member-main";
    const name = document.createElement("strong");
    name.textContent = member.displayName || member.email || uid;
    const email = document.createElement("span");
    email.textContent = member.email || uid;
    main.append(name, email);

    const badge = document.createElement("span");
    badge.className = "role-badge";
    badge.textContent = isOwner ? "Propriétaire" : member.role === "admin" ? "Admin" : "Membre";

    const actions = document.createElement("div");
    actions.className = "member-actions";

    if (!isOwner && (currentRole === "owner" || currentRole === "admin")) {
      const roleSelect = document.createElement("select");
      roleSelect.innerHTML = '<option value="viewer">Membre</option><option value="admin">Admin</option>';
      roleSelect.value = member.role === "admin" ? "admin" : "viewer";
      roleSelect.addEventListener("change", () => changeMemberRole(uid, roleSelect.value));

      const removeBtn = document.createElement("button");
      removeBtn.className = "mini-btn danger";
      removeBtn.textContent = "Retirer";
      removeBtn.addEventListener("click", () => removeMember(uid));

      actions.append(roleSelect, removeBtn);
    }

    row.append(main, badge, actions);
    list.appendChild(row);
  });
}

async function addMember() {
  const email = $("inviteEmail").value.trim().toLowerCase();
  const role = $("inviteRole").value;
  if (!email) return;

  setInlineMessage("adminMessage", "Recherche du compte…");

  try {
    const directorySnap = await db.ref("directory/" + emailKey(email)).once("value");
    const profile = directorySnap.val();

    if (!profile?.uid) {
      setInlineMessage("adminMessage", "Aucun compte SafeTag trouvé avec cet e-mail.", "error");
      return;
    }

    if (profile.uid === currentMeta.ownerUid) {
      setInlineMessage("adminMessage", "Ce compte est déjà propriétaire.", "error");
      return;
    }

    const updates = {};
    updates["devices/" + currentDeviceId + "/members/" + profile.uid] = {
      role,
      email: profile.email || email,
      displayName: profile.displayName || email,
      addedAt: firebase.database.ServerValue.TIMESTAMP
    };
    updates["userDevices/" + profile.uid + "/" + currentDeviceId] = {
      role,
      name: currentMeta.name || currentDeviceId
    };

    await db.ref().update(updates);
    $("inviteEmail").value = "";
    setInlineMessage("adminMessage", "Accès ajouté.", "success");
  } catch (error) {
    console.error(error);
    setInlineMessage("adminMessage", "Impossible d'ajouter ce compte.", "error");
  }
}

async function changeMemberRole(uid, role) {
  const updates = {};
  updates["devices/" + currentDeviceId + "/members/" + uid + "/role"] = role;
  updates["userDevices/" + uid + "/" + currentDeviceId + "/role"] = role;
  await db.ref().update(updates);
}

async function removeMember(uid) {
  if (!confirm("Retirer l'accès de cet utilisateur ?")) return;
  const updates = {};
  updates["devices/" + currentDeviceId + "/members/" + uid] = null;
  updates["userDevices/" + uid + "/" + currentDeviceId] = null;
  await db.ref().update(updates);
}

async function renameDevice() {
  const name = $("deviceNameInput").value.trim();
  if (!name) return;

  const membersSnap = await db.ref("devices/" + currentDeviceId + "/members").once("value");
  const members = membersSnap.val() || {};
  const updates = {};
  updates["devices/" + currentDeviceId + "/meta/name"] = name;

  Object.keys(members).forEach(uid => {
    updates["userDevices/" + uid + "/" + currentDeviceId + "/name"] = name;
  });

  await db.ref().update(updates);
  currentMeta.name = name;
  setText("deviceNameHero", name);
  await loadDevices();
}

function openAdmin() {
  $("adminPanel").classList.remove("hidden");
  $("deviceNameInput").value = currentMeta?.name || currentDeviceId || "";
  $("adminPanel").scrollIntoView({ behavior: "smooth", block: "start" });
}

$("deviceSelect").addEventListener("change", event => selectDevice(event.target.value));
$("focusBtn").addEventListener("click", () => {
  if (!lastPosition) return;
  map.flyTo({ center: [lastPosition[1], lastPosition[0]], zoom: Math.max(map.getZoom(), 17), duration: 800 });
  if (gpsMarker) gpsMarker.togglePopup();
});
$("clearHistoryBtn").addEventListener("click", () => { history = []; renderHistory(); });
$("accountBtn").addEventListener("click", () => $("accountPanel").classList.toggle("hidden"));
$("logoutBtn").addEventListener("click", () => auth.signOut());
$("claimBtn").addEventListener("click", claimPrototype);
$("claimBtnMain").addEventListener("click", claimPrototype);
$("manageAccessBtn").addEventListener("click", openAdmin);
$("closeAdminBtn").addEventListener("click", () => $("adminPanel").classList.add("hidden"));
$("inviteBtn").addEventListener("click", addMember);
$("renameDeviceBtn").addEventListener("click", renameDevice);

initMap();
renderHistory();
offlineTimer = setInterval(updateOnlineState, 1000);

auth.onAuthStateChanged(async (user) => {
  if (!user) {
    location.replace("./index.html");
    return;
  }

  currentUser = user;
  setText("accountName", user.displayName || "Utilisateur SafeTag");
  setText("accountEmail", user.email || "");

  try {
    await loadDevices();
  } catch (error) {
    console.error(error);
    setConnection("error", "Erreur de permissions Firebase");
  }
});
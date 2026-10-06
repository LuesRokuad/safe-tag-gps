// SAFE TAG — Firebase -> site web
// Aucune donnée GPS n'est simulée.

let map;
let gpsMarker = null;
let lastPosition = null;
let history = [];

const fields = [
  "lat","lng","accuracy","satellites","satHero","hdop","hdopHero","hdopText",
  "qualityBadge","altitude","altText","speed","speedText","age","chars","fixes",
  "errors","gpsTime","gpsDate","wifiRSSI","gpsStatus","lastUpdateHero","satText"
];

function $(id) {
  return document.getElementById(id);
}

function setText(id, value) {
  const el = $(id);
  if (el) el.textContent = value ?? "";
}

function clearData() {
  fields.forEach(id => setText(id, ""));
  document.querySelectorAll("#signalBars span").forEach(bar => bar.style.opacity = ".12");

  if (gpsMarker && map) {
    map.removeLayer(gpsMarker);
    gpsMarker = null;
  }

  lastPosition = null;
  $("focusBtn").disabled = true;
  $("mapEmpty").classList.remove("hidden");
  $("mapStatusText").textContent = "En attente";
  $("mapStatusDot").className = "status-dot waiting";
}

function setConnection(state, text) {
  setText("connectionText", text);
  const dot = $("statusDot");
  dot.className =
    state === "online" ? "status-dot online" :
    state === "error" ? "status-dot error" :
    "status-dot waiting";
}

function initMap() {
  map = L.map("map", {
    zoomControl: false,
    attributionControl: true
  }).setView([0, 0], 2);

  L.control.zoom({ position: "bottomright" }).addTo(map);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    {
      maxZoom: 20,
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO"
    }
  ).addTo(map);
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
    if (data && data[key] !== undefined && data[key] !== null && data[key] !== "") {
      return data[key];
    }
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
  if (
    prev &&
    Math.abs(prev.lat - lat) < 0.000001 &&
    Math.abs(prev.lng - lng) < 0.000001
  ) return;

  history.unshift({ lat, lng, time });
  history = history.slice(0, 10);
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

    const markerIcon = L.divIcon({
      className: "",
      html: '<div class="safe-marker"></div>',
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    if (!gpsMarker) {
      gpsMarker = L.marker(lastPosition, { icon: markerIcon }).addTo(map);
      gpsMarker.bindPopup("<strong>SafeTag</strong><br>Position reçue depuis Firebase");
      map.setView(lastPosition, 16);
    } else {
      gpsMarker.setLatLng(lastPosition);
    }

    $("mapEmpty").classList.add("hidden");
    $("focusBtn").disabled = false;
    $("mapStatusText").textContent = "Position reçue";
    $("mapStatusDot").className = "status-dot online";
    addHistory(lat, lng, now);
  } else {
    if (gpsMarker) {
      map.removeLayer(gpsMarker);
      gpsMarker = null;
    }
    lastPosition = null;
    $("focusBtn").disabled = true;
    $("mapEmpty").classList.remove("hidden");
    $("mapStatusText").textContent = "Aucune position";
    $("mapStatusDot").className = "status-dot waiting";
  }
}

function connectFirebase() {
  clearData();
  renderHistory();

  const config = window.SAFETAG_FIREBASE_CONFIG;
  const path = window.SAFETAG_GPS_PATH || "gps";

  if (!config) {
    setConnection("waiting", "Firebase non configuré");
    return;
  }

  try {
    firebase.initializeApp(config);
    const database = firebase.database();
    const gpsRef = database.ref(path);

    setConnection("waiting", "Connexion à Firebase…");

    gpsRef.on(
      "value",
      snapshot => {
        if (!snapshot.exists()) {
          clearData();
          setConnection("online", "Firebase connecté");
          return;
        }

        const data = snapshot.val();
        if (!data || typeof data !== "object") {
          clearData();
          setConnection("online", "Firebase connecté");
          return;
        }

        setConnection("online", "Firebase connecté");
        updateUI(data);
      },
      error => {
        console.error("Firebase:", error);
        clearData();
        setConnection("error", "Erreur Firebase");
      }
    );
  } catch (error) {
    console.error("Initialisation Firebase:", error);
    clearData();
    setConnection("error", "Configuration Firebase invalide");
  }
}

$("focusBtn").addEventListener("click", () => {
  if (!lastPosition) return;
  map.flyTo(lastPosition, Math.max(map.getZoom(), 16), { duration: .8 });
  if (gpsMarker) gpsMarker.openPopup();
});

$("clearHistoryBtn").addEventListener("click", () => {
  history = [];
  renderHistory();
});

function updateClock() {
  setText("clock", new Date().toLocaleTimeString("fr-FR"));
}

initMap();
clearData();
renderHistory();
updateClock();
setInterval(updateClock, 1000);
connectFirebase();
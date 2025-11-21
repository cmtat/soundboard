const manifestPath = "audio/manifest.json";
const orderStorageKey = "soundboardOrder";
const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const statusEl = document.getElementById("status");
const nowPlayingEl = document.getElementById("now-playing");
const emptyState = document.getElementById("empty-state");
const player = document.getElementById("player");
const playerTitle = document.getElementById("player-title");
const playerTime = document.getElementById("player-time");
const playerSeek = document.getElementById("player-seek");

let clips = [];
let filteredClips = [];
let currentAudio = null;
let currentId = null;
let draggingFile = null;
let audioContext = null;
let gainNode = null;
let compressor = null;
let currentSourceNode = null;

playerSeek.addEventListener("input", () => {
  if (!currentAudio || Number.isNaN(currentAudio.duration)) return;
  const pct = Number(playerSeek.value) / 100;
  currentAudio.currentTime = pct * currentAudio.duration;
});

const humanize = (fileName) =>
  fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

async function loadManifest() {
  try {
    const response = await fetch(manifestPath, { cache: "no-cache" });
    if (!response.ok) {
      throw new Error(`Manifest missing (${response.status})`);
    }
    const data = await response.json();
    clips = applySavedOrder(
      (data.clips || []).map((clip) => ({
        file: clip.file,
        title: clip.title || humanize(clip.file),
        size: clip.sizeBytes,
      }))
    );
    applySearch("");
    setStatus(clips.length ? `Loaded ${clips.length} clip(s)` : "No clips loaded");
  } catch (error) {
    setStatus(
      `Could not load manifest. Make sure audio files exist and run node scripts/generate-manifest.js (${error.message}).`
    );
    render();
  }
}

function setStatus(message) {
  statusEl.textContent = message;
}

function applySavedOrder(list) {
  const saved = loadSavedOrder();
  if (!saved || !saved.length) return list;

  const map = new Map(list.map((clip) => [clip.file, clip]));
  const ordered = [];

  saved.forEach((file) => {
    if (map.has(file)) {
      ordered.push(map.get(file));
      map.delete(file);
    }
  });

  // Any new files not seen before get appended in alphabetical order.
  const remaining = Array.from(map.values()).sort((a, b) => a.file.localeCompare(b.file));
  return ordered.concat(remaining);
}

function loadSavedOrder() {
  try {
    const raw = localStorage.getItem(orderStorageKey);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function persistOrder(list) {
  try {
    localStorage.setItem(orderStorageKey, JSON.stringify(list.map((clip) => clip.file)));
  } catch {
    // ignore if storage is unavailable (e.g., private mode)
  }
}

function render() {
  grid.innerHTML = "";
  if (!filteredClips.length) {
    emptyState.classList.add("visible");
    nowPlayingEl.textContent = "—";
    hidePlayer();
    return;
  }

  emptyState.classList.remove("visible");
  filteredClips.forEach((clip, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.clipId = `${index}`;
    card.dataset.file = clip.file;
    card.setAttribute("draggable", "true");

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = clip.title;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Play";
    button.addEventListener("click", () => handlePlay(card, clip));

    card.appendChild(title);
    card.appendChild(button);
    grid.appendChild(card);

    card.addEventListener("dragstart", (event) => {
      draggingFile = clip.file;
      event.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      draggingFile = null;
      card.classList.remove("dragging");
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      if (!draggingFile || draggingFile === clip.file) return;
      reorderClips(draggingFile, clip.file);
    });
  });
}

function handlePlay(card, clip) {
  const clipPath = `audio/${clip.file}`;

  if (currentId === clip.file && currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentId = null;
    card.classList.remove("playing");
    card.querySelector("button").textContent = "Play";
    nowPlayingEl.textContent = "—";
    return;
  }

  stopCurrent();

  currentAudio = new Audio(clipPath);
  const { context, gain, comp } = ensureAudioGraph();
  cleanupSource();
  currentSourceNode = context.createMediaElementSource(currentAudio);
  currentSourceNode.connect(gain).connect(comp).connect(context.destination);
  currentId = clip.file;
  nowPlayingEl.textContent = clip.title;
  playerTitle.textContent = clip.title;
  setPlaying(card, true);
  showPlayer();

  currentAudio.addEventListener("ended", () => {
    setPlaying(card, false);
    resetPlayer();
    nowPlayingEl.textContent = "—";
    currentId = null;
  });

  currentAudio.addEventListener("error", () => {
    setStatus(`Could not play ${clip.file}`);
    setPlaying(card, false);
    resetPlayer();
    nowPlayingEl.textContent = "—";
    currentId = null;
  });

  currentAudio.addEventListener("loadedmetadata", updatePlayerTime);
  currentAudio.addEventListener("timeupdate", updatePlayerTime);

  currentAudio.play();
}

function setPlaying(card, isPlaying) {
  document.querySelectorAll(".card.playing").forEach((el) => {
    if (el !== card) {
      el.classList.remove("playing");
      const btn = el.querySelector("button");
      if (btn) btn.textContent = "Play";
    }
  });

  if (isPlaying) {
    card.classList.add("playing");
    card.querySelector("button").textContent = "Pause";
  } else {
    card.classList.remove("playing");
    card.querySelector("button").textContent = "Play";
  }
}

function stopCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
  }
  cleanupSource();
  currentId = null;
  document.querySelectorAll(".card.playing").forEach((card) => {
    setPlaying(card, false);
  });
  resetPlayer();
}

function reorderClips(sourceFile, targetFile) {
  const fromIndex = clips.findIndex((clip) => clip.file === sourceFile);
  const toIndex = clips.findIndex((clip) => clip.file === targetFile);
  if (fromIndex === -1 || toIndex === -1) return;

  const [moved] = clips.splice(fromIndex, 1);
  clips.splice(toIndex, 0, moved);
  persistOrder(clips);
  applySearch(searchInput.value);
}

function applySearch(term) {
  const normalized = term.trim().toLowerCase();
  filteredClips = clips.filter((clip) => clip.title.toLowerCase().includes(normalized));
  render();
  setStatus(`${filteredClips.length} match${filteredClips.length === 1 ? "" : "es"}`);
}

searchInput.addEventListener("input", () => {
  applySearch(searchInput.value);
});

loadManifest();

function ensureAudioGraph() {
  if (!audioContext) {
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  }

  if (!gainNode) {
    gainNode = audioContext.createGain();
    gainNode.gain.value = 0.9; // slight trim to avoid clipping when compressing
  }

  if (!compressor) {
    compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 20;
    compressor.ratio.value = 8;
    compressor.attack.value = 0.005;
    compressor.release.value = 0.08;
  }

  return { context: audioContext, gain: gainNode, comp: compressor };
}

function updatePlayerTime() {
  if (!currentAudio || Number.isNaN(currentAudio.duration)) {
    playerTime.textContent = "00:00 / 00:00";
    playerSeek.value = 0;
    playerSeek.disabled = true;
    return;
  }

  const duration = currentAudio.duration;
  const current = currentAudio.currentTime;
  playerTime.textContent = `${formatTime(current)} / ${formatTime(duration)}`;
  playerSeek.value = Math.min(100, (current / duration) * 100);
  playerSeek.disabled = false;
}

function formatTime(time) {
  if (!Number.isFinite(time)) return "00:00";
  const minutes = Math.floor(time / 60);
  const seconds = Math.floor(time % 60);
  return `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
}

function showPlayer() {
  player.hidden = false;
}

function hidePlayer() {
  player.hidden = true;
}

function resetPlayer() {
  playerSeek.value = 0;
  playerSeek.disabled = true;
  playerTime.textContent = "00:00 / 00:00";
  if (!currentId) {
    playerTitle.textContent = "—";
    hidePlayer();
  }
}

function cleanupSource() {
  if (currentSourceNode) {
    try {
      currentSourceNode.disconnect();
    } catch {
      // ignore
    }
    currentSourceNode = null;
  }
}

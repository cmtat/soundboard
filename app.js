const manifestPath = "audio/manifest.json";
const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const statusEl = document.getElementById("status");
const nowPlayingEl = document.getElementById("now-playing");
const emptyState = document.getElementById("empty-state");

let clips = [];
let filteredClips = [];
let currentAudio = null;
let currentId = null;

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
    clips = (data.clips || []).map((clip) => ({
      file: clip.file,
      title: clip.title || humanize(clip.file),
      size: clip.sizeBytes,
    }));
    filteredClips = clips;
    render();
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

function render() {
  grid.innerHTML = "";
  if (!filteredClips.length) {
    emptyState.classList.add("visible");
    nowPlayingEl.textContent = "—";
    return;
  }

  emptyState.classList.remove("visible");
  filteredClips.forEach((clip, index) => {
    const card = document.createElement("article");
    card.className = "card";
    card.dataset.clipId = `${index}`;

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = clip.title;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = clip.size ? formatSize(clip.size) : clip.file;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Play";
    button.addEventListener("click", () => handlePlay(card, clip));

    card.appendChild(title);
    card.appendChild(meta);
    card.appendChild(button);
    grid.appendChild(card);
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
  currentId = clip.file;
  nowPlayingEl.textContent = clip.title;
  setPlaying(card, true);

  currentAudio.addEventListener("ended", () => {
    setPlaying(card, false);
    nowPlayingEl.textContent = "—";
    currentId = null;
  });

  currentAudio.addEventListener("error", () => {
    setStatus(`Could not play ${clip.file}`);
    setPlaying(card, false);
    nowPlayingEl.textContent = "—";
    currentId = null;
  });

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
  currentId = null;
  document.querySelectorAll(".card.playing").forEach((card) => {
    setPlaying(card, false);
  });
}

function formatSize(bytes) {
  if (!bytes || Number.isNaN(bytes)) return "";
  const units = ["B", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

searchInput.addEventListener("input", () => {
  const term = searchInput.value.trim().toLowerCase();
  filteredClips = clips.filter((clip) => clip.title.toLowerCase().includes(term));
  render();
  setStatus(`${filteredClips.length} match${filteredClips.length === 1 ? "" : "es"}`);
});

loadManifest();

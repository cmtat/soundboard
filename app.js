const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const statusEl = document.getElementById("status");
const nowPlayingEl = document.getElementById("now-playing");
const emptyState = document.getElementById("empty-state");
const reloadButton = document.getElementById("reload");

let clips = [];
let filteredClips = [];
let currentAudio = null;
let currentId = null;

const humanize = (fileName) =>
  fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function setStatus(message) {
  statusEl.textContent = message;
}

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "Local file";
  const units = ["B", "KB", "MB", "GB"];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }

  return `${size.toFixed(size >= 10 || size % 1 === 0 ? 0 : 1)} ${units[unitIndex]}`;
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
    card.dataset.file = clip.id;

    const title = document.createElement("p");
    title.className = "title";
    title.textContent = clip.title;

    const meta = document.createElement("p");
    meta.className = "meta";
    meta.textContent = `${formatBytes(clip.size)} • ${clip.file}`;

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
  if (currentId === clip.id && currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentId = null;
    card.classList.remove("playing");
    card.querySelector("button").textContent = "Play";
    nowPlayingEl.textContent = "—";
    return;
  }

  stopCurrent();

  currentAudio = new Audio(clip.url);
  currentId = clip.id;
  nowPlayingEl.textContent = clip.title;
  setPlaying(card, true);

  currentAudio.addEventListener("ended", () => {
    setPlaying(card, false);
    nowPlayingEl.textContent = "—";
    currentId = null;
  });

  currentAudio.addEventListener("error", () => {
    setStatus(`Could not play ${clip.title}`);
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

function applySearch(term) {
  const normalized = term.trim().toLowerCase();
  filteredClips = clips.filter((clip) => clip.title.toLowerCase().includes(normalized));
  render();
  setStatus(`${filteredClips.length} match${filteredClips.length === 1 ? "" : "es"}`);
}

async function loadManifest() {
  setStatus("Loading clips…");
  try {
    const response = await fetch("./audio/manifest.json", { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json();
    const manifestClips = Array.isArray(data.clips) ? data.clips : [];
    clips = manifestClips.map((clip) => ({
      id: clip.file,
      file: clip.file,
      title: humanize(clip.file),
      url: `audio/${encodeURIComponent(clip.file)}`,
      size: clip.sizeBytes,
    }));
    applySearch(searchInput.value);
    const label = data.generatedAt ? `Updated ${new Date(data.generatedAt).toLocaleString()}` : "Manifest loaded";
    setStatus(clips.length ? `${clips.length} clip(s) • ${label}` : "No clips yet.");
  } catch (error) {
    clips = [];
    filteredClips = [];
    render();
    const extra =
      window.location.protocol === "file:" ? " Serve this folder with a local server so the manifest can be fetched." : "";
    setStatus(`Could not load clips (${error.message}).${extra}`);
  }
}

searchInput.addEventListener("input", () => {
  applySearch(searchInput.value);
});

reloadButton.addEventListener("click", () => {
  stopCurrent();
  loadManifest();
});

loadManifest();

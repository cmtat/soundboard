import {
  client,
  account,
  databases,
  storage,
  ID,
  Permission,
  Role,
  Query,
} from "./appwrite.js";

client.ping().catch((error) => {
  console.warn("Appwrite ping failed", error);
});

const DB_ID = "soundboard";
const TABLE_ID = "sounds";
const BUCKET_ID = "sounds";
const orderStorageKey = "soundboardOrder";
const grid = document.getElementById("grid");
const searchInput = document.getElementById("search");
const statusEl = document.getElementById("status");
const nowPlayingEl = document.getElementById("now-playing");
const emptyState = document.getElementById("empty-state");
const signInButton = document.getElementById("sign-in");
const signOutButton = document.getElementById("sign-out");
const fileInput = document.getElementById("file-input");
const uploadButton = document.getElementById("upload");
const userStatus = document.getElementById("user-status");

let clips = [];
let filteredClips = [];
let currentAudio = null;
let currentId = null;
let draggingFile = null;
let currentUser = null;

const humanize = (fileName) =>
  fileName
    .replace(/\.[^/.]+$/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

function setStatus(message) {
  statusEl.textContent = message;
}

function setUserStatus(user) {
  if (user) {
    userStatus.textContent = `Signed in as ${user.email || user.name || user.$id}`;
    signInButton.textContent = "Re-auth Google";
  } else {
    userStatus.textContent = "Not signed in";
    signInButton.textContent = "Sign in with Google";
  }
}

function applySavedOrder(list) {
  const saved = loadSavedOrder();
  if (!saved || !saved.length) return list;

  const map = new Map(list.map((clip) => [clip.id, clip]));
  const ordered = [];

  saved.forEach((id) => {
    if (map.has(id)) {
      ordered.push(map.get(id));
      map.delete(id);
    }
  });

  // Any new files not seen before get appended in alphabetical order.
  const remaining = Array.from(map.values()).sort((a, b) => a.title.localeCompare(b.title));
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
    localStorage.setItem(orderStorageKey, JSON.stringify(list.map((clip) => clip.id)));
  } catch {
    // ignore if storage is unavailable (e.g., private mode)
  }
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
      draggingFile = clip.id;
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
      if (!draggingFile || draggingFile === clip.id) return;
      reorderClips(draggingFile, clip.id);
    });
  });
}

function handlePlay(card, clip) {
  const clipPath = clip.url;

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

  currentAudio = new Audio(clipPath);
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

function reorderClips(sourceFile, targetFile) {
  const fromIndex = clips.findIndex((clip) => clip.id === sourceFile);
  const toIndex = clips.findIndex((clip) => clip.id === targetFile);
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

async function ensureSession(interactive = false) {
  try {
    currentUser = await account.get();
    setUserStatus(currentUser);
    return currentUser;
  } catch (error) {
    if (!interactive) {
      setUserStatus(null);
      return null;
    }
    await account.createOAuth2Session("google", window.location.origin, window.location.origin);
    return null;
  }
}

async function loadFromAppwrite() {
  try {
    const user = await ensureSession(false);
    if (!user) {
      setStatus("Sign in to load your sounds");
      clips = [];
      filteredClips = [];
      render();
      return;
    }

    const { documents } = await databases.listDocuments(DB_ID, TABLE_ID, [Query.orderDesc("$createdAt")]);
    clips = applySavedOrder(
      documents
        .filter((doc) => (doc.$permissions || []).some((p) => p.includes(`user:${user.$id}`)))
        .map((doc) => ({
          id: doc.$id,
          title: doc.name || humanize(doc.fileId || "Clip"),
          url: storage.getFileView(BUCKET_ID, doc.fileId),
          size: doc.size,
        }))
    );
    applySearch("");
    setStatus(clips.length ? `Loaded ${clips.length} clip(s)` : "No clips yet. Upload one to get started.");
  } catch (error) {
    setStatus(`Could not load sounds (${error.message})`);
    render();
  }
}

async function handleUpload() {
  const file = fileInput.files?.[0];
  if (!file) {
    setStatus("Select an audio file to upload");
    return;
  }
  uploadButton.disabled = true;
  setStatus("Uploading…");
  try {
    const user = await ensureSession(true);
    if (!user) return;

    const perms = [Permission.read(Role.user(user.$id)), Permission.write(Role.user(user.$id))];
    const uploaded = await storage.createFile(BUCKET_ID, ID.unique(), file, perms);
    await databases.createDocument(
      DB_ID,
      TABLE_ID,
      ID.unique(),
      {
        name: file.name,
        fileId: uploaded.$id,
        size: file.size,
        mimeType: file.type || null,
      },
      perms
    );
    setStatus("Upload complete");
    fileInput.value = "";
    await loadFromAppwrite();
  } catch (error) {
    setStatus(`Upload failed (${error.message})`);
  } finally {
    uploadButton.disabled = false;
  }
}

signInButton.addEventListener("click", () => {
  ensureSession(true).then(() => loadFromAppwrite());
});

signOutButton.addEventListener("click", async () => {
  try {
    await account.deleteSession("current");
    currentUser = null;
    setUserStatus(null);
    clips = [];
    filteredClips = [];
    render();
    setStatus("Signed out");
  } catch (error) {
    setStatus(`Sign out failed (${error.message})`);
  }
});

uploadButton.addEventListener("click", handleUpload);

setUserStatus(null);
loadFromAppwrite();

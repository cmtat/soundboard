// Worker that serves static assets and generates audio/manifest.json on the fly
// based on the deployed assets. This keeps the site in sync whenever new audio
// files are added without needing to check in a prebuilt manifest.
import manifestJSON from "__STATIC_CONTENT_MANIFEST";

const STATIC_MANIFEST = JSON.parse(manifestJSON);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".ogg", ".m4a", ".flac", ".aac"]);

const isPeanut = (name) => /\(peanut\)/i.test(name);
const getExt = (file) => {
  const idx = file.lastIndexOf(".");
  return idx === -1 ? "" : file.slice(idx).toLowerCase();
};

function buildAudioManifest() {
  const clips = Object.keys(STATIC_MANIFEST)
    .filter((key) => key.startsWith("audio/"))
    .filter((key) => key !== "audio/manifest.json")
    .filter((key) => AUDIO_EXTS.has(getExt(key)))
    .map((key) => ({
      file: key.replace(/^audio\//, ""),
      sizeBytes: null, // size is not available from the static manifest
    }))
    .sort((a, b) => {
      const aPeanut = isPeanut(a.file);
      const bPeanut = isPeanut(b.file);
      if (aPeanut && !bPeanut) return -1;
      if (!aPeanut && bPeanut) return 1;
      return a.file.localeCompare(b.file);
    });

  return {
    generatedAt: new Date().toISOString(),
    clips,
  };
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === "/audio/manifest.json") {
      const body = JSON.stringify(buildAudioManifest(), null, 2);
      return new Response(body, {
        status: 200,
        headers: {
          "content-type": "application/json; charset=utf-8",
          "cache-control": "no-cache",
        },
      });
    }

    // Fallback to serving static assets
    return env.ASSETS.fetch(request);
  },
};

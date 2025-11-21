# Soundboard

Static soundboard you can host on GitHub Pages. Drop audio files into `audio/`, refresh the manifest, and the page will auto-list and play them.

## Getting started

1. Add audio files to `audio/` (mp3, wav, ogg, m4a, flac, aac are supported).
2. Regenerate the manifest so the UI sees the new files:

   ```bash
   node scripts/generate-manifest.js
   ```

3. Commit and push. If you enable GitHub Pages (Settings → Pages → Deploy from branch → `main`), the site will serve from `index.html`.

You can preview locally by opening `index.html` in a browser or using a simple static server (e.g., `python -m http.server`).

## How it works

- `audio/manifest.json` lists the available clips. The generator script scans the folder, captures filenames and sizes, and writes the manifest.
- `app.js` fetches the manifest at load, renders a grid, and lets you search, play, and pause clips. Only one clip plays at a time.
- `style.css` handles the layout and theming tuned for a single-page GitHub Pages deployment.

## Updating clips

Any time you add, remove, or rename audio:

```bash
node scripts/generate-manifest.js
```

Commit both the audio files and the updated `audio/manifest.json` so GitHub Pages can serve them.

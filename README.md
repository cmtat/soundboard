# Soundboard

Static soundboard you can host on GitHub Pages. Drop audio files into `audio/`, refresh the manifest, and the page will auto-list and play them.

## Getting started

1. Add audio files to `audio/` (mp3, wav, ogg, m4a, flac, aac are supported).
2. Regenerate the manifest so the UI sees the new files:

   ```bash
   npm run generate
   ```

3. Commit and push. If you enable GitHub Pages (Settings → Pages → Deploy from branch → `main`), the site will serve from `index.html`.

You can preview locally with a simple static server (e.g., `python -m http.server`). The page fetches `audio/manifest.json`, so serving over HTTP avoids browser file:// fetch limits.

## How it works

- `audio/manifest.json` lists the available clips. The generator script scans the folder, captures filenames and sizes, and writes the manifest.
- `app.js` fetches the manifest at load (or when you click "Reload library"), renders a grid, and lets you search, play, and pause clips. Only one clip plays at a time.
- `style.css` handles the layout and theming tuned for a single-page GitHub Pages deployment.

## Cloudflare Pages setup

This is a static site—no workers or server code are needed. In Cloudflare Pages:

1. Framework preset: **None**.
2. Build command: `npm run generate` (or leave empty if the manifest is already committed).
3. Build output directory: `.` (the project root).
4. Production branch: `main`.

Do **not** set a custom deploy command like `npx wrangler deploy`—that expects a Worker entry point and will fail. Pages will host the static files directly.

## Updating clips

Any time you add, remove, or rename audio:

```bash
node scripts/generate-manifest.js
```

Commit both the audio files and the updated `audio/manifest.json` so GitHub Pages can serve them.

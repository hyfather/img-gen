# Canvas Camp

A Vercel-ready Next.js image canvas for making high-resolution, Pokemon-style card scenes with kid-friendly controls.

## What is included

- Floating object tray over a 1920 x 1080 dotted-grid canvas
- Pokemon object templates grouped by type
- PNG backgrounds loaded from `public/backgrounds`
- Selection, drag, resize, rotate, duplicate, delete, and layer controls
- Per-card settings menu with editable name, HP, type, move, color, and outline
- PNG export at 1x, 2x, or 4x resolution
- Playwright smoke test for page load and basic add/edit behavior

## Backgrounds

Add PNG files to `public/backgrounds`. The app lists every `.png` in that folder as a selectable canvas background.

## Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verify

```bash
npm run lint
npm run build
SMOKE_URL=http://localhost:3000 npm run smoke
```

The smoke test writes a screenshot to `/tmp/canvas-camp-smoke.png`.

## Deploy

Deploy directly on Vercel as a standard Next.js App Router project. The default build command is:

```bash
npm run build
```

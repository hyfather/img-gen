# Canvas Camp

A Vercel-ready Next.js coloring app that generates Pokemon outline PNGs with OpenRouter image models and makes them fillable with layered HTML canvas.

## What is included

- A 50-Pokemon category tree grouped by Pokemon type
- A staged workflow: choose Pokemon, choose pose, then generate
- OpenRouter image generation through a hardcoded `google/gemini-2.5-flash-lite` model
- Generated image assets stored in Vercel Blob, with a local `public/generated-coloring-pages` fallback
- A saved-variations rail for previously generated Pokemon and pose combinations
- Layered canvas coloring with mask, fill, and outline canvases
- Flood fill bounded by dark anti-aliased outline pixels
- Color swatches, custom color picker, undo, clear, regenerate, and PNG export
- Playwright smoke test with a mocked image-generation route

## Environment

Create a local env file with an OpenRouter key:

```bash
OPENROUTER_API_KEY=...
PUBLIC_READ_WRITE_TOKEN=...
PUBLIC_STORE_ID=...
```

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

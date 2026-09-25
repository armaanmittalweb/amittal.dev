# amittal.dev

Armaan Mittal's portfolio: a personal archive you unlock with a key. React 19, Vite, TypeScript, Zustand, and three.js r160 for the objects you handle.

```sh
npm install
npm run dev       # local dev server
npm run build     # typecheck, then build static files into dist/
npm run preview   # serve dist/ locally
npm run lint
```

## Deploying

The repo is connected to Vercel: every push to `main` builds and deploys to production at https://www.amittal.dev (the bare `amittal.dev` redirects there). [vercel.json](vercel.json) pins the build (`npm run build`, output `dist/`), so it doesn't depend on dashboard settings. The canonical URL, `og:image`, `robots.txt` and the sitemap all use `https://www.amittal.dev`.

## Editing content

- **Everything the site says** is in [src/data/content.ts](src/data/content.ts): profile, resume, links, projects, research, capabilities, the trace graph, easter eggs. Values in `[brackets]` are placeholders. `LINKS` still points the resume PDF, GitHub and LinkedIn at `#`.
- **Search and social metadata** is in [index.html](index.html): title, description, Open Graph tags, JSON-LD and the `<noscript>` summary.
- **The Inspect page** describes the stack from `LAYERS` in `content.ts`. Keep it matching `package.json`.
- **Social preview image**: [public/og.png](public/og.png) (1200×630).

## How it's put together

```
src/
  data/content.ts     all copy and data
  store.ts            one Zustand store: navigation, visits, eggs, settings (saved to localStorage)
  lib/                seed derivation, themes, audio drone, motion setting, 3D availability
  components/         screens (Entrance, Objective, Core, FastAccess) and views/ for each drawer
  three/              <vault-3d> and <archive-3d> web components, plain JS
```

- **3D is optional.** three.js is loaded with a dynamic import, so it arrives in its own chunk after the page is usable, and Fast Access never loads it. If WebGL is missing or fails, every view shows its text form: a drawer list, the trace as a list, stage buttons for the pipeline, and a flat bit grid for the seed.
- **Every 3D interaction has a DOM equivalent** that works with a keyboard: sidebar nav, the Trace list view, the pipeline stage buttons, the research list, and PREV/NEXT on Inspect.
- **Reduced motion** follows the OS setting, and the MOTION toggle overrides it. The setting is published on `<html data-motion>`. CSS transitions become instant, the 3D views show a still frame, and the Inspect glitch flash is skipped.
- **The seed** is 64 random bits from `crypto.getRandomValues`, folded to 32 bits for mulberry32. It only drives presentation. It is not a secret and not a security feature.

## legacy/

`legacy/amittal-archive-v4-export.html` is the original Claude Design export this project was rebuilt from. It is kept for reference and isn't part of the build.

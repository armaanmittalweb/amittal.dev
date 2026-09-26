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

- **Everything the site says** is in [src/data/content.ts](src/data/content.ts): profile, resume, links, projects, research, capabilities, the trace graph, easter eggs. The only email on the site is `LINKS.email` (me@amittal.dev); index.html repeats it in the JSON-LD and the `<noscript>` block.
- **Projects**: each entry in `PROJECTS` becomes a Lab drawing, a Fast Access row, a search result and a tick in the header (`TARGETS` is built from `PROJECTS`). `repo` and `live` add links; a private project gets a `sourceNote` instead. `CAPS[].projects`, `NODES[].project` and `OBJECTIVES[].path` refer to projects by `id`, so rename them together.
- **Resume PDF**: [public/Armaan_Mittal_Resume.pdf](public/Armaan_Mittal_Resume.pdf) is the public copy: the contact line reads me@amittal.dev, LinkedIn, GitHub and amittal.dev, with no phone number or personal email. Keep the private original out of the repo.
- **Portrait**: [public/portrait.jpg](public/portrait.jpg), 320×400. The source is small, so Identity shows it as a print inside the folder rather than full bleed.
- **Search and social metadata** is in [index.html](index.html): title, description, Open Graph tags, JSON-LD and the `<noscript>` summary.
- **The Inspect page** describes the stack from `LAYERS` in `content.ts`. Keep it matching `package.json`.
- **Social preview image**: [public/og.png](public/og.png) (1200×630).

## How it's put together

```
src/
  data/content.ts     all copy and data
  store.ts            one Zustand store: navigation, visits, eggs, settings (saved to localStorage)
  lib/                seed derivation, themes, sound (engine, synthesized effects, unlock timeline), motion setting, 3D availability
  components/         screens (Entrance, Objective, Core, FastAccess) and views/ for each drawer
  three/              <vault-3d> and <archive-3d> web components, plain JS
```

- **3D is optional.** three.js is loaded with a dynamic import, so it arrives in its own chunk after the page is usable, and Fast Access never loads it. If WebGL is missing or fails, every view shows its text form: a drawer list, the trace as a list, stage buttons for the pipeline, and a flat bit grid for the seed.
- **Every 3D interaction has a DOM equivalent** that works with a keyboard: sidebar nav, the Trace list view, the pipeline stage buttons, the research list, and PREV/NEXT on Inspect.
- **Reduced motion** follows the OS setting, and the MOTION toggle overrides it. The setting is published on `<html data-motion>`. CSS transitions become instant, the 3D views show a still frame, and the Inspect glitch flash is skipped.
- **Sound** is on by default and only ever follows something the visitor did; SOUND switches it all off and DRONE adds the seed-tuned drone. Every effect is synthesized with the Web Audio API in [src/lib/synth.ts](src/lib/synth.ts) (no audio files) and scheduled on the audio clock. The vault unlock's key, door, flat drawing and sounds all run from one timeline in [src/lib/unlock.ts](src/lib/unlock.ts), so they stay in step even when three.js loads late or WebGL is missing. In dev builds every scheduled sound is logged to `window.__sfxLog`.
- **The seed** is 64 random bits from `crypto.getRandomValues`, folded to 32 bits for mulberry32. It only drives presentation. It is not a secret and not a security feature.

## legacy/

`legacy/amittal-archive-v4-export.html` is the original Claude Design export this project was rebuilt from. It is kept for reference and isn't part of the build.

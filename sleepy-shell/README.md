# Manuel Valle Torre – Astro site

This `sleepy-shell/` folder contains the Astro project that powers <https://mvallet91.github.io/>. The site is built with:

- **Astro 4** for the static site framework
- **Tailwind CSS** (via `@astrojs/tailwind`) for styling and typography utilities
- **MDX** support ready for long-form content

The root of the repository hosts the production build that GitHub Pages serves from the `gh-pages` branch. Astro build output (`sleepy-shell/dist`) is copied there during deployment.

## � Prerequisites

- Node.js 18+ (Node 22 LTS works great)
- npm 9+

Run all commands from the repo root unless otherwise indicated.

```powershell
cd sleepy-shell
npm install
```

## 🚀 Local development

```powershell
npm run dev -- --host --port 4321
```

- Local URL: <http://localhost:4321/>
- `--host` is handy when testing on devices in the same network.

The interactive **AI in Education** report lives in `public/reports/ai-in-education/index.html`. Because it’s placed in `public/`, Astro copies it verbatim (including Tailwind CDN + Chart.js) so the interactive experience works without extra bundling.

## 🏗️ Build & preview

```powershell
npm run build
npm run preview
```

- `npm run build` outputs the static site to `sleepy-shell/dist/`.
- `npm run preview` serves the built site at <http://localhost:4321/> for a final smoke test.

To deploy to GitHub Pages, copy the contents of `sleepy-shell/dist/` to the branch root (see the repo-level `npm run deploy` script for an automated copy + push flow).

## ➕ Adding more reports

1. Drop the standalone experience (HTML/JS/CSS) inside `public/reports/<slug>/index.html`.
2. Register the report in `src/pages/reports.astro` so it appears in the directory page.
3. Optional: highlight it on `src/pages/index.astro` with a short blurb.

## 🧾 Useful scripts

| Command           | Description                                    |
| :---------------- | :--------------------------------------------- |
| `npm run dev`     | Start the Astro dev server                      |
| `npm run build`   | Generate static assets into `dist/`             |
| `npm run preview` | Preview the built site locally                  |
| `npm run astro …` | Access the Astro CLI for linting/checks/add-ons |

Astro documentation: <https://docs.astro.build>

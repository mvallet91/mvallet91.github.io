# Manuel Valle Torre Personal Site

This repository hosts the source for Manuel Valle Torre's personal website. The site is built with [Astro 4](https://astro.build/) and lives inside the `sleepy-shell/` directory.

## Project layout

- `sleepy-shell/` – Astro project containing pages, components, and assets.
- `.github/workflows/deploy.yml` – GitHub Actions workflow that builds the Astro project and publishes the static output.
- `master` branch – Receives the compiled static site that GitHub Pages serves.
- `gh-pages` branch – Contains the Astro source code. Push here to trigger deployments.

## Local development

```bash
cd sleepy-shell
npm install
npm run dev
```

The dev server runs at <http://localhost:4321> by default.

## Deployments

1. Make and commit changes on `gh-pages`.
2. Push to GitHub – the `Deploy Astro Site to GitHub Pages` workflow installs dependencies, runs `npm run build` inside `sleepy-shell`, and publishes the `sleepy-shell/dist` folder to the `master` branch using the bundled `GITHUB_TOKEN`.
3. GitHub Pages is configured to serve the `master` branch root, so the live site updates automatically once the workflow finishes.

### Manual build

If you need to inspect the production output locally:

```bash
cd sleepy-shell
npm run build
```

The static files live in `sleepy-shell/dist/`.

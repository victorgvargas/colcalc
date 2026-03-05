# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

## Deploying to Fly.io

The app is set up for deployment on [Fly.io](https://fly.io).

1. Install the [Fly CLI](https://fly.io/docs/hands-on/install-flyctl/) and sign in: `fly auth login`.
2. From the project root, create the app (first time only): `fly launch` — accept the Dockerfile and `fly.toml`, choose app name and region.
3. Deploy: `fly deploy`.

Subsequent deploys: run `fly deploy` from the project root. The app will be available at `https://<your-app-name>.fly.dev`.

## SEO

The app is set up for search engines:

- **Meta tags**: Default and per-route title, description, Open Graph, and Twitter Card tags (via `react-helmet-async`).
- **Canonical URLs**: Each route sets a canonical URL. Set `VITE_SITE_URL` (e.g. `https://colcalc.fly.dev`) when building for production so canonicals and sitemap references match your domain.
- **Sitemap & robots**: `public/sitemap.xml` and `public/robots.txt` are included. Update the domain in both files if you deploy to a different URL.
- **Structured data**: JSON-LD `WebApplication` schema in `index.html` for rich results.
- **Semantic headings**: One `<h1>` per page in the main content.

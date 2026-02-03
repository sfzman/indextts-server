# Repository Guidelines

This frontend powers the VoxClone voice cloning app in the larger `indextts-server` project. Keep changes focused on the Vite + React TypeScript UI and related service calls.

## Project Structure & Module Organization
- `index.html` provides global styles, Tailwind CDN setup, and the root mount node.
- `index.tsx` bootstraps React; `App.tsx` is the top-level app shell and auth gate.
- `components/` contains feature UI (`Auth.tsx`, `VoiceStudio.tsx`, `TaskList.tsx`).
- `services/` holds API and media helpers (`api.ts`, `taskService.ts`, `audioUtils.ts`, `geminiService.ts`).
- `types.ts` defines shared frontend and backend request/response types.
- Deployment assets live in `Dockerfile` and `nginx.conf`.

## Build, Test, and Development Commands
- `npm install` installs dependencies.
- `npm run dev` starts the Vite dev server (configured for port 3000).
- `npm run build` creates a production build.
- `npm run preview` serves the production build locally.

## Coding Style & Naming Conventions
- Use TypeScript + React function components; keep props and state explicitly typed.
- Indent with 2 spaces and follow the existing JSX + Tailwind utility class style.
- Component files use `PascalCase` (e.g., `VoiceStudio.tsx`); services use `camelCase` file names.
- Prefer shared types in `types.ts`; use the `@/` path alias for root imports.

## Testing Guidelines
- No automated test runner is configured in this repo. Validate changes by running `npm run dev` and a production build via `npm run build`.
- If you add tests or a test framework, document the new commands and conventions here.

## Commit & Pull Request Guidelines
- Follow the existing commit style: short conventional prefixes like `feat:`, `fix:`, `chore:` followed by a brief description (often bilingual/Chinese).
- PRs should include a clear summary, testing notes (commands run), and screenshots for UI changes.

## Configuration & Secrets
- Create `.env.local` with `GEMINI_API_KEY` for local development. Do not commit secrets.

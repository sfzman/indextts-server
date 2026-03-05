# Repository Guidelines

## Project Structure & Module Organization
This repository is a three-service monorepo:
- `frontend/`: React + TypeScript (Vite) UI (`components/`, `services/`, `types.ts`).
- `backend-server/`: Go API server (Gin + GORM) with layered folders: `handlers/`, `services/`, `models/`, `middleware/`, `config/`.
- `backend-inference/`: Python FastAPI TTS inference service (`app/`) and `indextts/` model code.
- `.github/workflows/`: CI/CD pipelines for deploying frontend and backend-server to Aliyun SAE.

Keep changes scoped to the relevant subproject; avoid cross-service edits unless required by an API or contract change.

## Build, Test, and Development Commands
- Frontend:
  - `cd frontend && npm install`
  - `npm run dev` (local dev server, default Vite port 3000)
  - `npm run build` (production build)
- Backend server:
  - `cd backend-server && cp .env.example .env`
  - `go run .` (start API on `:8080`)
  - `go test ./...` (run Go tests / compile checks)
- Backend inference:
  - `cd backend-inference && cp .env.example .env`
  - `make download-model && make run` (Docker GPU flow)
  - `make run-cpu` (CPU mode)
  - `python -m uvicorn app.main:app --reload --host 0.0.0.0 --port 8000` (non-Docker dev)

## Coding Style & Naming Conventions
- Go: format with `gofmt`; keep package names lowercase; exported identifiers in `PascalCase`.
- Python: follow PEP 8 (4-space indentation, snake_case names, type hints where practical).
- Frontend: React function components in `PascalCase` files (e.g., `VoiceStudio.tsx`); service modules in camelCase filenames (e.g., `taskService.ts`).

## Testing Guidelines
There is currently no comprehensive repo-wide automated test suite. Minimum validation before PR:
- `frontend`: `npm run build`
- `backend-server`: `go test ./...`
- `backend-inference`: service smoke check via `make test` (after startup) or a `/health` + `/api/v1/tts` curl check.

When adding tests, use standard naming:
- Go: `*_test.go` alongside the package under test.
- Python: `tests/test_*.py` (create `tests/` when introducing pytest).

## Commit & Pull Request Guidelines
- Follow the existing commit style: short conventional prefixes like `feat:`, `fix:`, `chore:`, `test:` (Chinese/English descriptions are both used in history).
- PRs should include:
  - What changed and why.
  - Commands run for verification.
  - Config/environment impact (`.env` keys, secrets, ports).
  - Screenshots for frontend UI changes.

## Security & Configuration Tips
- Use `.env.example` files as templates; never commit real secrets.
- Keep JWT keys, Aliyun credentials, and payment credentials in environment variables only.
- Note deployment trigger scope: pushes to `main` under `frontend/**` or `backend-server/**` trigger their respective deploy workflows.

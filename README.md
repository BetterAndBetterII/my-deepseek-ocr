My OCR
======

An end-to-end OCR product with:
- Backend: FastAPI + Async SQLAlchemy + JWT auth, streaming OCR via an OpenAI-compatible engine
- Frontend: React + Vite + Tailwind, real-time streaming UI for Image/PDF OCR
- Ops: Prometheus metrics, Alembic migrations, Dockerized backend and frontend (Nginx)

This README explains the architecture, how to develop locally, and how to deploy.

**High-Level Architecture**
- Frontend (Vite React) builds to static assets. In production it calls relative `"/api/..."` and Nginx proxies to the backend.
- Backend (FastAPI) exposes REST + streaming endpoints and persists usage in SQLite (async engine).
- OCR Engine is external, exposed as an OpenAI-compatible API (configured by env vars).
- Prometheus metrics are exposed by the backend at `/metrics` (also available at `/api/metrics`).

```
Browser ──> Nginx (serves SPA + proxies /api) ──> FastAPI (app/main.py)
                                              ├─> SQLite (usage + users)
                                              └─> AsyncOpenAI client -> OCR engine (OpenAI-compatible)
```

**Backend Overview**
- App factory and lifespan: `app/main.py:1`
  - Creates tables on startup, bootstraps a demo user, attaches metrics middleware, mounts routers.
- Configuration: `app/core/config.py:1`
  - Pydantic settings via `.env`. Controls auth toggle, DB URL, LLM/OpenAI base, model, default prompt.
- Database: `app/db.py:1`, models at `app/models.py:1`, Alembic config at `alembic/env.py:1`.
- Auth: `app/routers/auth.py:1`
  - OAuth2 password flow, JWT, optional anonymous mode when `AUTH_ENABLED=false`.
- Users + usage: `app/routers/users.py:1`
  - Current user, recent usage, usage summary.
- OCR: `app/routers/ocr.py:1`
  - `POST /ocr/image` streams content deltas (NDJSON).
  - `POST /ocr/pdf` converts PDF pages to images via `pypdfium2` and streams per-page events concurrently.
- OpenAI client: `app/ocr_client.py:1`
  - `AsyncOpenAI(base_url=LLM_BASE_URL, api_key=LLM_API_KEY)`.
- Metrics: `app/middleware.py:1` (HTTP metrics), `app/metrics.py:1` (Prometheus counters/gauges/histograms), route at `app/routers/metrics.py:1`.

**Streaming Format (NDJSON)**
- Image OCR
  - Start: `{ "type":"start", "kind":"image" }`
  - Delta: `{ "type":"delta", "delta":"..." }` (repeated)
  - End: `{ "type":"end", "usage":{ prompt_tokens, completion_tokens, prompt_chars, completion_chars, input_bytes } }`
- PDF OCR
  - Start: `{ "type":"start", "kind":"pdf", "pages":N }`
  - For each page i: `page_start` → many `page_delta` → `page_end`
  - End: `{ "type":"end", "usage":{ prompt_tokens, completion_tokens, prompt_chars, completion_chars, input_bytes, pages } }`

**Frontend Overview**
- Vite + React + TypeScript + Tailwind (shadcn UI components).
- Build-time API base: `frontend/src/lib/utils.ts:10`
  - Production forces `"/api"` so Nginx decides proxy target.
  - Development can override with `VITE_API_BASE_URL`.
- API client: `frontend/src/lib/api.ts:1` encapsulates fetches and streaming.
- Auth provider: `frontend/src/lib/auth.tsx:1` stores token and supports anonymous mode when backend disables auth.
- Main UI: `frontend/src/pages/Dashboard.tsx:1` handles uploads (image/PDF), streaming displays, usage summary/history.
- Streaming viewers: `frontend/src/components/StreamViewer.tsx:1`, `frontend/src/components/PdfStreamViewer.tsx:1`.
- Drag/drop + paste: `frontend/src/components/DropArea.tsx:1`, `frontend/src/components/UploadDropzone.tsx:1`.

**Backend API Endpoints (prefixed with `/api`)**
- Auth
  - `POST /api/auth/register` — register demo users
  - `POST /api/auth/token` — OAuth2 password flow (form `username`, `password`)
- Users
  - `GET /api/users/me` — current user
  - `GET /api/users/me/usage` — usage list (latest 200)
  - `GET /api/users/me/usage/summary` — totals (events, bytes, tokens, chars)
- OCR
  - `POST /api/ocr/image` — multipart `file` (+ optional `prompt`), NDJSON stream
  - `POST /api/ocr/pdf` — multipart `file` (+ optional `prompt`), NDJSON stream per page
- Metrics
  - `GET /metrics` — Prometheus exposition (compat)
  - `GET /api/metrics` — Prometheus exposition (same content)

**Configuration (Backend)**
- Required/important envs (`.env` supported):
  - `SECRET_KEY` (>= 8 chars), `ALGORITHM` (`HS256|HS384|HS512`), `ACCESS_TOKEN_EXPIRE_MINUTES`
  - `DATABASE_URL` (default `sqlite+aiosqlite:///./data.db`)
  - `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_PROMPT`
  - `AUTH_ENABLED` (default `false`), `ANON_USERNAME` (default `anonymous`)
  - `BOOTSTRAP_USER`/`BOOTSTRAP_PASS` for the demo user

**Configuration (Frontend)**
- Production API base is always `"/api"` and proxied by Nginx at runtime (prefix preserved).
- Development options:
  - Set `VITE_API_BASE_URL=http://localhost:8000` to call backend directly.
  - Or rely on Vite dev proxy in `frontend/vite.config.ts:17` (proxies `/api` → `http://localhost:8001/api` with prefix preserved). Adjust as needed.

**Local Development**
- Backend
  - Python deps: `pip install -r requirements.txt`
  - Run API: `uvicorn app.main:app --reload --port 8000`
  - Ensure OCR engine is reachable at `LLM_BASE_URL` (default `http://localhost:8000/v1`, change if conflicting with your API port).
- Frontend
  - `cd frontend && pnpm install`
  - Option A (direct): `VITE_API_BASE_URL=http://localhost:8000 pnpm dev`
  - Option B (proxy): set Vite proxy target in `frontend/vite.config.ts:17` to your API port and run `pnpm dev`

**Docker**
- Backend image
  - `docker build -t my-ocr-api:latest .`
  - Runs `uvicorn app.main:app --host 0.0.0.0 --port 8000`
- Frontend image
  - `cd frontend && docker build -t my-ocr-web:latest .`
  - Nginx serves `dist/`; `/api/` is proxied to `BACKEND_URL` at runtime via `frontend/docker-entrypoint.sh:1` and `frontend/nginx.conf.template:1`.

**Docker Compose**
- `docker compose up -d --build`
- Services:
  - `api`: FastAPI backend at `http://localhost:9000` (Prometheus `/metrics` exposed). DB persisted to volume `db-data` at `/app/_data`.
  - `web`: Frontend at `http://localhost:3000`. Build args `VITE_API_BASE_URL`/`NEXT_PUBLIC_API_BASE_URL` target `http://api:9000`.
  - `prometheus`: `http://localhost:9090`, scrapes `api:9000/metrics` every 5s (see `monitoring/prometheus.yml`).
  - `grafana`: `http://localhost:3001` (default admin/admin; override via env `GRAFANA_ADMIN_USER`/`GRAFANA_ADMIN_PASSWORD`). Pre-provisioned Prometheus datasource.
- Optional OCR engine:
  - `docker-compose.yml` contains a commented `engine` service. If you run your OCR engine in compose, enable it and keep `LLM_BASE_URL=http://engine:8000/v1`.

**Migrations (Alembic)**
- Autogenerate: `alembic revision --autogenerate -m "msg"`
- Upgrade: `alembic upgrade head`
- Downgrade: `alembic downgrade -1`

**Security Notes**
- Use a strong `SECRET_KEY` in production.
- Consider enabling `AUTH_ENABLED=true` to require tokens; otherwise requests run as `anonymous`.
- Restrict Nginx to only proxy intended routes under `/api/`.

**Known Notes / Gotchas**
- Dev proxy default is `http://localhost:8001` in `vite.config.ts`. Either run API on 8001, set `VITE_API_BASE_URL`, or change the proxy.
- PDF OCR depends on `pypdfium2`; in minimal environments it may need extra system libs.
- Token usage metrics depend on the OCR engine’s streaming support; code falls back to approximations when unavailable.

**Repository Pointers**
- Backend entry: `app/main.py:1`
- OCR router: `app/routers/ocr.py:1`
- Auth router: `app/routers/auth.py:1`
- Users + usage: `app/routers/users.py:1`
- Models: `app/models.py:1`
- Settings: `app/core/config.py:1`
- Frontend API base: `frontend/src/lib/utils.ts:10`
- Dev proxy: `frontend/vite.config.ts:17`

MIT-style license or your chosen terms can be added here.

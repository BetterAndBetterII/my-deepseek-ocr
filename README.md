My OCR FastAPI
===============

A fully-async FastAPI backend providing:
- OAuth2 (password flow) login via JWT
- Upload image for OCR (streamed text)
- Upload PDF for OCR (streamed text, per-page)
- User info and usage statistics (SQLite)

It uses a local DeepSeek OCR server exposed via an OpenAI-compatible API. The included demo (`demo/demo.py`) shows how to call that OCR server directly.

Quick start
-----------

1) Install dependencies (recommend `uv`):

   - `uv sync`
   - Or with pip: `pip install -e .`

2) Ensure you have a DeepSeek OCR server running with an OpenAI-compatible endpoint. Defaults match the demo:

   - `LLM_BASE_URL=http://localhost:8000/v1`
   - `LLM_API_KEY=token-abc123`
   - `LLM_MODEL=deepseek-ai/DeepSeek-OCR`

   Override via env vars if needed.

3) Run API (fully async):

   - `uvicorn app.main:app --reload --port 9000`

4) Auth and usage:

   - On startup a demo user is created: username `demo`, password `demo123` (override with `BOOTSTRAP_USER`, `BOOTSTRAP_PASS`).
   - Get token: `POST /auth/token` with form fields `username`, `password`.
   - Use the bearer token for protected endpoints.

Endpoints
---------

- `POST /auth/register` — create user (demo purpose)
- `POST /auth/token` — OAuth2 password flow
- `GET /users/me` — current user info
- `GET /users/me/usage` — recent usage events
- `GET /users/me/usage/summary` — usage aggregates
- `POST /ocr/image` — upload image file (png/jpeg/webp)
  - Form fields: `file`, optional `prompt`
  - Prompt: if omitted or empty, falls back to server config prompt (`LLM_PROMPT`)
  - Streaming format: `application/x-ndjson` (JSON Lines)
  - Events: `{type: start|delta|end, ...}`
- `POST /ocr/pdf` — upload PDF; requires `pypdfium2` to convert pages to images.
  - Form fields: `file`, optional `prompt`
  - Prompt: if omitted or empty, falls back to server config prompt (`LLM_PROMPT`)
  - Streaming format: `application/x-ndjson` (JSON Lines)。每页并发处理，按事件输出：
    - `{"type":"start","kind":"pdf","pages":N}`
    - `{"type":"page_start","page":i}`
    - `{"type":"page_delta","page":i,"delta":"..."}`
    - `{"type":"page_end","page":i,"usage":{prompt_tokens,completion_tokens,completion_chars}}`
    - `{"type":"end","usage":{prompt_tokens,completion_tokens,prompt_chars,completion_chars,input_bytes,pages}}`
  - If parsing fails, returns 400.
- `GET /metrics` — Prometheus metrics endpoint

Streaming
---------

Responses stream as `application/x-ndjson; charset=utf-8` (JSON Lines) via async generators.

Environment
-----------

- `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `DATABASE_URL` (default `sqlite+aiosqlite:///./data.db`)
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_PROMPT`
- `BOOTSTRAP_USER`, `BOOTSTRAP_PASS`
- `AUTH_ENABLED` (default `true`): set `false` to disable auth; all endpoints become open. When disabled, requests run as an auto-created `ANON_USERNAME` (default `anonymous`).
- `ANON_USERNAME` (default `anonymous`)

Config via .env
---------------

- Uses pydantic-settings; environment variables can be provided in a `.env` file.
- Copy `.env.example` to `.env` and adjust values:

  - `cp .env.example .env`

- Validation:
  - `SECRET_KEY` must be at least 8 characters
  - `ALGORITHM` must be one of `HS256`, `HS384`, `HS512`
  - `ACCESS_TOKEN_EXPIRE_MINUTES` must be 1..10080
  - `LLM_BASE_URL` must be a valid URL

Notes
-----

- Token usage may not be available from all backends during streaming; the app records character counts and input bytes by default.
- PDF support requires `pypdfium2`; if missing or parsing fails, the API returns 400 and does not attempt direct PDF input (not supported by the OpenAI-compatible backend).
- Password hashing uses PBKDF2-SHA256 (via passlib) to avoid bcrypt version/ABI issues and 72-byte length limit.
- Exposes Prometheus metrics: concurrency, OCR in-progress, request counters, latency histograms, token counts (real usage when available; fallback approx chars/4), user count, image/pdf counters.

Prometheus Metrics
------------------

- `http_in_flight_requests` (gauge): current in-flight HTTP requests
- `http_requests_total{method, path, status}` (counter): total HTTP requests
- `http_request_duration_seconds{method, path}` (histogram): request duration (includes streaming)
- `ocr_in_progress{kind}` (gauge): current OCR operations in progress (`image`/`pdf`)
- `ocr_requests_total{kind}` (counter): total OCR requests by kind
- `image_requests_total`, `pdf_requests_total` (counter): total image/PDF OCR requests
- `ocr_processing_seconds{kind}` (histogram): total OCR processing time (per request)
- `ocr_input_bytes_total{kind}` (counter): total input bytes by kind
- `users_total` (gauge): registered users
- `prompt_tokens_total`, `completion_tokens_total`, `tokens_total` (counter): token counts (approx chars/4)
Database Migrations (Alembic)
-----------------------------

This repo includes Alembic setup for schema migrations (async SQLite by default).

- Initialize (already done in repo): `alembic.ini`, `alembic/env.py`, and versions directory exist.
- Create a new migration from models (autogenerate):

  - `alembic revision --autogenerate -m "describe changes"`

- Apply migrations to latest:

  - `alembic upgrade head`

- Downgrade one step:

  - `alembic downgrade -1`

Notes:
- Alembic reads DB URL from `.env` via application settings. Ensure `.env` has `DATABASE_URL` (default `sqlite+aiosqlite:///./data.db`).
- If you prefer overriding URL at runtime, you can set env var `DATABASE_URL` before running Alembic.
- The app still creates tables on startup for convenience in dev. For production, run `alembic upgrade head` instead of relying on auto-create.

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
- `POST /ocr/image` — upload image file (png/jpeg/webp), streams text
- `POST /ocr/pdf` — upload PDF, streams text; converts pages via `pypdfium2` when available, otherwise attempts direct PDF data URL

Streaming
---------

Responses stream as `text/plain; charset=utf-8` via async generators using OpenAI Async API.

Environment
-----------

- `SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`
- `DATABASE_URL` (default `sqlite:///./data.db`)
  - For async: default is `sqlite+aiosqlite:///./data.db`
- `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_PROMPT`
- `BOOTSTRAP_USER`, `BOOTSTRAP_PASS`

Notes
-----

- Token usage may not be available from all backends during streaming; the app records character counts and input bytes by default.
- PDF support requires `pypdfium2`; if missing, the app attempts to send the PDF as a base64 data URL which may or may not be supported by your OCR server.

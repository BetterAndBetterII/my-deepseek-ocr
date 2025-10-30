# My OCR Frontend

React + Vite + Tailwind + shadcn UI. Supports:

- OAuth2 username/password login against FastAPI (`/auth/token`)
- Register (`/auth/register`)
- Paste, click, or drag-and-drop upload for images and PDFs
- Streaming OCR result display (plain text streaming)
- User info + usage summary/history
- Auto-skip login when backend disables auth (`AUTH_ENABLED=false`)

## Dev Setup

- Install pnpm if not installed
- From `frontend/` run:

```
pnpm install
pnpm dev
```

The dev server proxies `/api` to `http://localhost:8000` (FastAPI). Adjust in `vite.config.ts` or set `VITE_API_BASE_URL` env to override.

## Build

```
pnpm build
pnpm preview
```

## Notes

- Uses localStorage to store access token.
- If backend sets `AUTH_ENABLED=false`, frontend detects it by calling `/users/me` without a token and skips the login flow.
- Backend endpoints used:
  - `POST /auth/register` JSON {username, password}
  - `POST /auth/token` form `username`, `password`
  - `GET /users/me`
  - `GET /users/me/usage` and `/users/me/usage/summary`
  - `POST /ocr/image` and `/ocr/pdf` with `multipart/form-data` field `file`, response is streaming `text/plain`.

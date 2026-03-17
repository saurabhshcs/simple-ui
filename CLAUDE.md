# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Simple UI** — a lightweight GenAI chat interface (similar to ChatGPT/Claude/Copilot) with user-configurable API keys, multi-provider model selection, file upload with document parsing, email+OTP+device-registration auth, and a CSS-variable theming system with custom background images.

## Commands

```bash
# Development (both client + server, hot reload)
npm run dev

# Individual workspaces
npm run dev -w client    # React/Vite on :5173
npm run dev -w server    # Express on :3001

# Database migrations
npm run migrate          # Apply all pending migrations
npm run migrate:rollback # Roll back the last migration

# Build
npm run build
```

## Environment Setup

Copy `.env.example` to `.env` and fill in:
- `JWT_SECRET` — 64-char hex (generate: `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"`)
- `ENCRYPTION_SECRET` — any long random string
- SMTP credentials for OTP/device emails

## Architecture

### Monorepo (npm workspaces)
- `client/` — React 19 + Vite 8 + TypeScript SPA
- `server/` — Express.js + TypeScript API
- `shared/types.ts` — API contract types imported by both sides

The Vite dev server proxies `/api` and `/uploads` to `localhost:3001`, so the client makes all requests to its own origin.

### Authentication Flow
`email+password` → OTP email → 6-digit code verify → device fingerprint check → device registration email (new devices only) → JWT with session-table revocation. All JWTs include a `jti` stored in the `sessions` table — middleware verifies the token is not revoked and the device is confirmed.

### LLM Adapter Pattern
`server/src/services/llm/LLMAdapter.ts` defines the `LLMAdapter` interface. Three adapters implement it: `OpenAIAdapter`, `AnthropicAdapter`, `GeminiAdapter`. `adapterFactory.ts` creates the right adapter by provider name. All streaming goes via SSE (`text/event-stream`). Model lists are cached 5 minutes in-memory.

### Theming System
Five pre-defined themes in `client/src/themes/themes.ts`, each defining CSS custom property maps. `settingsStore.ts` applies themes by calling `document.documentElement.style.setProperty` — no re-renders required. The active theme ID is persisted to `localStorage`. Background images are uploaded to the server and their URL is stored in `localStorage`.

### State Management (Zustand)
- `authStore` — user, JWT token, login/logout
- `chatStore` — conversations, messages, streaming state, pending file attachments
- `settingsStore` — active theme, background URL, selected model/provider

### File Upload
Files (PDF, JPG, PNG, DOCX, DOC, XLSX, XLS — max 5MB) are uploaded to `POST /api/files/upload`. Server-side: images stored as base64 (passed to vision APIs), documents text-extracted (pdf-parse, mammoth, xlsx/SheetJS). Files auto-deleted after 24 hours.

### API Key Security
API keys are encrypted with AES-256-GCM before DB storage (`encryptionService.ts`). Stored format: `iv:tag:ciphertext` (all hex). The `ENCRYPTION_SECRET` env var derives the 256-bit key via `crypto.scryptSync`.

## Database (SQLite/Knex)
Tables: `users`, `otp_codes`, `devices`, `sessions`, `api_keys`, `conversations`, `messages`, `files`. Migrations in `server/src/db/migrations/`. Knex supports SQLite (dev) and PostgreSQL (prod) — swap `DB_PATH` vs `DATABASE_URL`.

## Key Files
- `server/src/services/llm/LLMAdapter.ts` — LLM provider interface (stable contract)
- `server/src/app.ts` — Express middleware ordering (helmet → cors → rate-limit → routes)
- `client/src/hooks/useChat.ts` — SSE stream consumer, token accumulation, store updates
- `client/src/themes/themes.ts` — all theme CSS variable definitions
- `shared/types.ts` — API request/response types shared by client and server

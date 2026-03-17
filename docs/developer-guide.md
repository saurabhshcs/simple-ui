# Developer Guide

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| Node.js | ≥ 20.14 | Check with `node -v` |
| npm | ≥ 10 | Bundled with Node |
| Java | Any | Only needed for FakeSMTP (dev) |

---

## First-Time Setup

```bash
# 1. Clone and install all workspaces
git clone <repo>
cd simple-ui
npm install

# 2. Create environment file
cp .env.example .env
# Edit .env — fill in JWT_SECRET and ENCRYPTION_SECRET at minimum

# 3. Run database migrations
npm run migrate

# 4. Start local SMTP (dev only — picks up OTP/device emails)
mailpit --smtp 127.0.0.1:2525 --listen 127.0.0.1:8025
# View emails at http://127.0.0.1:8025

# 5. Start dev servers (hot reload)
npm run dev
# Client → http://localhost:5173
# Server → http://localhost:3001
```

---

## Project Structure

```
simple-ui/
├── client/src/
│   ├── api/            # Axios client + JWT interceptor
│   ├── components/     # auth/, chat/, layout/, settings/, shared/
│   ├── hooks/          # useChat (SSE consumer)
│   ├── pages/          # LoginPage
│   ├── stores/         # Zustand: authStore, chatStore, settingsStore
│   ├── themes/         # 5 built-in themes (CSS variable maps)
│   └── utils/          # deviceFingerprint, formatters
│
├── server/src/
│   ├── config/         # env vars (index.ts), Knex (database.ts)
│   ├── db/migrations/  # 001–008: schema history
│   ├── middleware/      # auth (JWT+session), upload, rateLimit
│   ├── routes/         # auth, chat, models, settings, files
│   └── services/
│       ├── auth/        # jwtService, otpService, deviceService, encryptionService
│       ├── email/       # emailService (Nodemailer)
│       ├── llm/         # LLMAdapter interface + 3 provider adapters
│       └── storage/     # fileService (text extraction)
│
├── shared/types.ts     # API contract types used by both client and server
├── architecture/       # PlantUML diagrams
└── docs/               # This folder
```

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default 3001) |
| `NODE_ENV` | No | `development` or `production` |
| `JWT_SECRET` | **Yes** | 64-char hex — generate with `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` |
| `ENCRYPTION_SECRET` | **Yes** | Any long random string — used to derive the AES-256 key for API key encryption |
| `DB_PATH` | No | SQLite file path (default `server/data/simple-ui.sqlite`) |
| `DATABASE_URL` | Prod only | PostgreSQL connection string (used when `NODE_ENV=production`) |
| `SMTP_HOST` | No | SMTP server hostname or IP (default `127.0.0.1`) — **use IP, not hostname, to avoid DNS hang** |
| `SMTP_PORT` | No | SMTP port (default 2525 for Mailpit dev) |
| `SMTP_USER` | No | SMTP username (leave blank for Mailpit / FakeSMTP) |
| `SMTP_PASS` | No | SMTP password |
| `SMTP_FROM` | No | From address shown in emails |
| `CLIENT_URL` | **Yes** | React app URL — used for device confirmation links in emails |

---

## Authentication Flow

```
1. Register:   POST /api/auth/register  { email, password }
2. Login:      POST /api/auth/login     { email, password, deviceFingerprint, deviceName }
               → bcrypt verify → OTP email sent
               ← { otpSent: true, userId }

3. Verify OTP: POST /api/auth/verify-otp { userId, code, deviceFingerprint, deviceName }
               → OTP verified → device check:
                  confirmed  → ← { token, expiresAt, user }
                  new device → device confirmation email sent ← { devicePending: true }

4. Confirm device: User clicks link in email
               GET /api/auth/confirm-device?token=<token>  (via /api proxy)
               → device.confirmed = 1 → redirect to /auth/device-confirmed

5. After confirmation: repeat steps 2–3 → receives JWT
```

**JWT payload:** `{ sub: userId, deviceId, jti }`
**Session revocation:** `jti` stored in `sessions` table — middleware checks `revoked = 0` and `device.confirmed = 1` on every request.

---

## Adding a New LLM Provider

1. Create `server/src/services/llm/MyProviderAdapter.ts` implementing `LLMAdapter`:
   ```typescript
   export class MyProviderAdapter implements LLMAdapter {
     readonly provider = 'myprovider' as const;
     async listModels(): Promise<ModelInfo[]> { ... }
     async streamChat(req, onToken, onDone, onError): Promise<void> { ... }
   }
   ```
2. Add `'myprovider'` to `Provider` type in `shared/types.ts`
3. Add a case in `server/src/services/llm/adapterFactory.ts`
4. Add the provider to the `PROVIDERS` array in `client/src/components/settings/ApiKeyManager.tsx`

---

## Database Migrations

```bash
npm run migrate              # Apply all pending migrations
npm run migrate:rollback     # Roll back the last batch

# Create a new migration
cd server && npx knex migrate:make 009_my_change --knexfile src/config/knexfile.ts
```

Migration files live in `server/src/db/migrations/`. Each exports `up` and `down` functions.

---

## Key Design Decisions

### SMTP_HOST must be an IP address in dev
Nodemailer resolves hostnames via `dns.resolve4()` which doesn't read `/etc/hosts`. Using `127.0.0.1` bypasses DNS entirely (nodemailer fast-paths IP addresses).

### API keys encrypted at rest
`encryptionService.ts` uses AES-256-GCM. The key is derived from `ENCRYPTION_SECRET` via `crypto.scryptSync`. Stored format: `iv:tag:ciphertext` (all hex). The plaintext key is never written anywhere.

### SSE streaming
The chat endpoint sets `Content-Type: text/event-stream` and writes `data: {"token":"..."}\n\n` per token. The client reads it via `EventSourceParserStream` (from `eventsource-parser`) over a plain `fetch()` call — not the browser's `EventSource` API, which doesn't support `POST`.

### Device fingerprinting
`@fingerprintjs/fingerprintjs` generates a stable browser fingerprint. It's SHA-256 hashed on the server before storage. A new device triggers an email confirmation — users can't log in from an unconfirmed device even with a valid OTP.

### Theme system
Themes are CSS custom property maps applied to `document.documentElement`. Zero re-renders — the browser handles the cascade. Active theme ID is persisted to `localStorage`.

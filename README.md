# Simple UI — Self-Hosted GenAI Chat Interface

A lightweight, privacy-first chat interface that lets you bring your own LLM API keys and talk to **GPT**, **Claude**, and **Gemini** from a single, unified UI — without your conversations ever leaving your own server.

Built as a learning project and reference implementation for anyone who wants to understand how a production-grade, full-stack AI chat application is architected from scratch.

---

## Why This Project Exists

Most AI chat platforms (ChatGPT, Copilot, Claude.ai) lock you into one provider, store your conversations on their infrastructure, and charge per-seat fees on top of API costs. Simple UI is the self-hosted alternative:

- **Your data stays with you** — conversations are stored in your own database
- **Multi-provider** — switch between OpenAI, Anthropic, and Google models in one click
- **API cost only** — no platform fees, you pay only for the tokens you use
- **Fully open** — read, modify, and learn from every line of code

---

## Features

| Feature | Details |
|---------|---------|
| Real-time streaming | Server-Sent Events (SSE) — tokens appear as they're generated |
| Multi-provider LLM | OpenAI GPT, Anthropic Claude, Google Gemini |
| Conversation history | Persistent sidebar with per-conversation model tracking |
| File upload | PDF, DOCX, XLSX, JPG, PNG — server-side text extraction for document Q&A |
| Auth system | Email + OTP + device fingerprinting + JWT session revocation |
| API key security | AES-256-GCM encryption at rest — keys never stored in plaintext |
| Theming | 5 built-in themes + custom background image upload |
| Code rendering | Syntax-highlighted code blocks with copy button |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19 + Vite + TypeScript |
| State | Zustand |
| Styling | Tailwind CSS + CSS custom properties |
| Backend | Express.js + TypeScript |
| Database | SQLite (dev) / PostgreSQL (prod) via Knex |
| Auth | JWT + bcrypt + OTP (Nodemailer) |
| LLM SDKs | `openai`, `@anthropic-ai/sdk`, `@google/generative-ai` |

---

## Project Structure

```
simple-ui/
├── client/src/
│   ├── api/            # Axios client + JWT interceptor
│   ├── components/     # auth/, chat/, layout/, settings/, shared/
│   ├── hooks/          # useChat — SSE stream consumer
│   ├── stores/         # Zustand: authStore, chatStore, settingsStore
│   └── themes/         # 5 built-in CSS variable theme maps
│
├── server/src/
│   ├── config/         # env vars, Knex database config
│   ├── db/migrations/  # 8 migrations: users → files
│   ├── middleware/      # JWT auth, file upload, rate limiting
│   ├── routes/         # auth, chat, models, settings, files
│   └── services/
│       ├── auth/        # JWT, OTP, device, encryption services
│       ├── llm/         # LLMAdapter interface + 3 provider adapters
│       └── storage/     # File upload + text extraction
│
├── shared/types.ts     # API contract types shared by client and server
├── architecture/       # PlantUML system diagram
└── docs/               # Developer guide, project summary, business context
```

---

## Quick Start

### Prerequisites
- Node.js ≥ 20.14
- [Mailpit](https://mailpit.axllent.org/) for local email (OTP delivery)

### 1. Clone and install
```bash
git clone https://github.com/saurabhshcs/simple-ui.git
cd simple-ui
npm install
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env — fill in JWT_SECRET and ENCRYPTION_SECRET at minimum
```

Generate secrets:
```bash
# JWT_SECRET (64-char hex)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# ENCRYPTION_SECRET (any long random string)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Run database migrations
```bash
npm run migrate
```

### 4. Start local SMTP (for OTP emails)
```bash
mailpit
# View emails at http://127.0.0.1:8025
```

### 5. Start the dev servers
```bash
npm run dev
# Client → http://localhost:5173
# Server → http://localhost:3001
```

### 6. Add your API keys
Register an account, log in, open **Settings → API Keys**, and paste in your key for any provider. The model dropdown populates automatically.

---

## Authentication Flow

```
Register → Login (email + password)
        → OTP sent to email
        → Verify 6-digit code
        → New device? → Confirm via email link
        → JWT issued → chat
```

Every JWT includes a `jti` stored in the `sessions` table. Logout revokes the session server-side — tokens can't be replayed.

---

## Adding a New LLM Provider

1. Create `server/src/services/llm/MyProviderAdapter.ts` implementing `LLMAdapter`
2. Add the provider name to `shared/types.ts`
3. Register it in `server/src/services/llm/adapterFactory.ts`
4. Add it to the provider list in `client/src/components/settings/ApiKeyManager.tsx`

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | Yes | 64-char hex string |
| `ENCRYPTION_SECRET` | Yes | Long random string for AES-256 key derivation |
| `CLIENT_URL` | Yes | React app URL (used in device confirmation emails) |
| `PORT` | No | Server port (default `3001`) |
| `DB_PATH` | No | SQLite file path (default `server/data/simple-ui.sqlite`) |
| `DATABASE_URL` | Prod | PostgreSQL connection string |
| `SMTP_HOST` | No | SMTP host — **use IP address, not hostname** (default `127.0.0.1`) |
| `SMTP_PORT` | No | SMTP port (default `1025`) |
| `SMTP_FROM` | No | From address for auth emails |

> **Note:** `SMTP_HOST` must be an IP address. Nodemailer's DNS resolver doesn't read `/etc/hosts`, so `localhost` will hang. Use `127.0.0.1`.

---

## Deployment

### Production build
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...   # PostgreSQL connection string
npm run build
node server/dist/server.js
```

Serve `client/dist/` via nginx or a CDN, or let Express serve it as static files.

### Docker
The app is Docker-ready: one container for the Node server, one for PostgreSQL. Mount `server/uploads/` as a volume for file persistence.

---

## Documentation

| Document | Description |
|----------|-------------|
| [`docs/developer-guide.md`](docs/developer-guide.md) | Setup, env vars, auth flow, adding providers, key design decisions |
| [`docs/project-summary.md`](docs/project-summary.md) | Feature overview, tech stack, deployment options, roadmap |
| [`docs/business-context.md`](docs/business-context.md) | Market context, target users, competitive positioning |
| [`architecture/architecture.puml`](architecture/architecture.puml) | PlantUML system architecture diagram |

---

## Roadmap

- [ ] Streaming tool/function call support
- [ ] System prompt customisation per conversation
- [ ] Team workspaces with shared conversations
- [ ] Token usage and cost tracking per provider
- [ ] Export conversations as Markdown or PDF
- [ ] Mobile-responsive PWA

---

## License

MIT — free to use, modify, and distribute.

---

## Author

Built by **Saurabhshcs** — follow along for more projects, tutorials, and deep-dives into AI engineering:

Follow me on — [Medium](https://saurabhshcs.medium.com) | [LinkedIn](https://www.linkedin.com/in/saurabhshcs/) | [YouTube](https://www.youtube.com/channel/UCSQqjPw7_tfx1Ie4yYHbcxQ?pbjreload=102) | [StackOverflow](https://stackoverflow.com/users/10719720/saurabhshcs?tab=profile)

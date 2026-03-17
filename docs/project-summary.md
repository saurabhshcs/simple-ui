# Project Summary

## What is Simple UI?

Simple UI is a self-hosted, privacy-first GenAI chat interface that lets individuals and teams bring their own LLM API keys and chat with GPT, Claude, and Gemini from a single, unified interface — without relying on third-party platforms that store conversations on their servers.

---

## Problem It Solves

| Pain Point | How Simple UI Addresses It |
|------------|---------------------------|
| API keys scattered across multiple chat UIs | One interface, multiple providers |
| Conversations stored on third-party servers | Self-hosted, your data stays in your database |
| No way to switch models mid-workflow | Per-conversation model selection with live switching |
| Clunky document analysis (copy-paste into chat) | Native file upload with server-side text extraction |
| Shared API keys in team settings | Per-user encrypted key storage |

---

## Feature Overview

### Core Chat
- Real-time streaming responses via Server-Sent Events
- Persistent conversation history with sidebar navigation
- Automatic conversation titling from first message
- Code blocks with syntax highlighting and copy button
- Markdown rendering (tables, lists, bold, etc.)

### Multi-Provider LLM Support
- **OpenAI** — GPT-4o, GPT-4 Turbo, and all `gpt-*` models
- **Anthropic** — Claude 3 Opus, Sonnet, Haiku
- **Google** — Gemini Pro, Gemini 1.5
- Model list fetched live from each provider's API on login

### File Upload & Document Analysis
- Drag-and-drop or click-to-attach
- Supported: PDF, DOCX, DOC, XLSX, XLS, JPG, PNG (max 5 MB)
- Server-side extraction: images → base64 (vision), documents → plaintext
- Files auto-deleted after 24 hours

### Authentication & Security
- Email + password registration
- Two-factor via OTP email (6-digit code, 10-minute TTL)
- Device fingerprinting — new browsers require email confirmation
- JWT sessions stored in DB for revocation (logout invalidates server-side)
- API keys encrypted at rest with AES-256-GCM

### Theming & Personalisation
- 5 built-in themes: Ocean Dark, Slate Light, Forest, Warm Sand, Sunset Purple
- CSS variable system — instant switching, no re-renders
- Custom background image upload
- Theme preference persisted in `localStorage`

---

## Tech Stack

| Layer | Technology | Rationale |
|-------|-----------|-----------|
| Frontend | React 19 + Vite + TypeScript | Fast iteration, excellent streaming support |
| State | Zustand | Minimal boilerplate, fine-grained subscriptions |
| Styling | Tailwind CSS + CSS variables | Utility-first + zero-JS theming |
| Backend | Express.js + TypeScript | Lightweight, pragmatic, full SSE control |
| Database | SQLite (dev) / PostgreSQL (prod) | Zero-config dev, production-grade swap |
| ORM | Knex | SQL builder with migration system |
| Auth | JWT + bcrypt + OTP | No external auth service needed |
| Email | Nodemailer | Standard Node.js, any SMTP backend |
| LLM | Provider SDKs | openai, @anthropic-ai/sdk, @google/generative-ai |

---

## Deployment Options

### Development
```bash
npm run dev          # Hot reload, SQLite, Mailpit SMTP
```

### Production
1. Set `NODE_ENV=production` and `DATABASE_URL` (PostgreSQL)
2. Build: `npm run build`
3. Run: `node server/dist/server.js`
4. Serve the `client/dist/` folder via nginx/CDN or let Express serve static files
5. Configure real SMTP (Gmail App Password, AWS SES, SendGrid, etc.)

### Docker (self-hosted)
The app is Docker-ready: one container for the Node server, one for PostgreSQL. The `uploads/` folder should be volume-mounted for persistence.

---

## Roadmap Ideas

- [ ] Streaming tool/function call support
- [ ] System prompt customisation per conversation
- [ ] Team workspaces with shared conversations
- [ ] Usage / token cost tracking per provider
- [ ] Export conversations as Markdown or PDF
- [ ] Mobile-responsive PWA with offline support

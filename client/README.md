# Simple UI — Client

React 19 + Vite + TypeScript frontend for the Simple UI GenAI chat interface.

## Overview

The client is a single-page application that communicates with the Simple UI Express server via a proxied `/api` prefix. It handles:

- **Authentication** — email/OTP/device-confirmation login flow
- **Chat** — real-time token streaming via Server-Sent Events (SSE)
- **Settings** — API key management, model/provider selection, theming
- **File upload** — drag-and-drop PDF, DOCX, XLSX, image attachments

## Structure

```
src/
├── api/            # Axios client with JWT Authorization header interceptor
├── components/
│   ├── auth/       # Login, register, OTP, device confirmation screens
│   ├── chat/       # ChatWindow, MessageList, MessageBubble, ChatInput
│   ├── layout/     # AppShell, Sidebar, TopBar, SettingsPanel
│   ├── settings/   # ApiKeyManager, ThemePicker, ModelSelector
│   └── shared/     # Reusable UI primitives
├── hooks/          # useChat — SSE stream consumer + store updates
├── stores/         # Zustand: authStore, chatStore, settingsStore
└── themes/         # 5 built-in CSS variable theme maps
```

## Key Design Decisions

**Theming without re-renders** — `settingsStore` applies themes by calling `document.documentElement.style.setProperty` directly, bypassing React's render cycle entirely.

**Optimistic UI for chat** — User messages are added to the store immediately before the SSE response arrives, so the UI feels instant.

**SSE stream parsing** — `eventsource-parser` converts the raw byte stream from `/api/chat` into structured `{ token }` events that are accumulated into `chatStore.streamingContent`.

## Development

```bash
# From the monorepo root
npm run dev -w client      # Vite dev server on :5173 (proxies /api to :3001)
npm run build -w client    # TypeScript check + Vite production build
npm run test -w client     # Vitest unit tests (happy-dom environment)
```

## Testing

Tests live in `src/__tests__/` and use **Vitest** with **happy-dom**:

- `chatStore.test.ts` — store actions: streaming lifecycle, conversations, pending files
- `settingsStore.test.ts` — theme switching, model selection, background URL persistence

```bash
npm run test -w client          # run once
npm run test:watch -w client    # watch mode
```

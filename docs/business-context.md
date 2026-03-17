# Business Context

## Market Context

The enterprise AI assistant market is dominated by SaaS platforms (ChatGPT Enterprise, Microsoft Copilot, Google Gemini for Workspace) that:
- Lock organisations into a single LLM provider
- Store all conversations and documents on third-party infrastructure
- Charge per-seat subscription fees on top of API usage costs
- Provide limited customisation for branding, workflows, or integrations

Simple UI is positioned as a **self-hosted alternative** for teams and individuals who want direct API access without the overhead of a managed platform.

---

## Target Users

### Primary: Developer / Power User
- Has API keys for one or more LLM providers
- Wants a clean interface without unnecessary features
- Values data privacy — no conversations on OpenAI/Anthropic servers beyond the API call
- Comfortable with a short self-hosted setup

### Secondary: Small Engineering Team (3–15 people)
- Wants shared access without sharing API keys across team members
- Needs per-user key isolation (each person uses their own quota)
- Prefers OSS over paid SaaS for internal tooling

### Tertiary: Enterprise/Compliance Teams
- Requires on-premise deployment for data residency
- Needs audit-friendly session revocation and device tracking
- Documents must not leave the corporate network (file upload → extraction stays on-prem)

---

## Value Proposition

| Dimension | Simple UI | Managed SaaS (ChatGPT, Copilot) |
|-----------|-----------|----------------------------------|
| Data residency | Your server, your DB | Provider's cloud |
| Provider flexibility | OpenAI + Anthropic + Gemini | Typically single vendor |
| Cost model | API cost only | API cost + per-seat fee |
| Customisation | Full (open source) | Limited |
| Setup effort | ~10 minutes | Instant |
| Enterprise SSO | Not yet | Often included |

---

## Business Model Options

Being open source, several monetisation paths are available if desired:

1. **Hosted SaaS tier** — "Simple UI Cloud": zero-setup, users bring their own API keys, pay a small monthly fee for hosting + guaranteed uptime
2. **Enterprise support** — paid support contracts, custom deployments, SLA
3. **Plugin marketplace** — paid connectors (Notion, Confluence, Jira, Slack) that extend the chat with context from existing tools
4. **White-label licensing** — companies embed Simple UI in their internal tools under their own branding

---

## Competitive Positioning

### vs ChatGPT / Claude.ai
- **Simple UI wins**: multi-provider, self-hosted, no data on their servers, lower ongoing cost
- **Loses**: ecosystem integrations, mobile apps, built-in plugins

### vs Open WebUI / LibreChat
- **Similar**: open source, self-hosted, multi-provider
- **Simple UI wins**: lighter footprint, simpler setup, cleaner codebase for customisation
- **Loses**: larger community, more mature feature set

### vs LM Studio / Ollama UIs
- **Different target**: Simple UI is for cloud LLM APIs, not local models
- Could be extended to support Ollama endpoints in the future

---

## Key Risks

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| LLM provider API changes | Medium | Adapter pattern isolates each provider |
| API key theft if server compromised | Low | AES-256-GCM encryption at rest |
| SMTP deliverability in prod | Medium | Support for any SMTP backend (SES, SendGrid) |
| SQLite not suitable for concurrent users | Low (dev only) | Knex config swaps to PostgreSQL in prod |

---

## Success Metrics (if productised)

- **Adoption**: GitHub stars, npm installs, Docker pulls
- **Engagement**: messages sent per active user per day
- **Retention**: % of users returning after 7 days
- **Provider diversity**: % of users with 2+ providers configured

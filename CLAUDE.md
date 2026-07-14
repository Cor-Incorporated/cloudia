# CLAUDE.md

This file provides guidance when working in this repository.

## Project Overview

Cloudia is a React TypeScript AI reception UI for B2B intake and ambassador conversations. It uses an eight-expression PNG avatar and delegates every AI conversation to corsweb's server-side contact-chat Worker. The browser must never contain an AI provider API key, Google service-account credential, or provider-specific model configuration.

## Commands

- `npm ci` - Install the exact lockfile dependencies for CI/release checks
- `npm install` - Install or update dependencies during development
- `npm run dev` - Start the Vite development server
- `npm test` - Run the unit test suite
- `npm run test:intents` - Validate the seven canonical intent keys
- `npm run typecheck` - Run strict TypeScript checking without emitting files
- `npm run build` - Build for production
- `npm run preview` - Preview the production build
- `npx --no-install playwright install chromium && npm run test:e2e` - Install the lockfile Playwright Chromium and run browser E2E locally
- `npm audit --omit=dev` - Audit the shipped production dependency graph

## CI and Release Boundary

`.github/workflows/ci.yml` is the reproducible PR gate. It runs with fixed
Node.js 22.23.1, read-only repository permissions, no secrets, and no deploy
step. It covers unit tests, canonical intents, ADR intent parity, typecheck,
build, production-only audit, and Chromium E2E. CI installs the locked Chromium
and Linux dependencies on every run; only npm downloads are cached.

PRs and fork PRs must never deploy or receive Cloudflare credentials. Preview
deployment is an explicit trusted-operator action to a non-`main` branch with
`noindex`. Production deployment is a separate main-linked action after the
exact `main` commit passes CI and Preview approval. Treat implemented, merged,
deployed, and live-verified as separate states.

## Local Environment

Optional `.env.local` values:

```env
VITE_CONTACT_API_BASE=https://your-contact-worker.example.com
VITE_CONTACT_CHAT_MOCK=1
VITE_FALLBACK_CONTACT_URL=mailto:cloudia@cor-jp.com
GOOGLE_CALENDAR_ICAL_URL=your_google_calendar_ical_url
```

Leave `VITE_CONTACT_API_BASE` empty when Cloudia is mounted on the same origin as corsweb. Do not add Gemini, Vertex, access-token, or service-account secrets to Vite variables; every `VITE_*` value is public browser configuration.

## Architecture

### Conversation Gateway

1. `ChatInput` sends user text to `App`.
2. `App` bounds the conversation with `toApiMessages`.
3. Both `intake` and `ambassador` modes call `POST /api/contact/chat` through `services/contactChatClient.ts`.
4. The request includes validated `mode`, `locale`, `intent`, and fixed `source: cloudia` fields.
5. corsweb's Worker builds the mode-specific system instruction and company context, calls Vertex Gemini, and normalizes the response.
6. Cloudia renders the plain-text `reply` and derives an avatar expression from the normalized workflow result.

Provider failures use a generic localized message and the corsweb fallback form. Do not display upstream response bodies, status details, credentials, or raw model output.

### PII Boundary

- `/api/contact/chat` receives non-confidential conversation content only.
- Name, email, and company are collected in the final handoff step and sent to `/api/contact/submit`.
- Submit PII must not be copied into chat requests, model prompts, console output, or browser diagnostics.
- The Worker owns provider authentication, validation, classification, persistence, and email delivery.

### Modes and Intents

- `intake` is the default, polite B2B contact flow.
- `ambassador` is enabled with `?mode=ambassador` and uses the same server gateway.
- The seven canonical intent keys live in `constants/intents.ts`; unknown values normalize to no selection.
- Cloudia browser handoff eligibility contains `contract-dev`, `grift-team-beta`, `grift-paid-trial`, and `estimate-audit`; corsweb owns normalization to outbound `contract-dev` for Grift.
- Contact embedding uses the same-origin API by default and may set `?intent=` for initial selection.

### Avatar

- Assets: `public/assets/avatar/cloudia-{emotion}.png`
- Emotions: `HAPPY`, `ANGRY`, `SAD`, `ENJOYING`, `SURPRISED`, `SHY`, `THINKING`, `PROUD`
- Missing assets fall back to CSS placeholders so chat remains usable.

### Calendar

The legacy calendar parser supports Google Calendar public iCal data, UTF-8 Japanese content, upcoming-event filtering, and localized formatting. Netlify configuration remains only for this legacy calendar preview endpoint; there is no Netlify AI function.

## Implementation Rules

- Keep AI provider names, model IDs, credentials, prompts, company context, and tools on the server.
- Preserve the response contract `{ reply, classification, readyForContact }` while Worker v2 fields are introduced.
- Send chat replies as plain text and keep history bounded to prevent oversized requests.
- Maintain Japanese and English UI behavior and the existing CSS avatar fallback.
- Run unit tests, the intent and ADR parity checks, typecheck, a production build, browser E2E, production audit, and a bundle secret scan for conversation-client changes.

# CLAUDE.md

This file provides guidance when working in this repository.

## Project Overview

Cloudia is a React TypeScript AI reception UI for B2B intake and ambassador conversations. It uses an eight-expression PNG avatar and delegates every AI conversation to corsweb's server-side contact-chat Worker. The browser must never contain an AI provider API key, Google service-account credential, or provider-specific model configuration.

## Commands

- `npm install` - Install dependencies
- `npm run dev` - Start the Vite development server
- `npm test` - Run contact-chat client tests
- `npm run test:intents` - Validate the seven canonical intent keys
- `npm run build` - Build for production
- `npm run preview` - Preview the production build

## Local Environment

Optional `.env.local` values:

```env
VITE_CONTACT_API_BASE=https://your-contact-worker.example.com
VITE_CONTACT_CHAT_MOCK=1
VITE_FALLBACK_CONTACT_URL=https://cor-jp.com/contact/
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
- Run tests, the intent self-test, a production build, and a bundle secret scan for conversation-client changes.

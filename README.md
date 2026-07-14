# 3D Emotional Chat AI

A React TypeScript contact-reception experience with an eight-expression Cloudia avatar. Conversations run through corsweb's server-side contact gateway; the browser never receives an AI provider credential.

## ✨ Features

### 🎭 3D Character with Emotions
- **VRM Model Integration**: Loads and displays 3D VRM characters (currently featuring Cloudia)
- **Emotional Expressions**: 8 PNG faces (HAPPY, ANGRY, SAD, ENJOYING, SURPRISED, SHY, THINKING, PROUD)
- **Real-time Animation**: Smooth transitions between emotional states during conversations

### 🤖 AI-Powered Conversations
- **Server-side AI**: Both intake and ambassador modes use `/api/contact/chat`
- **Company Knowledge Base**: Company context and system instructions are assembled by the Worker
- **Emotion Detection**: AI automatically determines appropriate emotions for responses

### 📅 Calendar Integration
- **Real-time Sync**: Connects to Google Calendar via iCal URL
- **Event Display**: Shows upcoming events in chat responses
- **Japanese Support**: Full UTF-8 encoding support for Japanese calendar events
- **Smart Filtering**: Displays relevant upcoming events (next 30 days)

### 🌐 Internationalization
- **Multi-language Support**: Japanese and English interface
- **Dynamic Language Switching**: Real-time language toggling
- **Localized Content**: Company information and UI elements support multiple languages

## 🚀 Architecture Highlights

### Modern Tech Stack
- **Frontend**: React 18 with TypeScript and Vite
- **3D Graphics**: Three.js with VRM model support
- **AI Integration**: Vertex Gemini behind the corsweb contact-chat Worker
- **Styling**: Tailwind CSS for responsive design
- **State Management**: React Context for language and app state

### Innovative Design Decisions
- **ES Modules with Import Maps**: Native ES modules loaded from esm.sh CDN instead of bundling
- **Ref-based 3D Updates**: Character expression updates bypass React re-renders for performance
- **Gateway Architecture**: Same-origin contact API with no browser-side AI credentials
- **Character Encoding**: Advanced UTF-8 handling for Japanese calendar integration

## 📋 Prerequisites

- **Node.js 22.23.1** (the exact version used by CI)
- Access to a running corsweb contact-chat Worker
- **Google Calendar** with public iCal URL (optional)

## 🛠 Setup & Installation

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Create a `.env.local` file with the following variables:

```env
VITE_CONTACT_API_BASE=https://your-contact-worker.example.com
VITE_TURNSTILE_SITE_KEY=your-public-turnstile-sitekey
# Preview/Staging build only; exact HTTPS origins, comma-separated, no paths or wildcards.
VITE_GRIFT_PUBLIC_URL_ORIGINS=https://approved-grift-preview.example.run.app
# Preview/Staging provenance only; public identifiers, never credentials.
VITE_CLOUDIA_CANDIDATE_SHA=0123456789abcdef0123456789abcdef01234567
VITE_CLOUDIA_DEPLOYMENT_ID=cloudia-preview-20260714-001
VITE_CLOUDIA_RELEASE_ID=cloudia-grift-uat-20260714-001
GOOGLE_CALENDAR_ICAL_URL=your_google_calendar_ical_url
```

No Gemini or Vertex credential belongs in `.env.local`. Local Cloudia development calls the configured contact-chat Worker, or uses `VITE_CONTACT_CHAT_MOCK=1` for UI-only work.

`VITE_CONTACT_API_BASE` is used only by non-production builds. Production mode
forces it to an empty value so the deployed `/contact/chat/` app always calls
corsweb's same-origin `/api/contact/*` routes, even if a Preview Pages variable
is accidentally inherited by the production build.

`VITE_TURNSTILE_SITE_KEY` is optional. When it is empty, Cloudia does not load
Turnstile and preserves the existing form behavior. A Turnstile sitekey is a
public browser identifier, not a secret. Never put `TURNSTILE_SECRET` (or any
other server credential) in a `VITE_*` variable.

`VITE_GRIFT_PUBLIC_URL_ORIGINS` is an optional, public build-time allowlist for
the temporary Grift Preview/Staging portal. Vite production mode ignores this
variable even when it remains set in the build environment. The production origin
`https://app.griftai.org` is always allowed and is the only allowed origin when
this variable is omitted. Set the variable only on the Cloudia Preview build and
use `npm run build:preview` (Vite `preview` mode) for that artifact. Use the normal
`npm run build` for production. Set the allowlist to
the exact tagged Grift origin returned by the staging release (comma-separated
when more than one exact origin is required). Entries must be HTTPS origins
with no path, query, fragment, credentials, port alias, or wildcard. The
production Cloudia build must leave it unset. Both top-level navigation and the
portal URL sent to the trusted Cor. iframe parent use this same allowlist and
the exact `/chat/portal#exchange_code=<43-character base64url code>` contract.
The code is a no-padding encoding of 32 random bytes and expires no more than
five minutes after receipt. Cloudia validates and forwards the unchanged URL;
it does not read, exchange, persist, or log the fragment credential.

`npm run build:preview` also requires the three public provenance identifiers
shown above. The build fails closed unless `VITE_CLOUDIA_CANDIDATE_SHA` is a
full 40-character lowercase commit SHA and the deployment/release identifiers
match their bounded safe-character contracts. A successful Preview build emits
the exact six-field `/release.json` readback used by the UAT runner:

```json
{"status":"ok","service":"cloudia","repository":"Cor-Incorporated/cloudia","candidate_sha":"0123456789abcdef0123456789abcdef01234567","deployment_id":"cloudia-preview-20260714-001","release_id":"cloudia-grift-uat-20260714-001"}
```

This file contains public deployment provenance only. Never place a token,
secret, tenant ID, email address, URL credential, or customer data in these
variables. Pages serves the file with `Cache-Control: no-store` and
`X-Content-Type-Options: nosniff`. The `/release.json` rule in `public/_headers`
explicitly detaches Pages' default `Access-Control-Allow-Origin` header, so the
deployed response is not readable through browser CORS. Normal production
builds ignore these variables and do not emit `release.json`.

**Calendar Setup (Optional):**
1. Open Google Calendar
2. Go to Settings > Calendar Settings
3. Find "Integrate calendar" section
4. Copy the public iCal URL

### 3. Company Configuration
Company knowledge used by the model is configured server-side in corsweb. The Markdown files in this repository are retained as reference content and are not sent directly from the browser.

### 4. Run Development Server
```bash
npm run dev
```

### 5. Build for Production
```bash
npm run build
```

The production build is mounted at `/contact/chat/`, so its CSS, JavaScript,
favicon, and public assets are emitted with that prefix. Local development
keeps the root (`/`) base path. Building only creates `dist/`; it does not
publish to Cloudflare or any other external service.

### 6. Preview Production Build
```bash
npm run preview
```

## 🏗 Project Structure

```
src/
├── components/          # React components
│   ├── ExpressionAvatar.tsx    # 8-expression icon avatar (image + CSS fallback)
│   ├── ChatInput.tsx           # User input component
│   ├── ChatMessage.tsx         # Message display component
│   └── KnowledgeInput.tsx      # Knowledge base editor
├── services/            # Core services
│   ├── contactChatClient.ts    # Server-side chat gateway client
│   ├── (avatar images under public/assets/avatar/)
│   ├── calendarService.ts      # Calendar integration
│   ├── companyWebSearch.ts     # Web search functionality
│   └── knowledgeLoader.ts      # Company knowledge loader
├── contexts/            # React contexts
│   └── LanguageContext.tsx     # Language management
├── api/                 # Legacy calendar endpoint only
│   └── calendar.ts             # Calendar API proxy
└── company-info/        # Company knowledge base
    └── company.md              # Company information in Markdown
```

## 🎮 Usage

1. **Start Chatting**: Type your questions in the chat input
2. **Watch Emotions**: Observe how the 3D character's expression changes based on responses
3. **Language Toggle**: Switch between Japanese and English using the language selector
4. **Company Queries**: Ask about company information, events, or schedules

## 🔧 Technical Details

### 3D Character System
- **VRM Loading**: Loads `.vrm` files with bone structure validation
- **Expression Mapping**: Maps AI emotions to 3D character expressions
- **Performance Optimization**: Direct bone manipulation without React re-renders

### AI Integration
- **Contact Gateway**: Sends bounded conversation history plus mode, locale, and intent
- **Context Management**: Company knowledge and provider prompts stay on the server
- **Safe Errors**: Provider and infrastructure details are not rendered to users

### Calendar Integration
- **iCal Parsing**: Custom parser for Google Calendar iCal format
- **Encoding Handling**: Advanced UTF-8 support for Japanese content
- **Date Filtering**: Smart filtering for relevant upcoming events

## 🌍 Deployment

The production contact experience is mounted on corsweb and calls the same-origin `/api/contact/*` Worker routes. `netlify.toml` remains only for the legacy calendar preview path; there is no Netlify AI function.

### PR quality gate

`.github/workflows/ci.yml` runs on pull requests to `main`, pushes to `main`,
and manual dispatches. It uses Node.js 22.23.1, `npm ci`, and read-only
repository permissions. The gate runs unit tests, the canonical-intent
self-test, ADR intent parity, TypeScript, the production build, production-only
`npm audit`, and Chromium E2E.

The workflow has no deploy step, environment, external credential, or secret
reference. It uses `pull_request`, not `pull_request_target`, so fork pull
requests do not need or receive deployment secrets. `actions/checkout` also
leaves no credential in the checkout.

To reproduce the gate locally with Node.js 22.23.1:

```bash
npm ci
npm test
npm run test:intents
npm run typecheck
npm run build
npx --no-install playwright install chromium
npm run test:e2e
npm audit --omit=dev
```

CI caches npm's download cache using `package-lock.json`. It intentionally does
not cache Playwright browser binaries: the E2E job installs only its locked
Chromium plus Linux system dependencies with
`npx --no-install playwright install --with-deps chromium`. This avoids stale browser/OS
dependency combinations and follows Playwright's CI cache guidance.

The production audit is the release gate. A full development audit can still
report advisories from legacy Netlify/Vercel build tooling; those packages are
not in the shipped production dependency graph and are reviewed separately.
Do not use `npm audit fix --force` as part of a release because it can make
unrelated major-version changes.

### Turnstile code boundary and production blockers

When `VITE_TURNSTILE_SITE_KEY` is configured, the contact form uses Cloudflare's
official explicit-render API from the exact
`https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit` URL. The
submit button remains disabled until the callback supplies a valid token. The
browser sends that ephemeral value only as `turnstileToken` to
`POST /api/contact/submit`; it is not written to local/session storage, logs,
URLs, email content, or the Grift handoff. The submit Worker must validate it
server-side and discard it before any persistence, notification, or Grift
payload is assembled.

Cloudflare Pages/origin CSP must merge these sources into the existing policy
before the sitekey is enabled:

```text
script-src ... https://challenges.cloudflare.com
frame-src ... https://challenges.cloudflare.com
connect-src ... 'self' <VITE_CONTACT_API_BASE origin, only when cross-origin>
```

For this standard no-pre-clearance widget, Cloudflare's Turnstile CSP contract
adds `script-src` and `frame-src`; it does not require adding the Turnstile
origin to the top page's `connect-src`. Keep `'self'` for Cloudia's same-origin
contact API. If pre-clearance is enabled later, Cloudflare also requires
`connect-src 'self'` for the site's `/cdn-cgi/` request. On Pages, apply the
merged header through the deployed `_headers`/response-header configuration;
do not replace unrelated existing CSP sources with the abbreviated example.

Production is **not ready** from this frontend change alone. A trusted operator
still has to create and hostname-restrict the external widget, add the public
sitekey to the Pages build, configure the private `TURNSTILE_SECRET` only in the
submit Worker, enforce Siteverify on every submit (including expected hostname
and action `contact-submit`), deploy the CSP, finish the planned WAF/rate
controls, and live-verify the result. Turnstile tokens are single-use and expire
after five minutes, so every failed/completed submit must use a fresh token.

Contract references: [explicit rendering and lifecycle](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/),
[widget configuration](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/),
[server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/),
and [Turnstile CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/).

### Preview boundary and confirmation

PR CI never creates a Preview. After both CI jobs pass, a trusted operator may
build a noindex Preview and deploy it to a non-`main` Pages branch from an
authenticated environment:

```bash
VITE_ROBOTS=noindex,nofollow \
VITE_CLOUDIA_CANDIDATE_SHA="<exact-40-character-lowercase-commit>" \
VITE_CLOUDIA_DEPLOYMENT_ID="<public-pages-deployment-id>" \
VITE_CLOUDIA_RELEASE_ID="<public-uat-release-id>" \
npm run build:preview
npx wrangler pages deploy dist --project-name cloudia-contact --branch "<preview-branch>"
```

Record the Preview URL and source commit, then confirm `/contact/chat/` loads,
assets return 200, `/release.json` has the exact expected public identifiers and
`no-store`/`nosniff` without CORS, the page is `noindex`, there are no browser console errors,
and the four eligible intents complete the mocked/test-safe handoff paths. Do
not enter real customer PII during Preview verification.

After the Preview deployment, verify the effective response with a real `GET`
(not only the build artifact). This gate must fail if CORS is present or either
security/cache header is missing:

```bash
preview_url="https://<exact-cloudia-preview-host>"
tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
curl -fsS -D "$tmp_dir/headers" -o "$tmp_dir/release.json" "$preview_url/release.json"
! grep -Eiq '^access-control-allow-origin:' "$tmp_dir/headers"
grep -Eiq '^cache-control:[[:space:]]*no-store[[:space:]]*$' "$tmp_dir/headers"
grep -Eiq '^x-content-type-options:[[:space:]]*nosniff[[:space:]]*$' "$tmp_dir/headers"
```

### Production boundary and confirmation

Production is a separate, trusted main-linked release action. Only a clean,
reviewed `main` commit whose push CI is green may be deployed to the Pages
production branch. The authenticated release system or operator, outside this
PR workflow, builds that exact commit and performs:

```bash
npx wrangler pages deploy dist --project-name cloudia-contact --branch main
```

After deployment, record the Cloudflare deployment ID and commit, then verify
the public `/contact/chat/` route and prefixed assets, same-origin
`/api/contact/chat` and `/api/contact/submit`, one Japanese and one English
flow, all four Cloudia handoff-eligible intents, and the Worker-to-Grift
outbound `contract-dev` boundary. A green PR or green `main` CI run is not
evidence that Preview or production was deployed or live-verified.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

© 2025 Cor.inc. All rights reserved.

## 🆘 Support

For issues or questions:
- Create an issue in the repository
- Contact: [Cor.inc Support](https://cor-jp.com/contact)
- Email: Contact via company website

---

*Last updated: June 2025*

## 🔗 Language Links

- [日本語版README](README_ja.md)
- [Company Website](https://cor-jp.com)

## Phase 1 Contact (corsweb)

- **intents** (ADR-0014, 7 keys): see `constants/intents.ts` including `contract-dev`
- **API**: `services/contactChatClient.ts` → `POST /api/contact/chat` and `/submit`
- Env:
  - `VITE_CONTACT_API_BASE` — e.g. empty for same-origin, or Preview Worker origin
  - `VITE_CONTACT_CHAT_MOCK=1` — mock chat/submit for local UI QA
  - `VITE_FALLBACK_CONTACT_URL` — optional non-Cloudia fallback; default `mailto:cloudia@cor-jp.com` (`/contact` and `/contact/chat` are rejected to prevent loops)
  - `VITE_TURNSTILE_SITE_KEY` — optional public sitekey; when unset, no widget/script is rendered
- **Embed**: open with `?embed=1` for compact header (iframe /corsweb #254)
- **LINE UI**: left Cloudia avatar + bubble, right user bubble; plain-text replies

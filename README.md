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

- **Node.js** (v18 or higher)
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
GOOGLE_CALENDAR_ICAL_URL=your_google_calendar_ical_url
```

No Gemini or Vertex credential belongs in `.env.local`. Local Cloudia development calls the configured contact-chat Worker, or uses `VITE_CONTACT_CHAT_MOCK=1` for UI-only work.

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
keeps the root (`/`) base path. Deploy the production artifact to the Pages
`main` branch so the `cor-jp.com` edge route receives it:

```bash
npx wrangler pages deploy dist --project-name cloudia-contact --branch main
```

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
  - `VITE_FALLBACK_CONTACT_URL` — default `https://cor-jp.com/contact/`
- **Embed**: open with `?embed=1` for compact header (iframe /corsweb #254)
- **LINE UI**: left Cloudia avatar + bubble, right user bubble; plain-text replies

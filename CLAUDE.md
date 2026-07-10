# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a React TypeScript application that creates an emotional chat AI using Google's Gemini API. The app features an 8-expression icon avatar (image slots under `public/assets/avatar/`, CSS placeholder fallback) for B2B intake / Contact form substitute use, with company-specific answers, calendar integration, and web search capabilities.

## Commands

### Development
- `npm install` - Install dependencies
- `npm run dev` - Start development server (runs Vite)
- `npm run build` - Build for production
- `npm run preview` - Preview production build

### Environment Setup
Create a `.env.local` file with:
```
GEMINI_API_KEY=your_actual_gemini_api_key
GOOGLE_CALENDAR_ICAL_URL=your_google_calendar_ical_url
```

### Company Configuration
1. **Company Information**: Edit `/company-info/company.md` with your company details in Markdown format
2. **Calendar Integration**: Set the `GOOGLE_CALENDAR_ICAL_URL` environment variable to your Google Calendar's public iCal URL

## Architecture

### Key Design Decisions

1. **ES Modules with Import Maps**: The app uses native ES modules loaded from esm.sh CDN instead of bundling dependencies. This is configured in `index.html`.

2. **Expression Avatar System** (no WebGL / VRM):
   - **8 emotions**: HAPPY, ANGRY, SAD, ENJOYING, SURPRISED, SHY, THINKING, PROUD（喜び/怒り/悲しみ/楽しみ/驚き/照れ/考え中/ドヤ顔）
   - **Assets**: `public/assets/avatar/cloudia-{emotion}.png` with CSS placeholder on load failure
   - **Component**: `ExpressionAvatar` only — chat remains usable without images
   - **Modes**: `intake` (default, polite B2B) vs `ambassador` (`?mode=ambassador`, casual)

3. **State Management**: 
   - Language state is managed via React Context (`LanguageContext`)
   - Chat state, intent, and knowledge base are managed in the main `App.tsx` component
   - Emotion states are derived from AI responses and passed to `ExpressionAvatar`
   - Contact intent keys match corsweb ADR-0010 (`?intent=`)

4. **AI Integration with Enhanced Capabilities**:
   - `geminiService.ts` handles all Gemini API interactions with streaming responses
   - System prompt includes company knowledge base and calendar data
   - **Web Search Integration**: Automatic web search triggered by specific keywords
   - **Washington Proxy**: Uses Washington-based proxy for global web search access
   - Emotion detection and parsing from AI responses

5. **Calendar Integration**:
   - **Real-time Sync**: Connects to Google Calendar via public iCal URL
   - **Advanced Parsing**: Custom iCal parser with UTF-8 encoding support for Japanese
   - **Smart Filtering**: Displays upcoming events (next 30 days) with intelligent date handling
   - **Encoding Handling**: Advanced character encoding detection and correction

6. **Proxy Architecture**:
   - **Netlify Functions**: Server-side proxies for API calls (`/api/gemini`, `/api/calendar`)
   - **CORS Handling**: Seamless integration with external APIs
   - **Global Accessibility**: Washington proxy ensures international accessibility

### Component Communication Flow
1. User input → `ChatInput` → `App` state
2. `App` → `geminiService` → Gemini API (via `/api/gemini` proxy)
3. Response processing → Parse emotion + content → Update chat messages
4. Emotion extraction → `ExpressionAvatar` → expression image / placeholder update
5. Calendar sync → `calendarService` → Parse iCal → Include in AI context
6. Web search triggers → `companyWebSearch` → Washington proxy → Search results

### Expression Avatar Details

**Assets**:
- Path convention: `/assets/avatar/cloudia-{emotion}.png`
- Missing images fall back to colored CSS placeholders
- See `public/assets/avatar/README.md` and `constants/avatarAssets.ts`

**Emotion tags in model replies**:
`[EMOTION:HAPPY|ANGRY|SAD|ENJOYING|SURPRISED|SHY|THINKING|PROUD]`

### Calendar System Architecture

**iCal Parsing**:
- Custom parser handles both YYYYMMDD and YYYYMMDDTHHMMSSZ formats
- Supports 15 and 16 character UTC date strings
- Automatic encoding detection for Japanese characters
- Robust error handling for invalid dates

**Event Processing**:
- Filters events to next 30 days
- Sorts by date for chronological display
- Limits to 10 most relevant events
- Formats for AI consumption with localized dates/times

**Encoding Handling**:
- UTF-8 decoder with fallback mechanisms
- Automatic detection of double-encoding issues
- Special handling for Japanese character sets

### TypeScript Configuration
- Strict mode enabled
- Path alias `@/*` maps to project root
- Target ES2020 with ESNext modules
- VRM type definitions included

## Important Implementation Details

### Environment & API Configuration
- The Gemini API key and calendar URL are loaded through Vite's define plugin
- All API calls are proxied through Netlify Functions for security and CORS handling
- Washington-based proxy server enables global web search access

### Internationalization
- All UI text supports i18n through the `translations.ts` file
- Company knowledge supports both Japanese and English content
- Calendar events display with proper locale formatting

### Data Management
- Company knowledge is loaded from `/company-info/company.md` at startup
- Calendar data is fetched and cached during app initialization
- Knowledge is included in AI system prompt for context-aware responses
- Chat history is not persisted between sessions (intentional design choice)

### Avatar Assets
- Expression images under `/public/assets/avatar/`
- Official art can be dropped in later using the path convention above

### Search Integration
- Web search automatically triggered by keywords like "latest", "recent", "current"
- Search results are integrated into AI responses seamlessly
- Proxy ensures consistent access regardless of geographic location

### Production Considerations
- Development mode uses mock calendar data to avoid CORS issues
- Production mode uses real calendar API through Netlify Functions
- All console logging is removed in production builds
- Optimized for Netlify deployment with edge distribution

## Development Notes

### Testing Calendar Integration
- Use the mock data in development mode
- Test with real iCal URLs in production environment
- Verify Japanese character encoding works correctly

### Avatar Development
- Toggle emotions via AI tags or by setting `currentEmotion` in `App`
- Replace art by updating PNG files under `public/assets/avatar/`

### API Proxy Development
- Netlify Functions in `/api/` folder handle server-side operations
- Test proxies locally with `netlify dev` command
- Ensure environment variables are properly configured

### Performance Monitoring
- Optimize calendar parsing for large calendars if needed
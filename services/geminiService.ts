import { GoogleGenAI, GenerateContentResponse, GenerateContentParameters, Tool } from "@google/genai";
import { AppMode, CompanyKnowledge, ContactIntent, Emotion, Source, GroundingMetadata, GroundingChunk } from '../types';
import { GEMINI_MODEL_NAME, EMOTION_MAP, getSystemInstruction } from '../constants';
import { searchCompanyURLs, formatCompanySearchResults } from './companyWebSearch';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY for Gemini is not set in environment variables. Please ensure process.env.API_KEY is available.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const parseEmotionFromText = (text: string): { cleanedText: string, emotion: Emotion } => {
  const emotionRegex = /\[EMOTION:(\w+)\]/i;
  const match = text.match(emotionRegex);
  let emotion = Emotion.ENJOYING;
  let cleanedText = text;

  if (match && match[1]) {
    const emotionStr = match[1].toUpperCase() as keyof typeof Emotion;
    if (EMOTION_MAP[emotionStr] !== undefined) {
      emotion = EMOTION_MAP[emotionStr];
    }
    cleanedText = text.replace(emotionRegex, '').trim();
  }
  return { cleanedText, emotion };
};

const extractSources = (groundingMetadata?: GroundingMetadata): Source[] => {
  if (!groundingMetadata || !groundingMetadata.groundingChunks) {
    return [];
  }
  return groundingMetadata.groundingChunks
    .map((chunk: GroundingChunk) => chunk.web)
    .filter((source): source is Source => source !== undefined && source.uri !== undefined)
    .map(source => ({
      uri: source.uri,
      title: source.title || new URL(source.uri).hostname, // Fallback title
    }));
};


// Use proxy API in production for better Google Search support
// const USE_PROXY_API = process.env.NODE_ENV === 'production';

export const askGemini = async (
  prompt: string,
  knowledge: CompanyKnowledge,
  currentLocale: string,
  mode: AppMode = 'intake',
  intent: ContactIntent | null = null,
): Promise<{ text: string; emotion: Emotion; sources?: Source[] }> => {
  const systemInstructionText = getSystemInstruction(currentLocale, mode, intent);
  
  // Search company URLs first if available
  let companySearchResults = '';
  if (knowledge.companyUrls && knowledge.companyUrls.length > 0) {
    try {
      const searchResults = await searchCompanyURLs(knowledge.companyUrls, prompt);
      if (searchResults.length > 0) {
        companySearchResults = formatCompanySearchResults(searchResults, currentLocale);
      }
    } catch (error) {
      console.warn('Company URL search failed:', error);
    }
  }
  
  const fullSystemInstruction = `
${systemInstructionText}

Company Information (Markdown):
---
${knowledge.markdownContent}
---
Calendar Details:
---
${knowledge.calendarInfo}
---
${companySearchResults ? `
Company-Related Web Content:
---
${companySearchResults}
---
` : ''}
`;

  // Google Search is now available in US and Europe (as of Dec 2024)
  // Enable Google Search grounding
  const tools: Tool[] = [{ googleSearch: {} }];

  const request: GenerateContentParameters = {
    model: GEMINI_MODEL_NAME,
    contents: [
      { role: "user", parts: [{ text: prompt }] }
    ],
    config: {
      systemInstruction: fullSystemInstruction,
      tools: tools, // Always provide the tool, LLM decides usage based on system instruction
    }
  };
  
  try {
    const response: GenerateContentResponse = await ai.models.generateContent(request);
    
    const rawText = response.text || '';
    const { cleanedText, emotion } = parseEmotionFromText(rawText);
    
    let sources: Source[] = [];
    if (response.candidates && response.candidates[0] && response.candidates[0].groundingMetadata) {
        sources = extractSources(response.candidates[0].groundingMetadata as GroundingMetadata);
    }

    return { text: cleanedText, emotion, sources };

  } catch (error) {
    console.error('Gemini API call failed:', error);
    // Try to get more specific error message if available
    const message = (error instanceof Error && error.message) ? error.message : "An unknown error occurred with the AI service.";
    // Note: This error message itself is not translated here, but caught in App.tsx where it can be.
    return { text: `Error communicating with AI: ${message}`, emotion: Emotion.SAD, sources: [] };
  }
};

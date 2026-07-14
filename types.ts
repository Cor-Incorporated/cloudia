
export interface Message {
  id: string;
  text: string;
  sender: 'user' | 'ai';
  emotion?: Emotion;
  sources?: Source[];
}

/**
 * 8 表情（提供アセットに一致）:
 * 喜び / 怒り / 悲しみ / 楽しみ / 驚き / 照れ / 考え中 / ドヤ顔
 */
export enum Emotion {
  HAPPY = 'HAPPY',
  ANGRY = 'ANGRY',
  SAD = 'SAD',
  ENJOYING = 'ENJOYING',
  SURPRISED = 'SURPRISED',
  SHY = 'SHY',
  THINKING = 'THINKING',
  PROUD = 'PROUD',
}

/** intake = Contact 本線（敬語）。ambassador = SNS/デモ（方言可） */
export type AppMode = 'intake' | 'ambassador';

/** Browser-only state for the optional Turnstile challenge. Tokens are never persisted. */
export type TurnstileStatus = 'loading' | 'ready' | 'verified' | 'expired' | 'error' | 'timeout';

/**
 * corsweb ADR-0014 正本 intent 7 キー。Grift handoff eligibility は
 * constants/intents.ts に集約し、元の intent は Worker まで保持する。
 */
export type ContactIntent =
  | 'confidential-ai-assessment'
  | 'local-llm-poc'
  | 'grift-team-beta'
  | 'grift-paid-trial'
  | 'estimate-audit'
  | 'contract-dev'
  | 'press-speaking-other';

export interface CompanyKnowledge {
  markdownContent: string;
  calendarInfo: string;
  companyUrls?: CompanyURL[];
}

export interface CompanyURL {
  url: string;
  title: string;
  category: 'social' | 'profile' | 'website' | 'contact' | 'product' | 'other';
  keywords: string[];
}

export interface Source {
  uri: string;
  title: string;
  [key: string]: any;
}

export interface GroundingChunk {
  web?: Source;
  [key: string]: any;
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  [key: string]: any;
}

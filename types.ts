
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

/** corsweb ADR-0010 正本 intent キー */
export type ContactIntent =
  | 'confidential-ai-assessment'
  | 'local-llm-poc'
  | 'grift-team-beta'
  | 'grift-paid-trial'
  | 'estimate-audit'
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
  [key: string]: any; // Allow other properties from API
}

export interface GroundingChunk {
  web?: Source;
  [key: string]: any; // Allow other grounding types
}

export interface GroundingMetadata {
  groundingChunks?: GroundingChunk[];
  [key: string]: any; // Allow other metadata properties
}

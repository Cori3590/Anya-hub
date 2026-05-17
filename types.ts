
export type Archetype = 'custom';
export type ModelProvider = 'gemini' | 'openrouter';

export interface WaifuProfile {
  name: string;
  archetype: Archetype;
  description: string;
  appearance: string;
  avatarUrl?: string;
  provider?: ModelProvider;
  model?: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export interface Message {
  id: string;
  role: 'user' | 'waifu';
  content: string;
  timestamp: number;
  isAudio?: boolean;
  attachments?: Attachment[];
  channel?: 'RADIO' | 'GAME'; // New field for context separation
}

export interface ChronicleEntry {
  id: string;
  content: string;
  timestamp: number;
}
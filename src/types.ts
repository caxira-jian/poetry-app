export type LearnIntent = "known" | "learning" | "wishlist";
export type ReciteStatus = "completed" | "proficient";
export type CurrentStatus = "none" | "completed" | "proficient";
export type ProviderName = "qwen" | "deepseek" | "glm";

export interface Poem {
  id: string;
  title: string;
  author: string;
  content: string;
  dynasty?: string;
  tags: string[];
  learnIntent: LearnIntent;
  currentStatus: CurrentStatus;
  masteryLevel: number;
  lastRecitedAt?: string;
}

export interface ReciteLog {
  id: string;
  poemId: string;
  titleSnapshot: string;
  authorSnapshot: string;
  recitedAt: string;
  status: ReciteStatus;
  note?: string;
}

export interface ProviderConfig {
  provider: ProviderName;
  baseUrl: string;
  model: string;
  encryptedApiKey?: string;
  encryptedApiKeyIv?: string;
  enabled: boolean;
  temperature: number;
  keyAlias?: string;
}

export interface RecommendationItem {
  poemId: string;
  reason: string;
}

export interface RecommendationResult {
  review: RecommendationItem[];
  newLearning: RecommendationItem[];
  source: "llm" | "fallback-list";
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  poems: Poem[];
  reciteLogs: ReciteLog[];
  providerConfigs: ProviderConfig[];
}

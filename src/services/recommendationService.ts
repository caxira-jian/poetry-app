import { buildTodayRecommendation } from "../domain/recommendation";
import type { Poem, ProviderConfig, ReciteLog, RecommendationResult } from "../types";

export async function getRecommendationsFromLlm(params: {
  poems: Poem[];
  logs: ReciteLog[];
  config: ProviderConfig;
  apiKey: string;
}): Promise<RecommendationResult> {
  void params.logs;
  void params.config;
  void params.apiKey;
  return buildTodayRecommendation(params.poems);
}

export async function getRecommendationsFromDefaultApi(params: {
  poems: Poem[];
  logs: ReciteLog[];
}): Promise<RecommendationResult> {
  void params.logs;
  return buildTodayRecommendation(params.poems);
}

export function getFallbackRecommendation(poems: Poem[]): RecommendationResult {
  return buildTodayRecommendation(poems);
}

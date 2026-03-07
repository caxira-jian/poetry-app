import { buildFallbackRecommendation } from "../domain/recommendation";
import type { Poem, ProviderConfig, ReciteLog, RecommendationResult } from "../types";
import { callProviderChat } from "./llmProviders";

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function parseRecommendation(text: string): RecommendationResult {
  const json = JSON.parse(stripCodeFence(text)) as RecommendationResult;
  if (!Array.isArray(json.review) || !Array.isArray(json.newLearning)) {
    throw new Error("Invalid recommendation format");
  }
  return {
    review: json.review,
    newLearning: json.newLearning,
    source: "llm"
  };
}

function buildPrompt(poems: Poem[], logs: ReciteLog[]): string {
  const payload = {
    poems,
    recentLogs: logs.slice(0, 40)
  };

  return [
    "你是古诗背诵教练。",
    "请根据用户诗库和近期背诵记录，输出 JSON，字段严格为 {review, newLearning}。",
    "review 和 newLearning 都是数组，每项是 {poemId, reason}。",
    "review 用于推荐复习，newLearning 用于推荐新学。",
    "不要输出 markdown，不要输出多余字段。",
    JSON.stringify(payload)
  ].join("\n");
}

export async function getRecommendationsFromLlm(params: {
  poems: Poem[];
  logs: ReciteLog[];
  config: ProviderConfig;
  apiKey: string;
}): Promise<RecommendationResult> {
  const { poems, logs, config, apiKey } = params;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await callProviderChat(
      config,
      apiKey,
      [
        {
          role: "system",
          content: "你是严谨的学习助手。输出纯 JSON。"
        },
        {
          role: "user",
          content: buildPrompt(poems, logs)
        }
      ],
      controller.signal
    );

    return parseRecommendation(response.content);
  } finally {
    clearTimeout(timeout);
  }
}

export function getFallbackRecommendation(poems: Poem[]): RecommendationResult {
  return buildFallbackRecommendation(poems);
}

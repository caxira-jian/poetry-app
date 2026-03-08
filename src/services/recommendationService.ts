import { buildRecommendationUserPrompt, LLM_PROMPTS } from "../../shared/llmPrompts";
import { callProviderChat } from "./llmProviders";
import { callDefaultProxyChat } from "./defaultApiProxy";
import { buildFallbackRecommendation } from "../domain/recommendation";
import type { Poem, ProviderConfig, ReciteLog, RecommendationResult } from "../types";

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
          content: LLM_PROMPTS.recommendationSystem
        },
        {
          role: "user",
          content: buildRecommendationUserPrompt(poems, logs)
        }
      ],
      controller.signal
    );

    return parseRecommendation(response.content);
  } finally {
    clearTimeout(timeout);
  }
}

export async function getRecommendationsFromDefaultApi(params: {
  poems: Poem[];
  logs: ReciteLog[];
}): Promise<RecommendationResult> {
  const content = await callDefaultProxyChat({
    messages: [
      { role: "system", content: LLM_PROMPTS.recommendationSystem },
      { role: "user", content: buildRecommendationUserPrompt(params.poems, params.logs) }
    ],
    temperature: 0.3
  });

  return parseRecommendation(content.content);
}

export function getFallbackRecommendation(poems: Poem[]): RecommendationResult {
  return buildFallbackRecommendation(poems);
}

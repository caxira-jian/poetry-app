/**
 * Centralized prompt definitions for all LLM interactions.
 * Keep every system/user prompt here so product tuning only changes one file.
 */

import type { Poem, ReciteLog } from "../src/types";

export const RECENT_LOG_LIMIT = 40;

export const LLM_PROMPTS = {
  /**
   * Scenario: Provider connectivity test on model config page and default API proxy test.
   * Goal: Send a minimal request to verify API is reachable.
   */
  connectivityPingUser: "ping",

  /**
   * Scenario: Natural-language input parsing for poem library/recite pages.
   * Goal: Force strict executable JSON actions.
   */
  nluSystem: "你只输出合法 JSON，且动作必须可执行。",

  /**
   * Scenario: Daily recommendation generation.
   * Goal: Force strict JSON with review/newLearning arrays.
   */
  recommendationSystem: "你是严谨的学习助手。输出纯 JSON。"
} as const;

/**
 * Scenario: NLU user prompt template.
 * Input: raw user text + full poem library snapshot for de-duplication.
 */
export function buildNluUserPrompt(params: {
  text: string;
  poems: Array<{
    id: string;
    title: string;
    author: string;
    content: string;
    dynasty?: string;
    tags: string[];
    learnIntent: "known" | "learning" | "wishlist";
    currentStatus: "none" | "completed" | "proficient";
    masteryLevel: number;
    lastRecitedAt?: string;
  }>;
}): string {
  return [
    "你是古诗学习应用的结构化输入与去重审查器。",
    "必须先完整审查已存在诗库，再输出动作，避免重复录入。",
    "同一标题+作者优先识别为已有条目，应给出修改或意向更新，而不是重复新增。",
    "如用户明确要求删除或去重，可输出 delete_poem。",
    "仅输出 JSON，不要 markdown。",
    "输出结构：{summary:string, actions:Action[]}。",
    "Action 仅可为：",
    "1) {type:'upsert_poem', poem:{title, author, content?, dynasty?, tags?, learnIntent?}}",
    "2) {type:'delete_poem', target:{title, author?}, reason?:string}",
    "3) {type:'set_intent', target:{title, author?}, learnIntent:'known'|'learning'|'wishlist'}",
    "4) {type:'record_recite', target:{title, author?}, status:'completed'|'proficient', recitedAt?:ISO8601, note?:string}",
    "若用户语义不足以产生动作，则 actions 为空数组并在 summary 解释。",
    "当前时间(ISO): " + new Date().toISOString(),
    "完整诗库(必须逐条审查后再决策):",
    JSON.stringify(params.poems),
    "用户输入:",
    params.text
  ].join("\n");
}

/**
 * Scenario: Recommendation user prompt template.
 * Input: poem snapshot + recent recite logs.
 */
export function buildRecommendationUserPrompt(poems: Poem[], logs: ReciteLog[]): string {
  const payload = {
    poems,
    recentLogs: logs.slice(0, RECENT_LOG_LIMIT)
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

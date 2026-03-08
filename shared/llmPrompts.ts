/**
 * 统一管理所有大模型提示词。
 * 以后调优提示词时，只需要改这个文件。
 */

import type { Poem, ReciteLog } from "../src/types";

export const RECENT_LOG_LIMIT = 40;

export const LLM_PROMPTS = {
  /**
   * 场景：模型配置页测试连接、默认 API 代理测试连接。
   * 目标：发送最小请求，验证 API 通路是否可用。
   */
  connectivityPingUser: "ping",

  /**
   * 场景：诗库页/背诵页的口语输入解析。
   * 目标：强制返回可执行的严格 JSON 动作。
   */
  nluSystem: "你只输出合法 JSON，且动作必须可执行。",

  /**
   * 场景：首页今日推荐生成。
   * 目标：强制返回 review/newLearning 结构的严格 JSON。
   */
  recommendationSystem: "你是严谨的学习助手。输出纯 JSON。"
} as const;

/**
 * 场景：口语解析（NLU）用户提示词模板。
 * 输入：用户原始文本 + 全量诗库快照（用于去重判断）。
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
 * 场景：今日推荐用户提示词模板。
 * 输入：诗库快照 + 最近背诵记录。
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

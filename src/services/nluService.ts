import { callProviderChat } from "./llmProviders";
import { callDefaultProxyChat } from "./defaultApiProxy";
import type { LearnIntent, ProviderConfig, ReciteStatus } from "../types";

interface ContextPoem {
  id: string;
  title: string;
  author: string;
  content: string;
  dynasty?: string;
  tags: string[];
  learnIntent: LearnIntent;
  currentStatus: "none" | "completed" | "proficient";
  masteryLevel: number;
  lastRecitedAt?: string;
}

interface UpsertPoemAction {
  type: "upsert_poem";
  poem: {
    title: string;
    author: string;
    content?: string;
    dynasty?: string;
    tags?: string[];
    learnIntent?: LearnIntent;
  };
}

interface DeletePoemAction {
  type: "delete_poem";
  target: {
    title: string;
    author?: string;
  };
  reason?: string;
}

interface SetIntentAction {
  type: "set_intent";
  target: {
    title: string;
    author?: string;
  };
  learnIntent: LearnIntent;
}

interface RecordReciteAction {
  type: "record_recite";
  target: {
    title: string;
    author?: string;
  };
  status: ReciteStatus;
  recitedAt?: string;
  note?: string;
}

export type NluAction = UpsertPoemAction | DeletePoemAction | SetIntentAction | RecordReciteAction;

export interface NluParseResult {
  summary: string;
  actions: NluAction[];
}

function stripCodeFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

function buildPrompt(text: string, poems: ContextPoem[]): string {
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
    JSON.stringify(poems),
    "用户输入:",
    text
  ].join("\n");
}

function parseNluText(content: string): NluParseResult {
  const parsed = JSON.parse(stripCodeFence(content)) as Partial<NluParseResult>;
  if (!Array.isArray(parsed.actions)) {
    throw new Error("LLM 返回的 actions 非数组");
  }

  return {
    summary: parsed.summary || "已完成口语解析与诗库审查",
    actions: parsed.actions as NluAction[]
  };
}

export async function parseNaturalInputFromLlm(params: {
  text: string;
  poems: ContextPoem[];
  config: ProviderConfig;
  apiKey: string;
}): Promise<NluParseResult> {
  const { text, poems, config, apiKey } = params;
  const prompt = buildPrompt(text, poems);

  const response = await callProviderChat(
    config,
    apiKey,
    [
      { role: "system", content: "你只输出合法 JSON，且动作必须可执行。" },
      { role: "user", content: prompt }
    ]
  );

  return parseNluText(response.content);
}

export async function parseNaturalInputFromDefaultApi(params: {
  text: string;
  poems: ContextPoem[];
}): Promise<NluParseResult> {
  const prompt = buildPrompt(params.text, params.poems);
  const response = await callDefaultProxyChat({
    messages: [
      { role: "system", content: "你只输出合法 JSON，且动作必须可执行。" },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  });

  return parseNluText(response.content);
}

import { buildNluUserPrompt, LLM_PROMPTS } from "../../shared/llmPrompts";
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
  const prompt = buildNluUserPrompt({ text, poems });

  const response = await callProviderChat(
    config,
    apiKey,
    [
      { role: "system", content: LLM_PROMPTS.nluSystem },
      { role: "user", content: prompt }
    ]
  );

  return parseNluText(response.content);
}

export async function parseNaturalInputFromDefaultApi(params: {
  text: string;
  poems: ContextPoem[];
}): Promise<NluParseResult> {
  const prompt = buildNluUserPrompt({ text: params.text, poems: params.poems });
  const response = await callDefaultProxyChat({
    messages: [
      { role: "system", content: LLM_PROMPTS.nluSystem },
      { role: "user", content: prompt }
    ],
    temperature: 0.2
  });

  return parseNluText(response.content);
}

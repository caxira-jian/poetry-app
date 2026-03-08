import type { ProviderConfig, ProviderName } from "../types";

export interface ChatMessage {
  role: "system" | "user";
  content: string;
}

interface ChatResponse {
  content: string;
}

export interface ProviderPingResult {
  ok: boolean;
  status: number;
  body: string;
}

function buildChatCompletionsUrl(config: ProviderConfig): string {
  const base = config.baseUrl.replace(/\/$/, "");
  return `${base}/chat/completions`;
}

function parseAssistantText(payload: unknown): string {
  const anyPayload = payload as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return anyPayload.choices?.[0]?.message?.content ?? "";
}

export async function callProviderChat(
  config: ProviderConfig,
  apiKey: string,
  messages: ChatMessage[],
  signal?: AbortSignal
): Promise<ChatResponse> {
  const response = await fetch(buildChatCompletionsUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: config.temperature,
      messages
    }),
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`${config.provider} API failed: ${response.status} ${text}`);
  }

  const payload = await response.json();
  return { content: parseAssistantText(payload) };
}

export async function testProviderConnection(config: ProviderConfig, apiKey: string): Promise<ProviderPingResult> {
  const response = await fetch(buildChatCompletionsUrl(config), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: config.model,
      temperature: 0,
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 8
    })
  });

  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

export const providerLabel: Record<ProviderName, string> = {
  qwen: "Qwen",
  deepseek: "DeepSeek",
  glm: "GLM",
  custom: "Custom"
};

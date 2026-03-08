import type { ChatMessage } from "./llmProviders";

interface ProxyChatResult {
  content: string;
  provider: string;
  model: string;
}

interface ProxyTestResult {
  ok: boolean;
  status: number;
  body: string;
  provider: string;
  model: string;
}

export async function callDefaultProxyChat(params: {
  messages: ChatMessage[];
  temperature?: number;
  model?: string;
}): Promise<ProxyChatResult> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      action: "chat",
      messages: params.messages,
      temperature: params.temperature,
      model: params.model
    })
  });

  const payload = (await response.json()) as Partial<ProxyChatResult> & { error?: string; body?: string };
  if (!response.ok) {
    throw new Error(payload.error || payload.body || `Proxy chat failed: ${response.status}`);
  }

  return {
    content: payload.content || "",
    provider: payload.provider || "default",
    model: payload.model || ""
  };
}

export async function testDefaultProxyConnection(): Promise<ProxyTestResult> {
  const response = await fetch("/api/llm", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ action: "test" })
  });

  const payload = (await response.json()) as Partial<ProxyTestResult> & { error?: string; required?: string[] };
  if (!response.ok) {
    throw new Error(payload.error || `Proxy test failed: ${response.status}`);
  }

  return {
    ok: Boolean(payload.ok),
    status: payload.status || 0,
    body: payload.body || "",
    provider: payload.provider || "default",
    model: payload.model || ""
  };
}

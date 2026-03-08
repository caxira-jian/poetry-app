import type { ChatMessage } from "./llmProviders";

interface ProxyTimings {
  readBodyMs: number;
  upstreamMs: number;
  parseUpstreamJsonMs: number;
  totalMs: number;
}

interface ProxyUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface ProxyChatResult {
  content: string;
  provider: string;
  model: string;
  upstreamModel?: string;
  requestId?: string;
  timings?: ProxyTimings;
  usage?: ProxyUsage;
}

interface ProxyTestResult {
  ok: boolean;
  status: number;
  body: string;
  provider: string;
  model: string;
  upstreamModel?: string;
  requestId?: string;
  timings?: ProxyTimings;
  usage?: ProxyUsage;
}

function safeParseJson<T>(raw: string): T | null {
  if (!raw.trim()) {
    return null;
  }
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readPayload(response: Response): Promise<{ payload: Record<string, unknown> | null; rawText: string }> {
  const rawText = await response.text();
  const payload = safeParseJson<Record<string, unknown>>(rawText);
  return { payload, rawText };
}

function buildNonJsonError(status: number, rawText: string): Error {
  const snippet = rawText.slice(0, 500);
  return new Error(`Proxy returned non-JSON or empty body: ${status} ${snippet}`);
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

  const { payload, rawText } = await readPayload(response);
  if (!payload) {
    throw buildNonJsonError(response.status, rawText);
  }

  if (!response.ok) {
    const error = typeof payload.error === "string" ? payload.error : "";
    const body = typeof payload.body === "string" ? payload.body : "";
    throw new Error(error || body || `Proxy chat failed: ${response.status}`);
  }

  return {
    content: typeof payload.content === "string" ? payload.content : "",
    provider: typeof payload.provider === "string" ? payload.provider : "default",
    model: typeof payload.model === "string" ? payload.model : "",
    upstreamModel: typeof payload.upstreamModel === "string" ? payload.upstreamModel : undefined,
    requestId: typeof payload.requestId === "string" ? payload.requestId : undefined,
    timings: (payload.timings as ProxyTimings | undefined) || undefined,
    usage: (payload.usage as ProxyUsage | undefined) || undefined
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

  const { payload, rawText } = await readPayload(response);
  if (!payload) {
    throw buildNonJsonError(response.status, rawText);
  }

  if (!response.ok) {
    const error = typeof payload.error === "string" ? payload.error : "";
    throw new Error(error || `Proxy test failed: ${response.status}`);
  }

  return {
    ok: Boolean(payload.ok),
    status: typeof payload.status === "number" ? payload.status : 0,
    body: typeof payload.body === "string" ? payload.body : "",
    provider: typeof payload.provider === "string" ? payload.provider : "default",
    model: typeof payload.model === "string" ? payload.model : "",
    upstreamModel: typeof payload.upstreamModel === "string" ? payload.upstreamModel : undefined,
    requestId: typeof payload.requestId === "string" ? payload.requestId : undefined,
    timings: (payload.timings as ProxyTimings | undefined) || undefined,
    usage: (payload.usage as ProxyUsage | undefined) || undefined
  };
}

import { appendFile, mkdir } from "node:fs/promises";`nimport { LLM_PROMPTS } from "../shared/llmPrompts";
import type { IncomingMessage, ServerResponse } from "node:http";
import { dirname, join } from "node:path";

type Role = "system" | "user";

interface ChatMessage {
  role: Role;
  content: string;
}

interface RequestBody {
  action: "chat" | "test";
  messages?: ChatMessage[];
  temperature?: number;
  model?: string;
}

interface TimingStats {
  readBodyMs: number;
  upstreamMs: number;
  parseUpstreamJsonMs: number;
  totalMs: number;
}

interface UsageStats {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface LogEntry {
  ts: string;
  action: RequestBody["action"];
  ok: boolean;
  status: number;
  provider: string;
  model: string;
  upstreamModel?: string;
  requestId?: string;
  promptChars: number;
  requestMessages?: ChatMessage[];
  responseContent?: string;
  upstreamBody?: string;
  timings: TimingStats;
  usage?: UsageStats;
  error?: string;
}

function getEnv(name: string, fallback?: string): string {
  const value = process.env[name] || (fallback ? process.env[fallback] : "");
  return (value || "").trim();
}

function getConfig() {
  const provider = getEnv("DEFAULT_API_PROVIDER", "VITE_DEFAULT_API_PROVIDER") || "custom";
  const baseUrl = getEnv("DEFAULT_API_BASE_URL", "VITE_DEFAULT_API_BASE_URL");
  const model = getEnv("DEFAULT_API_MODEL", "VITE_DEFAULT_API_MODEL");
  const apiKey = getEnv("DEFAULT_API_KEY");
  const temperatureRaw = Number(getEnv("DEFAULT_API_TEMPERATURE", "VITE_DEFAULT_API_TEMPERATURE") || "0.3");

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    temperature: Number.isFinite(temperatureRaw) ? temperatureRaw : 0.3
  };
}

function toChatUrl(baseUrl: string): string {
  return `${baseUrl.replace(/\/$/, "")}/chat/completions`;
}

function writeJson(res: ServerResponse, status: number, payload: unknown): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

async function readBody(req: IncomingMessage): Promise<RequestBody> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw) {
    return { action: "test" };
  }
  return JSON.parse(raw) as RequestBody;
}

function buildMessages(body: RequestBody): ChatMessage[] {
  if (body.action === "test") {
    return [{ role: "user", content: LLM_PROMPTS.connectivityPingUser }];
  }
  if (body.messages && body.messages.length > 0) {
    return body.messages;
  }
  return [{ role: "user", content: LLM_PROMPTS.connectivityPingUser }];
}

async function callDefaultApi(config: ReturnType<typeof getConfig>, body: RequestBody, messages: ChatMessage[]) {
  const response = await fetch(toChatUrl(config.baseUrl), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.apiKey}`
    },
    body: JSON.stringify({
      model: body.model || config.model,
      temperature: body.temperature ?? config.temperature,
      messages,
      max_tokens: body.action === "test" ? 8 : undefined
    })
  });

  const text = await response.text();
  return { response, text };
}

function parseUpstreamJson(text: string): Record<string, unknown> | null {
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function readUsage(payload: Record<string, unknown> | null): UsageStats | undefined {
  if (!payload || typeof payload !== "object" || !("usage" in payload)) {
    return undefined;
  }
  const usage = payload.usage as Record<string, unknown>;
  return {
    promptTokens: Number(usage.prompt_tokens || 0),
    completionTokens: Number(usage.completion_tokens || 0),
    totalTokens: Number(usage.total_tokens || 0)
  };
}

function getLogFilePath(): string {
  const directFile = getEnv("LLM_LOG_FILE");
  if (directFile) {
    return directFile;
  }

  const customDir = getEnv("LLM_LOG_DIR");
  if (customDir) {
    return join(customDir, "llm-latency.log");
  }

  if (process.env.VERCEL) {
    return "/tmp/llm-latency.log";
  }

  return join(process.cwd(), "logs", "llm-latency.log");
}

async function appendLog(entry: LogEntry): Promise<void> {
  const filePath = getLogFilePath();
  const line = `${JSON.stringify(entry)}\n`;
  try {
    await mkdir(dirname(filePath), { recursive: true });
    await appendFile(filePath, line, "utf-8");
  } catch {
    // 日志写入失败不应影响主流程
  }
  console.log(`[llm-latency] ${line.trim()}`);
}

function extractAssistantContent(payload: Record<string, unknown> | null): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const choices = payload.choices as Array<{ message?: { content?: string } }> | undefined;
  return choices?.[0]?.message?.content || "";
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const totalStart = Date.now();

  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  let action: RequestBody["action"] = "test";
  let provider = "custom";
  let model = "";
  let promptChars = 0;
  let requestMessages: ChatMessage[] = [];

  try {
    const config = getConfig();
    provider = config.provider;
    model = config.model;

    if (!config.baseUrl || !config.model || !config.apiKey) {
      const entry: LogEntry = {
        ts: new Date().toISOString(),
        action,
        ok: false,
        status: 500,
        provider,
        model,
        promptChars,
        requestMessages,
        timings: {
          readBodyMs: 0,
          upstreamMs: 0,
          parseUpstreamJsonMs: 0,
          totalMs: Date.now() - totalStart
        },
        error: "Default API is not configured on server"
      };
      await appendLog(entry);
      writeJson(res, 500, {
        error: "Default API is not configured on server",
        required: ["DEFAULT_API_BASE_URL", "DEFAULT_API_MODEL", "DEFAULT_API_KEY"]
      });
      return;
    }

    const readStart = Date.now();
    const body = await readBody(req);
    const readBodyMs = Date.now() - readStart;

    if (body.action !== "chat" && body.action !== "test") {
      writeJson(res, 400, { error: "Invalid action" });
      return;
    }

    action = body.action;
    requestMessages = buildMessages(body);
    promptChars = requestMessages.reduce((sum, item) => sum + (item.content || "").length, 0);

    const upstreamStart = Date.now();
    const { response, text } = await callDefaultApi(config, body, requestMessages);
    const upstreamMs = Date.now() - upstreamStart;

    const parseStart = Date.now();
    const payload = parseUpstreamJson(text);
    const parseUpstreamJsonMs = Date.now() - parseStart;

    const usage = readUsage(payload);
    const responseContent = extractAssistantContent(payload);
    const timings: TimingStats = {
      readBodyMs,
      upstreamMs,
      parseUpstreamJsonMs,
      totalMs: Date.now() - totalStart
    };

    const logEntry: LogEntry = {
      ts: new Date().toISOString(),
      action,
      ok: response.ok,
      status: response.status,
      provider: config.provider,
      model: config.model,
      upstreamModel: typeof payload?.model === "string" ? payload.model : undefined,
      requestId: typeof payload?.id === "string" ? payload.id : undefined,
      promptChars,
      requestMessages,
      responseContent,
      upstreamBody: text,
      timings,
      usage,
      error: response.ok ? undefined : `Upstream API failed: ${response.status}`
    };
    await appendLog(logEntry);

    if (body.action === "test") {
      writeJson(res, response.ok ? 200 : 502, {
        ok: response.ok,
        status: response.status,
        body: text,
        provider: config.provider,
        model: config.model
      });
      return;
    }

    if (!response.ok) {
      writeJson(res, 502, {
        error: `Upstream API failed: ${response.status}`,
        body: text,
        provider: config.provider,
        model: config.model
      });
      return;
    }

    writeJson(res, 200, {
      content: responseContent,
      provider: config.provider,
      model: config.model
    });
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    const entry: LogEntry = {
      ts: new Date().toISOString(),
      action,
      ok: false,
      status: 500,
      provider,
      model,
      promptChars,
      requestMessages,
      timings: {
        readBodyMs: 0,
        upstreamMs: 0,
        parseUpstreamJsonMs: 0,
        totalMs: Date.now() - totalStart
      },
      error: errorText
    };
    await appendLog(entry);

    writeJson(res, 500, {
      error: errorText
    });
  }
}



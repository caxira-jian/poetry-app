import type { IncomingMessage, ServerResponse } from "node:http";

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

async function callDefaultApi(config: ReturnType<typeof getConfig>, body: RequestBody) {
  const messages =
    body.action === "test"
      ? [{ role: "user", content: "ping" }]
      : body.messages && body.messages.length > 0
        ? body.messages
        : [{ role: "user", content: "ping" }];

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

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    writeJson(res, 405, { error: "Method Not Allowed" });
    return;
  }

  try {
    const config = getConfig();
    if (!config.baseUrl || !config.model || !config.apiKey) {
      writeJson(res, 500, {
        error: "Default API is not configured on server",
        required: ["DEFAULT_API_BASE_URL", "DEFAULT_API_MODEL", "DEFAULT_API_KEY"]
      });
      return;
    }

    const body = await readBody(req);
    if (body.action !== "chat" && body.action !== "test") {
      writeJson(res, 400, { error: "Invalid action" });
      return;
    }

    const { response, text } = await callDefaultApi(config, body);

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

    const payload = JSON.parse(text) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    writeJson(res, 200, {
      content: payload.choices?.[0]?.message?.content || "",
      provider: config.provider,
      model: config.model
    });
  } catch (error) {
    writeJson(res, 500, {
      error: error instanceof Error ? error.message : String(error)
    });
  }
}

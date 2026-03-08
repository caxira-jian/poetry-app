import type { ProviderConfig, ProviderName } from "../types";

interface DefaultApiEnv {
  provider: ProviderName;
  baseUrl: string;
  model: string;
  apiKey: string;
  temperature: number;
}

function readDefaultEnv(): DefaultApiEnv | null {
  const provider = (import.meta.env.VITE_DEFAULT_API_PROVIDER || "").trim() as ProviderName;
  const baseUrl = (import.meta.env.VITE_DEFAULT_API_BASE_URL || "").trim();
  const model = (import.meta.env.VITE_DEFAULT_API_MODEL || "").trim();
  const apiKey = (import.meta.env.VITE_DEFAULT_API_KEY || "").trim();
  const temperatureRaw = Number(import.meta.env.VITE_DEFAULT_API_TEMPERATURE || "0.3");

  if (!provider || !baseUrl || !model || !apiKey) {
    return null;
  }

  if (!["qwen", "deepseek", "glm", "custom"].includes(provider)) {
    return null;
  }

  return {
    provider,
    baseUrl,
    model,
    apiKey,
    temperature: Number.isFinite(temperatureRaw) ? temperatureRaw : 0.3
  };
}

export function getDefaultApiProfile(): { config: ProviderConfig; apiKey: string } | null {
  const env = readDefaultEnv();
  if (!env) {
    return null;
  }

  const config: ProviderConfig = {
    provider: env.provider,
    baseUrl: env.baseUrl,
    model: env.model,
    enabled: true,
    temperature: env.temperature
  };

  return {
    config,
    apiKey: env.apiKey
  };
}

import type { ProviderConfig, ProviderName } from "../types";

interface DefaultApiEnv {
  provider: ProviderName;
  baseUrl: string;
  model: string;
  temperature: number;
}

function readDefaultEnv(): DefaultApiEnv {
  const providerRaw = (import.meta.env.VITE_DEFAULT_API_PROVIDER || "custom").trim() as ProviderName;
  const provider = ["qwen", "deepseek", "glm", "custom"].includes(providerRaw) ? providerRaw : "custom";
  const baseUrl = (import.meta.env.VITE_DEFAULT_API_BASE_URL || "").trim();
  const model = (import.meta.env.VITE_DEFAULT_API_MODEL || "").trim();
  const temperatureRaw = Number(import.meta.env.VITE_DEFAULT_API_TEMPERATURE || "0.3");

  return {
    provider,
    baseUrl,
    model,
    temperature: Number.isFinite(temperatureRaw) ? temperatureRaw : 0.3
  };
}

export function getDefaultApiProfile(): { config: ProviderConfig } {
  const env = readDefaultEnv();

  const config: ProviderConfig = {
    provider: env.provider,
    baseUrl: env.baseUrl || "(server-side)",
    model: env.model || "(server-side)",
    enabled: true,
    temperature: env.temperature
  };

  return { config };
}

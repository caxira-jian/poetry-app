import type { Poem, ProviderConfig, ReciteLog } from "../types";
import { clearStore, getAll, getSetting, putMany, putOne, setSetting } from "./db";
import { defaultProviderConfigs, seedPoems } from "./seeds";

const PROVIDER_CONFIGS_KEY = "providers.configs";

function byDateDesc(a: ReciteLog, b: ReciteLog): number {
  return new Date(b.recitedAt).getTime() - new Date(a.recitedAt).getTime();
}

function normalizePoem(poem: Poem): Poem {
  return {
    ...poem,
    tags: Array.isArray(poem.tags) ? poem.tags : [],
    masteryLevel: Number.isFinite(poem.masteryLevel) ? poem.masteryLevel : 0,
    reciteCount: Number.isFinite(poem.reciteCount) ? poem.reciteCount : 0,
    viewCount: Number.isFinite(poem.viewCount) ? poem.viewCount : 0
  };
}

export async function getPoems(): Promise<Poem[]> {
  const poems = await getAll<Poem>("poems");
  return poems.map(normalizePoem);
}

export async function getReciteLogs(): Promise<ReciteLog[]> {
  const logs = await getAll<ReciteLog>("recite_logs");
  return logs.sort(byDateDesc);
}

export async function savePoem(poem: Poem): Promise<void> {
  await putOne("poems", normalizePoem(poem));
}

export async function savePoems(poems: Poem[]): Promise<void> {
  await putMany("poems", poems.map(normalizePoem));
}

export async function addReciteLog(log: ReciteLog): Promise<void> {
  await putOne("recite_logs", log);
}

export async function getProviderConfigs(): Promise<ProviderConfig[]> {
  const raw = await getSetting(PROVIDER_CONFIGS_KEY);
  if (!raw) {
    await setProviderConfigs(defaultProviderConfigs);
    return [...defaultProviderConfigs];
  }
  return JSON.parse(raw) as ProviderConfig[];
}

export async function setProviderConfigs(configs: ProviderConfig[]): Promise<void> {
  await setSetting(PROVIDER_CONFIGS_KEY, JSON.stringify(configs));
}

export async function initializeSeedPoems(force = false): Promise<number> {
  const existing = await getPoems();
  if (existing.length > 0 && !force) {
    return 0;
  }

  if (force) {
    await clearStore("poems");
    await clearStore("recite_logs");
  }

  await savePoems(seedPoems);
  return seedPoems.length;
}

export interface ImportPayload {
  poems: Poem[];
  reciteLogs: ReciteLog[];
  providerConfigs?: ProviderConfig[];
}

export async function importData(payload: ImportPayload, mode: "merge" | "overwrite"): Promise<void> {
  if (mode === "overwrite") {
    await clearStore("poems");
    await clearStore("recite_logs");
  }

  await savePoems(payload.poems);
  await putMany("recite_logs", payload.reciteLogs);

  if (payload.providerConfigs) {
    await setProviderConfigs(payload.providerConfigs);
  }
}

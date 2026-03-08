import { computed, reactive } from "vue";
import { applyReciteResult, buildReciteLog } from "./domain/recite";
import {
  decryptSecret,
  encryptSecret,
  hasMasterPassword,
  initializeMasterPassword,
  isSessionUnlocked,
  lockSession,
  tryAutoUnlock,
  unlockMasterPassword
} from "./services/crypto";
import { getDefaultApiProfile } from "./services/defaultApi";
import { testProviderConnection } from "./services/llmProviders";
import { parseNaturalInputFromLlm, type NluAction, type NluParseResult } from "./services/nluService";
import { getFallbackRecommendation, getRecommendationsFromLlm } from "./services/recommendationService";
import {
  addReciteLog,
  getPoems,
  getProviderConfigs,
  getReciteLogs,
  importData,
  initializeSeedPoems,
  savePoem,
  savePoems,
  setProviderConfigs
} from "./services/repository";
import type {
  ExportData,
  LearnIntent,
  Poem,
  ProviderConfig,
  ProviderName,
  ReciteLog,
  ReciteStatus,
  RecommendationResult
} from "./types";

interface SaveProviderInput extends ProviderConfig {
  plainApiKey?: string;
}

interface ChangeItem {
  kind: "新增" | "删除" | "修改";
  target: string;
  detail: string;
}

const API_MODE_KEY = "poetry.api.mode";
const defaultApiProfile = getDefaultApiProfile();
const defaultApiAvailable = Boolean(defaultApiProfile);

function loadApiMode(): "default" | "custom" {
  const saved = localStorage.getItem(API_MODE_KEY);
  if (saved === "default" || saved === "custom") {
    return saved;
  }
  return defaultApiAvailable ? "default" : "custom";
}

function saveApiMode(mode: "default" | "custom"): void {
  localStorage.setItem(API_MODE_KEY, mode);
}

const state = reactive({
  initialized: false,
  loading: false,
  llmBusy: false,
  llmTask: "",
  error: "",
  poems: [] as Poem[],
  reciteLogs: [] as ReciteLog[],
  providerConfigs: [] as ProviderConfig[],
  recommendation: null as RecommendationResult | null,
  recommendationDebug: "",
  providerTestResult: "",
  nluResult: "",
  nluPreviewSummary: "",
  nluPreviewActionsJson: "",
  nluChangeSummary: "",
  nluChangeItemsJson: "",
  nluDraftSourceText: "",
  hasNluDraft: false,
  rememberBrowserForDay: true,
  hasMasterPassword: false,
  unlocked: false,
  defaultApiAvailable,
  apiMode: loadApiMode()
});

let nluDraftActions: NluAction[] = [];

function clearError(): void {
  state.error = "";
}

function setError(error: unknown): void {
  state.error = error instanceof Error ? error.message : String(error);
}

function toPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function startLlm(task: string): void {
  state.llmBusy = true;
  state.llmTask = task;
}

function endLlm(): void {
  state.llmBusy = false;
  state.llmTask = "";
}

function normalizeIso(input?: string): string {
  if (!input) {
    return new Date().toISOString();
  }
  const value = new Date(input);
  return Number.isNaN(value.getTime()) ? new Date().toISOString() : value.toISOString();
}

function poemIdFrom(title: string, author: string): string {
  const base = `${title}-${author}`.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "");
  return `poem-${base}-${crypto.randomUUID().slice(0, 6)}`;
}

function formatTarget(title: string, author?: string): string {
  return author ? `《${title}》/${author}` : `《${title}》`;
}

function findPoem(poems: Poem[], title: string, author?: string): Poem | undefined {
  const normalizedTitle = title.trim();
  const normalizedAuthor = author?.trim();
  return poems.find((poem) => {
    if (poem.title !== normalizedTitle) {
      return false;
    }
    if (!normalizedAuthor) {
      return true;
    }
    return poem.author === normalizedAuthor;
  });
}

function ensurePoem(poems: Poem[], title: string, author?: string): Poem {
  const existed = findPoem(poems, title, author);
  if (existed) {
    return existed;
  }

  const next: Poem = {
    id: poemIdFrom(title.trim(), (author || "未知作者").trim()),
    title: title.trim(),
    author: (author || "未知作者").trim(),
    content: "内容待补充",
    tags: [],
    learnIntent: "wishlist",
    currentStatus: "none",
    masteryLevel: 0
  };
  poems.push(next);
  return next;
}

function clearNluDraft(): void {
  nluDraftActions = [];
  state.nluPreviewSummary = "";
  state.nluPreviewActionsJson = "";
  state.nluChangeSummary = "";
  state.nluChangeItemsJson = "";
  state.nluDraftSourceText = "";
  state.hasNluDraft = false;
}

function setRememberBrowserForDay(enabled: boolean): void {
  state.rememberBrowserForDay = enabled;
}

function setApiMode(mode: "default" | "custom"): void {
  state.apiMode = mode;
  saveApiMode(mode);
}

async function getEnabledProviderWithKey(): Promise<{ config: ProviderConfig; apiKey: string; source: "default" | "custom" }> {
  if (state.apiMode === "default") {
    if (!defaultApiProfile) {
      throw new Error("默认 API 未配置完整（请设置 VITE_DEFAULT_API_*）");
    }
    return {
      config: defaultApiProfile.config,
      apiKey: defaultApiProfile.apiKey,
      source: "default"
    };
  }

  if (!state.unlocked) {
    throw new Error("会话未解锁，请先在模型页解锁主密码");
  }

  const enabledConfig = state.providerConfigs.find((item) => item.enabled);
  if (!enabledConfig) {
    throw new Error("未启用任何模型配置");
  }

  if (!enabledConfig.encryptedApiKey || !enabledConfig.encryptedApiKeyIv) {
    throw new Error(`模型 ${enabledConfig.provider} 未保存 API Key`);
  }

  const apiKey = await decryptSecret(enabledConfig.encryptedApiKey, enabledConfig.encryptedApiKeyIv);
  return {
    config: enabledConfig,
    apiKey,
    source: "custom"
  };
}

async function refreshAll(): Promise<void> {
  const [poems, reciteLogs, providerConfigs, hasMaster] = await Promise.all([
    getPoems(),
    getReciteLogs(),
    getProviderConfigs(),
    hasMasterPassword()
  ]);
  state.poems = poems;
  state.reciteLogs = reciteLogs;
  state.providerConfigs = providerConfigs;
  state.hasMasterPassword = hasMaster;
  state.unlocked = isSessionUnlocked();
}

async function init(): Promise<void> {
  if (state.initialized) {
    return;
  }

  state.loading = true;
  clearError();
  try {
    await tryAutoUnlock();
    await refreshAll();
    state.initialized = true;
  } catch (error) {
    setError(error);
  } finally {
    state.loading = false;
  }
}

async function ensureSeedPoems(force = false): Promise<number> {
  state.loading = true;
  clearError();
  try {
    const count = await initializeSeedPoems(force);
    await refreshAll();
    return count;
  } catch (error) {
    setError(error);
    return 0;
  } finally {
    state.loading = false;
  }
}

async function upsertPoem(poem: Poem): Promise<void> {
  state.loading = true;
  clearError();
  try {
    await savePoem(toPlain(poem));
    await refreshAll();
  } catch (error) {
    setError(error);
  } finally {
    state.loading = false;
  }
}

async function upsertPoems(poems: Poem[]): Promise<void> {
  state.loading = true;
  clearError();
  try {
    await savePoems(toPlain(poems));
    await refreshAll();
  } catch (error) {
    setError(error);
  } finally {
    state.loading = false;
  }
}

async function recordRecite(params: {
  poemId: string;
  status: ReciteStatus;
  recitedAt: string;
  note?: string;
}): Promise<void> {
  state.loading = true;
  clearError();
  try {
    const poem = state.poems.find((item) => item.id === params.poemId);
    if (!poem) {
      throw new Error("Poem not found");
    }

    const nextPoem = applyReciteResult(poem, params.status, params.recitedAt);
    const log = buildReciteLog(poem, params.status, params.recitedAt, params.note);

    await savePoem(toPlain(nextPoem));
    await addReciteLog(toPlain(log));
    await refreshAll();
  } catch (error) {
    setError(error);
  } finally {
    state.loading = false;
  }
}

function applyNluAction(poems: Poem[], logs: ReciteLog[], action: NluAction, changes: ChangeItem[]): void {
  if (action.type === "upsert_poem") {
    const existed = findPoem(poems, action.poem.title, action.poem.author);
    const poem = ensurePoem(poems, action.poem.title, action.poem.author);

    const before = JSON.stringify({
      title: poem.title,
      author: poem.author,
      content: poem.content,
      dynasty: poem.dynasty,
      tags: poem.tags,
      learnIntent: poem.learnIntent
    });

    poem.content = action.poem.content?.trim() || poem.content;
    poem.dynasty = action.poem.dynasty?.trim() || poem.dynasty;
    poem.tags = Array.isArray(action.poem.tags) ? action.poem.tags.map((tag) => tag.trim()).filter(Boolean) : poem.tags;
    poem.learnIntent = action.poem.learnIntent || poem.learnIntent;

    const after = JSON.stringify({
      title: poem.title,
      author: poem.author,
      content: poem.content,
      dynasty: poem.dynasty,
      tags: poem.tags,
      learnIntent: poem.learnIntent
    });

    if (!existed) {
      changes.push({
        kind: "新增",
        target: formatTarget(poem.title, poem.author),
        detail: "新增诗词条目（默认意向为想学习，除非模型明确指定）。"
      });
    } else if (before !== after) {
      changes.push({
        kind: "修改",
        target: formatTarget(poem.title, poem.author),
        detail: "更新诗词内容/标签/意向。"
      });
    }
    return;
  }

  if (action.type === "delete_poem") {
    const existed = findPoem(poems, action.target.title, action.target.author);
    if (!existed) {
      return;
    }

    const removedLogs = logs.filter((log) => log.poemId === existed.id).length;
    const nextPoems = poems.filter((item) => item.id !== existed.id);
    const nextLogs = logs.filter((log) => log.poemId !== existed.id);

    poems.length = 0;
    poems.push(...nextPoems);
    logs.length = 0;
    logs.push(...nextLogs);

    changes.push({
      kind: "删除",
      target: formatTarget(existed.title, existed.author),
      detail: `删除诗词条目，并移除关联背诵记录 ${removedLogs} 条。`
    });
    return;
  }

  if (action.type === "set_intent") {
    const poem = ensurePoem(poems, action.target.title, action.target.author);
    const before = poem.learnIntent;
    poem.learnIntent = action.learnIntent as LearnIntent;
    if (before !== poem.learnIntent) {
      changes.push({
        kind: "修改",
        target: formatTarget(poem.title, poem.author),
        detail: `学习意向由 ${before} 调整为 ${poem.learnIntent}。`
      });
    }
    return;
  }

  if (action.type === "record_recite") {
    const poem = ensurePoem(poems, action.target.title, action.target.author);
    const recitedAt = normalizeIso(action.recitedAt);
    const nextPoem = applyReciteResult(poem, action.status, recitedAt);
    const index = poems.findIndex((item) => item.id === poem.id);
    poems[index] = nextPoem;
    logs.push(buildReciteLog(nextPoem, action.status, recitedAt, action.note));

    changes.push({
      kind: "修改",
      target: formatTarget(nextPoem.title, nextPoem.author),
      detail: `新增背诵记录并将状态更新为 ${action.status}。`
    });
  }
}

function evaluateNluActions(actions: NluAction[]): { nextPoems: Poem[]; nextLogs: ReciteLog[]; changes: ChangeItem[] } {
  const nextPoems = toPlain([...state.poems]);
  const nextLogs = toPlain([...state.reciteLogs]);
  const changes: ChangeItem[] = [];

  actions.forEach((action) => applyNluAction(nextPoems, nextLogs, action, changes));

  return { nextPoems, nextLogs, changes };
}

function buildChangeSummary(changes: ChangeItem[]): string {
  const added = changes.filter((item) => item.kind === "新增").length;
  const removed = changes.filter((item) => item.kind === "删除").length;
  const updated = changes.filter((item) => item.kind === "修改").length;
  return `变更校验：新增 ${added}，删除 ${removed}，修改 ${updated}`;
}

async function persistNluActions(actions: NluAction[]): Promise<ChangeItem[]> {
  const { nextPoems, nextLogs, changes } = evaluateNluActions(actions);

  if (actions.length > 0) {
    await importData(
      {
        poems: toPlain(nextPoems),
        reciteLogs: toPlain(nextLogs)
      },
      "overwrite"
    );
    await refreshAll();
  }

  return changes;
}

async function parseNaturalInputPreview(text: string): Promise<void> {
  state.loading = true;
  clearError();
  state.nluResult = "";

  try {
    const content = text.trim();
    if (!content) {
      throw new Error("请输入口语化内容");
    }

    startLlm("正在解析你的口语输入并检查全量诗库...");
    const { config, apiKey } = await getEnabledProviderWithKey();
    const parsed: NluParseResult = await parseNaturalInputFromLlm({
      text: content,
      poems: state.poems.map((item) => ({
        id: item.id,
        title: item.title,
        author: item.author,
        content: item.content,
        dynasty: item.dynasty,
        tags: item.tags,
        learnIntent: item.learnIntent,
        currentStatus: item.currentStatus,
        masteryLevel: item.masteryLevel,
        lastRecitedAt: item.lastRecitedAt
      })),
      config,
      apiKey
    });

    const preview = evaluateNluActions(parsed.actions);

    nluDraftActions = parsed.actions;
    state.nluDraftSourceText = content;
    state.nluPreviewSummary = parsed.summary || "已解析输入";
    state.nluPreviewActionsJson = JSON.stringify(parsed.actions, null, 2);
    state.nluChangeSummary = buildChangeSummary(preview.changes);
    state.nluChangeItemsJson = JSON.stringify(preview.changes, null, 2);
    state.hasNluDraft = true;
  } catch (error) {
    clearNluDraft();
    setError(error);
  } finally {
    endLlm();
    state.loading = false;
  }
}

async function confirmNaturalInput(): Promise<void> {
  state.loading = true;
  clearError();

  try {
    if (!state.hasNluDraft) {
      throw new Error("没有待确认的解析结果");
    }

    const changes = await persistNluActions(nluDraftActions);
    state.nluResult = `${state.nluPreviewSummary}（共 ${nluDraftActions.length} 条动作，已确认入库）。${buildChangeSummary(changes)}`;
    clearNluDraft();
  } catch (error) {
    setError(error);
  } finally {
    state.loading = false;
  }
}

async function processNaturalInput(text: string): Promise<void> {
  await parseNaturalInputPreview(text);
  if (!state.error && state.hasNluDraft) {
    await confirmNaturalInput();
  }
}

async function saveProviderConfig(input: SaveProviderInput): Promise<void> {
  state.loading = true;
  clearError();
  try {
    const configs = [...state.providerConfigs];
    const index = configs.findIndex((item) => item.provider === input.provider);

    let encryptedApiKey = input.encryptedApiKey;
    let encryptedApiKeyIv = input.encryptedApiKeyIv;

    if (input.plainApiKey?.trim()) {
      const encrypted = await encryptSecret(input.plainApiKey.trim());
      encryptedApiKey = encrypted.cipher;
      encryptedApiKeyIv = encrypted.iv;
    }

    const next: ProviderConfig = {
      provider: input.provider,
      baseUrl: input.baseUrl,
      model: input.model,
      enabled: input.enabled,
      temperature: input.temperature,
      keyAlias: input.keyAlias,
      encryptedApiKey,
      encryptedApiKeyIv
    };

    if (index >= 0) {
      configs[index] = next;
    } else {
      configs.push(next);
    }

    await setProviderConfigs(toPlain(configs));
    await refreshAll();
  } catch (error) {
    setError(error);
  } finally {
    state.loading = false;
  }
}

async function setMasterPassword(password: string, rememberForDay = state.rememberBrowserForDay): Promise<boolean> {
  state.loading = true;
  clearError();
  try {
    await initializeMasterPassword(password, rememberForDay);
    await refreshAll();
    return true;
  } catch (error) {
    setError(error);
    return false;
  } finally {
    state.loading = false;
  }
}

async function unlock(password: string, rememberForDay = state.rememberBrowserForDay): Promise<boolean> {
  state.loading = true;
  clearError();
  try {
    const ok = await unlockMasterPassword(password, rememberForDay);
    state.unlocked = ok;
    if (!ok) {
      state.error = "主密码错误或未初始化";
    }
    return ok;
  } catch (error) {
    setError(error);
    return false;
  } finally {
    state.loading = false;
  }
}

function lock(clearRemember = false): void {
  lockSession(clearRemember);
  state.unlocked = false;
}

async function testProvider(provider: ProviderName): Promise<void> {
  state.loading = true;
  clearError();
  state.providerTestResult = "";

  try {
    startLlm("正在请求模型连通性...");

    const source = state.apiMode === "default" ? "default" : "custom";
    const targetProvider = source === "default" ? (defaultApiProfile?.config.provider || provider) : provider;

    let config: ProviderConfig;
    let apiKey: string;

    if (source === "default") {
      if (!defaultApiProfile) {
        throw new Error("默认 API 未配置完整（请设置 VITE_DEFAULT_API_*）");
      }
      config = defaultApiProfile.config;
      apiKey = defaultApiProfile.apiKey;
    } else {
      if (!state.unlocked) {
        throw new Error("当前会话未解锁，请先输入主密码。");
      }
      const found = state.providerConfigs.find((item) => item.provider === provider);
      if (!found) {
        throw new Error(`未找到 ${provider} 配置。`);
      }
      if (!found.encryptedApiKey || !found.encryptedApiKeyIv) {
        throw new Error(`模型 ${provider} 未保存 API Key。`);
      }
      config = found;
      apiKey = await decryptSecret(found.encryptedApiKey, found.encryptedApiKeyIv);
    }

    const result = await testProviderConnection(config, apiKey);
    const snippet = result.body.slice(0, 600);
    state.providerTestResult = `[${targetProvider}] HTTP ${result.status}${result.ok ? " OK" : ""} | ${snippet}`;
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    state.providerTestResult = `[TEST FAILED] ${text}`;
  } finally {
    endLlm();
    state.loading = false;
  }
}

async function recommend(): Promise<void> {
  state.loading = true;
  clearError();
  state.recommendationDebug = "";
  try {
    if (state.poems.length === 0) {
      state.recommendationDebug = "诗库为空，请先到数据页初始化种子诗库或导入 JSON。";
      state.recommendation = getFallbackRecommendation(state.poems);
      return;
    }

    startLlm("正在让大模型生成推荐...");
    const { config, apiKey, source } = await getEnabledProviderWithKey();

    try {
      const llmResult = await getRecommendationsFromLlm({
        poems: state.poems,
        logs: state.reciteLogs,
        config,
        apiKey
      });

      const isEmpty = llmResult.review.length === 0 && llmResult.newLearning.length === 0;
      if (isEmpty) {
        state.recommendationDebug = `LLM 调用成功但返回空推荐，已切换规则候选。来源：${config.provider}（${source}）。`;
        state.recommendation = getFallbackRecommendation(state.poems);
      } else {
        state.recommendation = llmResult;
        state.recommendationDebug = `LLM 推荐成功，来源：${config.provider}（${source}）。`;
      }
    } catch (error) {
      const errorText = error instanceof Error ? error.message : String(error);
      state.recommendationDebug = `调用 ${config.provider} 失败：${errorText}。已使用兜底方案。`;
      state.recommendation = getFallbackRecommendation(state.poems);
    }
  } catch (error) {
    const errorText = error instanceof Error ? error.message : String(error);
    state.recommendationDebug = `${errorText}。已使用兜底方案。`;
    state.recommendation = getFallbackRecommendation(state.poems);
  } finally {
    endLlm();
    state.loading = false;
  }
}

function exportJson(): string {
  const payload: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    poems: state.poems,
    reciteLogs: state.reciteLogs,
    providerConfigs: state.providerConfigs
  };
  return JSON.stringify(payload, null, 2);
}

async function importJson(text: string, mode: "merge" | "overwrite"): Promise<void> {
  state.loading = true;
  clearError();
  try {
    const parsed = JSON.parse(text) as Partial<ExportData>;
    if (!Array.isArray(parsed.poems) || !Array.isArray(parsed.reciteLogs)) {
      throw new Error("JSON 格式错误：缺少 poems 或 reciteLogs 数组");
    }

    await importData(
      {
        poems: parsed.poems,
        reciteLogs: parsed.reciteLogs,
        providerConfigs: parsed.providerConfigs
      },
      mode
    );
    await refreshAll();
  } catch (error) {
    setError(error);
  } finally {
    state.loading = false;
  }
}

const stats = computed(() => {
  const proficientCount = state.poems.filter((item) => item.currentStatus === "proficient").length;
  const total = state.poems.length;
  return {
    total,
    proficientCount,
    logs: state.reciteLogs.length
  };
});

export function useAppStore() {
  return {
    state,
    stats,
    init,
    ensureSeedPoems,
    upsertPoem,
    upsertPoems,
    recordRecite,
    processNaturalInput,
    parseNaturalInputPreview,
    confirmNaturalInput,
    clearNluDraft,
    setRememberBrowserForDay,
    setApiMode,
    saveProviderConfig,
    setMasterPassword,
    unlock,
    lock,
    testProvider,
    recommend,
    exportJson,
    importJson
  };
}

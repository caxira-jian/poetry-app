import type { Poem, ProviderConfig } from "../types";

export const seedPoems: Poem[] = [
  {
    id: "poem-jingyesi",
    title: "静夜思",
    author: "李白",
    dynasty: "唐",
    content: "床前明月光，疑是地上霜。举头望明月，低头思故乡。",
    tags: ["思乡", "入门"],
    learnIntent: "learning",
    currentStatus: "none",
    masteryLevel: 0,
    reciteCount: 0,
    viewCount: 0
  },
  {
    id: "poem-chuntian",
    title: "春晓",
    author: "孟浩然",
    dynasty: "唐",
    content: "春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。",
    tags: ["春天", "入门"],
    learnIntent: "learning",
    currentStatus: "none",
    masteryLevel: 0,
    reciteCount: 0,
    viewCount: 0
  },
  {
    id: "poem-dengguanquelou",
    title: "登鹳雀楼",
    author: "王之涣",
    dynasty: "唐",
    content: "白日依山尽，黄河入海流。欲穷千里目，更上一层楼。",
    tags: ["励志"],
    learnIntent: "known",
    currentStatus: "completed",
    masteryLevel: 2,
    reciteCount: 1,
    viewCount: 0,
    lastRecitedAt: new Date().toISOString()
  },
  {
    id: "poem-youziyin",
    title: "游子吟",
    author: "孟郊",
    dynasty: "唐",
    content: "慈母手中线，游子身上衣。临行密密缝，意恐迟迟归。谁言寸草心，报得三春晖。",
    tags: ["亲情"],
    learnIntent: "wishlist",
    currentStatus: "none",
    masteryLevel: 0,
    reciteCount: 0,
    viewCount: 0
  },
  {
    id: "poem-chibi",
    title: "赤壁",
    author: "杜牧",
    dynasty: "唐",
    content: "折戟沉沙铁未销，自将磨洗认前朝。东风不与周郎便，铜雀春深锁二乔。",
    tags: ["历史"],
    learnIntent: "wishlist",
    currentStatus: "none",
    masteryLevel: 0,
    reciteCount: 0,
    viewCount: 0
  }
];

export const defaultProviderConfigs: ProviderConfig[] = [
  {
    provider: "qwen",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    model: "qwen-plus",
    enabled: false,
    temperature: 0.3,
    keyAlias: "Qwen Key"
  },
  {
    provider: "deepseek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    enabled: false,
    temperature: 0.3,
    keyAlias: "DeepSeek Key"
  },
  {
    provider: "glm",
    baseUrl: "https://open.bigmodel.cn/api/paas/v4",
    model: "glm-4-plus",
    enabled: false,
    temperature: 0.3,
    keyAlias: "GLM Key"
  },
  {
    provider: "custom",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    enabled: false,
    temperature: 0.3,
    keyAlias: "Custom OpenAI-Compatible Key"
  }
];

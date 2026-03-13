<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { Poem } from "../types";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ poem: Poem; store: ReturnType<typeof useAppStore> }>();

const showConfirm = ref(false);
let viewTimer: number | null = null;
let countedView = false;

const formattedContent = computed(() => {
  const raw = props.poem.content || "";
  if (raw.includes("\n")) {
    return raw;
  }
  return raw.replace(/([，。！？])/g, "$1\n").replace(/\n+/g, "\n").trim();
});

const hasRecitedToday = computed(() => props.store.hasRecitedToday(props.poem.id));
const lastRecitedText = computed(() => {
  return props.poem.lastRecitedAt ? new Date(props.poem.lastRecitedAt).toLocaleString() : "暂无";
});

function startViewTimer() {
  if (countedView) {
    return;
  }
  viewTimer = window.setTimeout(async () => {
    countedView = true;
    await props.store.markPoemViewed(props.poem.id);
  }, 10000);
}

function stopViewTimer() {
  if (viewTimer !== null) {
    window.clearTimeout(viewTimer);
    viewTimer = null;
  }
}

async function confirmRecite() {
  showConfirm.value = false;
  await props.store.markPoemRecitedToday(props.poem.id);
}

onMounted(() => {
  startViewTimer();
});

onUnmounted(() => {
  stopViewTimer();
});
</script>

<template>
  <section class="detail-page">
    <header class="detail-nav">
      <button class="nav-back" type="button" @click="props.store.closePoemDetail">返回</button>
      <div class="nav-title">诗词详情</div>
      <div class="nav-placeholder"></div>
    </header>

    <div class="detail-body">
      <div class="meta card">
        <h2>{{ props.poem.title }}</h2>
        <div class="author">{{ props.poem.dynasty || "-" }} · {{ props.poem.author }}</div>
        <div class="stats-row">
          <span>背诵次数 {{ props.poem.reciteCount }}</span>
          <span>浏览次数 {{ props.poem.viewCount }}</span>
        </div>
        <div class="stats-row muted">最近背诵时间：{{ lastRecitedText }}</div>
      </div>

      <article class="content card">
        <pre>{{ formattedContent }}</pre>
      </article>
    </div>

    <div class="floating-actions">
      <button type="button" :disabled="props.store.state.loading || hasRecitedToday" @click="showConfirm = true">
        {{ hasRecitedToday ? "今日已打卡" : "背诵打卡" }}
      </button>
    </div>

    <div v-if="showConfirm" class="modal-mask" @click.self="showConfirm = false">
      <div class="modal-card">
        <div class="modal-title">已经完整背诵</div>
        <div class="modal-text">确认后将记录一次今日打卡，并更新最近背诵时间。</div>
        <div class="modal-actions">
          <button class="secondary" type="button" @click="showConfirm = false">取消</button>
          <button type="button" @click="confirmRecite">确认</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.detail-page {
  min-height: 100vh;
  padding-bottom: 96px;
}

.detail-nav {
  position: sticky;
  top: 0;
  z-index: 20;
  display: grid;
  grid-template-columns: 72px 1fr 72px;
  align-items: center;
  padding: 10px 0 14px;
  background: rgba(246, 239, 229, 0.94);
  backdrop-filter: blur(10px);
}

.nav-back {
  padding: 8px 0;
  background: transparent;
  color: var(--primary);
  text-align: left;
}

.nav-title {
  text-align: center;
  font-weight: 700;
}

.nav-placeholder {
  height: 1px;
}

.detail-body {
  display: grid;
  gap: 12px;
}

.meta h2 {
  margin: 0 0 6px;
  font-size: 30px;
}

.author {
  margin-bottom: 10px;
  color: var(--subtext);
  font-size: 16px;
}

.stats-row {
  display: flex;
  gap: 14px;
  flex-wrap: wrap;
  line-height: 1.8;
}

.content pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: inherit;
  font-size: 24px;
  line-height: 2;
  text-align: center;
}

.floating-actions {
  position: fixed;
  left: 50%;
  bottom: 16px;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 24px));
  padding: 8px;
  background: rgba(255, 247, 237, 0.95);
  border: 1px solid var(--border);
  border-radius: 18px;
  box-shadow: 0 10px 24px rgba(64, 45, 12, 0.12);
}

.floating-actions button {
  width: 100%;
}

.modal-mask {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(31, 29, 26, 0.32);
}

.modal-card {
  width: min(420px, 100%);
  padding: 18px;
  border: 1px solid var(--border);
  border-radius: 16px;
  background: #fffaf4;
}

.modal-title {
  font-size: 20px;
  font-weight: 700;
}

.modal-text {
  margin-top: 8px;
  color: var(--subtext);
  line-height: 1.7;
}

.modal-actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
}

.modal-actions button {
  flex: 1;
}
</style>

<script setup lang="ts">
import { computed, ref } from "vue";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();

const naturalInput = ref("");
const showInput = ref(false);

const canShowInput = computed(() => showInput.value || props.store.state.hasNluDraft || Boolean(props.store.state.nluResult));

async function parsePreview() {
  await props.store.parseNaturalInputPreview(naturalInput.value);
}

async function confirmSave() {
  await props.store.confirmNaturalInput();
  if (!props.store.state.error) {
    naturalInput.value = "";
  }
}

async function toggleWant(poemId: string) {
  await props.store.toggleWantToRecite(poemId);
}

function formatLastRecitedAt(value?: string) {
  return value ? new Date(value).toLocaleString() : "暂无";
}
</script>

<template>
  <section class="page">
    <div class="card">
      <div class="section-head">
        <h3>诗库（{{ props.store.sortedPoems.value.length }}）</h3>
        <button class="icon-button" type="button" @click="showInput = !showInput">{{ showInput ? "-" : "+" }}</button>
      </div>

      <div v-if="canShowInput" class="grid input-panel">
        <div class="muted">示例："我已经会《登鹳雀楼》，接下来想学《游子吟》"</div>
        <div class="muted">示例："新增一首《饮酒》，作者陶渊明，内容是结庐在人境...，标签田园"</div>
        <textarea v-model="naturalInput" rows="6" placeholder="用自然语言描述你会背哪些、想学哪些，或新增/更新诗词" />
        <button :disabled="props.store.state.loading" @click="parsePreview">
          <span v-if="props.store.state.loading">生成中<span class="dot-loop"><span>.</span><span>.</span><span>.</span></span></span>
          <span v-else>让大模型先解析</span>
        </button>

        <div v-if="props.store.state.hasNluDraft" class="preview">
          <div class="title">解析预览</div>
          <div class="muted">{{ props.store.state.nluPreviewSummary }}</div>
          <pre>{{ props.store.state.nluPreviewActionsJson }}</pre>

          <div class="title">变更校验</div>
          <div class="muted">{{ props.store.state.nluChangeSummary }}</div>
          <pre>{{ props.store.state.nluChangeItemsJson }}</pre>

          <div class="actions">
            <button :disabled="props.store.state.loading" @click="confirmSave">
              <span v-if="props.store.state.loading">生成中<span class="dot-loop"><span>.</span><span>.</span><span>.</span></span></span>
              <span v-else>确认入库</span>
            </button>
            <button class="secondary" :disabled="props.store.state.loading" @click="props.store.clearNluDraft">取消</button>
          </div>
        </div>

        <div v-if="props.store.state.nluResult" class="muted">结果：{{ props.store.state.nluResult }}</div>
      </div>

      <div class="grid poem-list">
        <button
          v-for="poem in props.store.sortedPoems.value"
          :key="poem.id"
          class="item poem-card"
          type="button"
          @click="props.store.openPoemDetail(poem.id)"
        >
          <div class="title-row">
            <div class="title">{{ poem.title }} · {{ poem.author }}</div>
            <button
              v-if="poem.reciteCount === 0"
              class="want-button"
              type="button"
              :class="{ active: poem.wantToRecite }"
              :aria-pressed="poem.wantToRecite"
              :disabled="props.store.state.loading"
              @click.stop="toggleWant(poem.id)"
            >
              {{ poem.wantToRecite ? "已想背" : "想背" }}
            </button>
          </div>
          <div class="muted meta-line">
            <span>{{ poem.dynasty || "-" }}</span>
            <span>背诵次数 {{ poem.reciteCount }}</span>
            <span>浏览次数 {{ poem.viewCount }}</span>
            <span v-if="props.store.suggestedReviewIds.value.has(poem.id)" class="review-badge">建议复习</span>
          </div>
          <div class="muted">最近背诵时间 {{ formatLastRecitedAt(poem.lastRecitedAt) }}</div>
          <div class="muted poem-summary">{{ poem.content }}</div>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

h3 {
  margin: 0;
}

.icon-button {
  min-width: 42px;
  padding: 8px 12px;
  border-radius: 999px;
  background: #f7ebd8;
  color: var(--primary);
}

.input-panel {
  margin-bottom: 14px;
}

.poem-list {
  margin-top: 6px;
}

.item {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  background: #fffdfa;
}

.poem-card {
  width: 100%;
  text-align: left;
}

.preview {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  background: #fff5ea;
}

.preview pre {
  margin: 8px 0;
  max-height: 220px;
  overflow: auto;
  background: #fff;
  border-radius: 8px;
  padding: 8px;
  font-size: 12px;
}

.actions {
  display: flex;
  gap: 8px;
}

.title-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.title {
  font-weight: 700;
  margin-bottom: 6px;
}

.want-button {
  flex-shrink: 0;
  min-width: 68px;
  padding: 6px 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: #f7ebd8;
  color: var(--subtext);
  font-size: 13px;
}

.want-button.active {
  background: var(--primary);
  color: #fff;
  border-color: var(--primary);
}

.meta-line {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.review-badge {
  color: var(--primary);
  font-weight: 700;
}

.poem-summary {
  margin-top: 4px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
</style>

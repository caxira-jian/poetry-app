<script setup lang="ts">
import { ref } from "vue";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();

const naturalInput = ref("");
const expandedPoems = ref<Record<string, boolean>>({});

async function parsePreview() {
  await props.store.parseNaturalInputPreview(naturalInput.value);
}

async function confirmSave() {
  await props.store.confirmNaturalInput();
  if (!props.store.state.error) {
    naturalInput.value = "";
  }
}

function togglePoem(poemId: string) {
  expandedPoems.value[poemId] = !expandedPoems.value[poemId];
}

function isExpanded(poemId: string) {
  return Boolean(expandedPoems.value[poemId]);
}

function shouldShowToggle(content: string) {
  return content.length > 42 || content.includes("\n");
}
</script>

<template>
  <section class="page">
    <div class="card grid">
      <h3>诗库口语输入</h3>
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

    <div class="card">
      <h3>诗库（{{ props.store.state.poems.length }}）</h3>
      <div class="grid">
        <div v-for="poem in props.store.state.poems" :key="poem.id" class="item">
          <div class="title">{{ poem.title }} · {{ poem.author }}</div>
          <div class="muted">{{ poem.dynasty || "-" }} | 意向 {{ poem.learnIntent }} | 熟练度 {{ poem.masteryLevel }}</div>
          <div :class="['poem-content', { collapsed: !isExpanded(poem.id) }]" class="muted">
            {{ poem.content }}
          </div>
          <button
            v-if="shouldShowToggle(poem.content)"
            class="text-button"
            type="button"
            @click="togglePoem(poem.id)"
          >
            {{ isExpanded(poem.id) ? "收起" : "展开全文" }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.item {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  background: #fffdfa;
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

.title {
  font-weight: 700;
  margin-bottom: 6px;
}

.poem-content {
  margin-top: 4px;
  line-height: 1.8;
  white-space: pre-wrap;
  word-break: break-word;
}

.poem-content.collapsed {
  display: -webkit-box;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.text-button {
  margin-top: 6px;
  padding: 0;
  border: none;
  border-radius: 0;
  background: transparent;
  color: var(--primary);
  font-size: 13px;
  text-align: left;
}

h3 {
  margin: 0 0 8px;
}
</style>

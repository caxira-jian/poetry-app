<script setup lang="ts">
import { ref } from "vue";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();

const naturalInput = ref("");

async function parsePreview() {
  await props.store.parseNaturalInputPreview(naturalInput.value);
}

async function confirmSave() {
  await props.store.confirmNaturalInput();
  if (!props.store.state.error) {
    naturalInput.value = "";
  }
}
</script>

<template>
  <section class="page">
    <div class="card grid">
      <h3>背诵口语记录</h3>
      <div class="muted">示例："今天晚上我把静夜思背完了，状态熟练"</div>
      <div class="muted">示例："刚背了春晓，算完成，时间是今天 21:30"</div>
      <textarea v-model="naturalInput" rows="5" placeholder="用口语说出你刚背完哪首诗、状态和时间" />
      <button :disabled="props.store.state.loading" @click="parsePreview">{{ props.store.state.llmBusy ? "生成中..." : "让大模型先解析" }}</button>

      <div v-if="props.store.state.hasNluDraft" class="preview">
        <div class="title">解析预览</div>
        <div class="muted">{{ props.store.state.nluPreviewSummary }}</div>
        <pre>{{ props.store.state.nluPreviewActionsJson }}</pre>

        <div class="title">变更校验</div>
        <div class="muted">{{ props.store.state.nluChangeSummary }}</div>
        <pre>{{ props.store.state.nluChangeItemsJson }}</pre>

        <div class="actions">
          <button :disabled="props.store.state.loading" @click="confirmSave">确认入库</button>
          <button class="secondary" :disabled="props.store.state.loading" @click="props.store.clearNluDraft">取消</button>
        </div>
      </div>

      <div v-if="props.store.state.nluResult" class="muted">结果：{{ props.store.state.nluResult }}</div>
    </div>

    <div class="card">
      <h3>最近记录</h3>
      <div v-if="!props.store.state.reciteLogs.length" class="muted">暂无记录</div>
      <div v-else class="grid">
        <div v-for="log in props.store.state.reciteLogs.slice(0, 20)" :key="log.id" class="item">
          <div class="title">{{ log.titleSnapshot }} · {{ log.authorSnapshot }}</div>
          <div class="muted">{{ new Date(log.recitedAt).toLocaleString() }} · {{ log.status === "proficient" ? "熟练" : "完成" }}</div>
          <div v-if="log.note" class="muted">备注：{{ log.note }}</div>
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
  margin-bottom: 4px;
}

h3 {
  margin: 0 0 8px;
}
</style>

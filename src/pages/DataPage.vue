<script setup lang="ts">
import { ref } from "vue";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();

const importMode = ref<"merge" | "overwrite">("merge");
const importText = ref("");
const message = ref("");

async function initSeed(force: boolean) {
  const count = await props.store.ensureSeedPoems(force);
  message.value = count > 0 ? `已初始化 ${count} 首种子古诗` : "诗库已有数据，未初始化";
}

function exportJson() {
  const text = props.store.exportJson();
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `poetry-backup-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function importJson() {
  if (!importText.value.trim()) {
    props.store.state.error = "请粘贴 JSON 内容";
    return;
  }
  await props.store.importJson(importText.value, importMode.value);
  message.value = "导入完成";
}

async function loadFile(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) {
    return;
  }
  importText.value = await file.text();
}
</script>

<template>
  <section class="page">
    <div class="card grid">
      <h3>初始化诗库</h3>
      <button :disabled="props.store.state.loading" @click="initSeed(false)">初始化种子诗库（保留现有）</button>
      <button class="secondary" :disabled="props.store.state.loading" @click="initSeed(true)">重置并重建种子诗库</button>
    </div>

    <div class="card grid">
      <h3>导出 JSON</h3>
      <button :disabled="props.store.state.loading" @click="exportJson">导出全部数据</button>
    </div>

    <div class="card grid">
      <h3>导入 JSON</h3>
      <input type="file" accept="application/json" @change="loadFile" />
      <textarea v-model="importText" rows="8" placeholder="粘贴导入 JSON" />
      <select v-model="importMode">
        <option value="merge">合并导入</option>
        <option value="overwrite">覆盖导入</option>
      </select>
      <button :disabled="props.store.state.loading" @click="importJson">开始导入</button>
    </div>

    <div v-if="message" class="card muted">{{ message }}</div>
  </section>
</template>

<style scoped>
h3 {
  margin: 0 0 8px;
}
</style>

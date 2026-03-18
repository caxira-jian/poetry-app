<script setup lang="ts">
import ModelPage from "./ModelPage.vue";
import DataPage from "./DataPage.vue";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();
</script>

<template>
  <section class="page settings-page">
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

    <ModelPage :store="props.store" embedded />
    <DataPage :store="props.store" embedded />
  </section>
</template>

<style scoped>
.settings-page {
  display: grid;
  gap: 12px;
}

.item {
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px;
  background: #fffdfa;
}

.title {
  font-weight: 700;
  margin-bottom: 4px;
}

h3 {
  margin: 0 0 8px;
}
</style>

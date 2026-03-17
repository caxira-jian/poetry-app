<script setup lang="ts">
import { computed } from "vue";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();

const recommendationRows = computed(() => {
  return props.store.state.recommendation?.review.map((item) => {
    const poem = props.store.state.poems.find((candidate) => candidate.id === item.poemId);
    return {
      ...item,
      poem
    };
  }) || [];
});

const updatedAtText = computed(() => {
  return props.store.state.recommendationUpdatedAt
    ? new Date(props.store.state.recommendationUpdatedAt).toLocaleString()
    : "暂无";
});
</script>

<template>
  <section class="page">
    <div class="card">
      <h3>今日推荐</h3>
      <div class="muted info-row">推荐来源：{{ props.store.state.recommendation?.source || "rule-based" }}</div>
      <div class="muted info-row">更新日期：{{ updatedAtText }}</div>

      <div v-if="!recommendationRows.length" class="muted empty">暂无推荐</div>
      <div v-else class="grid recommendation-list">
        <button
          v-for="item in recommendationRows"
          :key="item.poemId"
          class="recommendation-item"
          type="button"
          @click="item.poem && props.store.openPoemDetail(item.poem.id)"
        >
          <div class="item-title">{{ item.poem ? `${item.poem.title} · ${item.poem.author}` : item.poemId }}</div>
          <div class="muted multiline">{{ item.reason }}</div>
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
h3 {
  margin: 0 0 10px;
}

.info-row {
  margin-bottom: 4px;
}

.empty {
  margin-top: 12px;
}

.recommendation-list {
  margin-top: 12px;
}

.recommendation-item {
  width: 100%;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fffdfa;
  text-align: left;
}

.item-title {
  font-weight: 700;
  margin-bottom: 6px;
}

.multiline {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

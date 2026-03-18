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

function openDetail(poemId?: string) {
  if (!poemId) {
    return;
  }
  props.store.openPoemDetail(poemId);
}
</script>

<template>
  <section class="page">
    <div class="card">
      <h3>今日推荐</h3>
      <div class="muted info-row">推荐来源：{{ props.store.state.recommendation?.source || "rule-based" }}</div>
      <div class="muted info-row">更新日期：{{ updatedAtText }}</div>

      <div v-if="!recommendationRows.length" class="muted empty">暂无推荐</div>
      <div v-else class="grid recommendation-list">
        <article
          v-for="item in recommendationRows"
          :key="item.poemId"
          class="recommendation-item"
          role="button"
          tabindex="0"
          @click="openDetail(item.poem?.id)"
          @keydown.enter="openDetail(item.poem?.id)"
          @keydown.space.prevent="openDetail(item.poem?.id)"
        >
          <div class="item-title">{{ item.poem ? `${item.poem.title} · ${item.poem.author}` : item.poemId }}</div>
          <div class="item-reason">{{ item.reason }}</div>
        </article>
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
  padding: 14px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fffdfa;
  text-align: left;
  color: var(--text);
  cursor: pointer;
}

.item-title {
  font-weight: 700;
  margin-bottom: 6px;
  color: var(--text);
}

.item-reason {
  color: var(--subtext);
  font-size: 14px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

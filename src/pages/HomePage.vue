<script setup lang="ts">
import { computed } from "vue";
import type { useAppStore } from "../useAppStore";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();

const poemMap = computed(() => {
  const map = new Map<string, string>();
  props.store.state.poems.forEach((poem) => {
    map.set(poem.id, `${poem.title} · ${poem.author}`);
  });
  return map;
});
</script>

<template>
  <section class="page">
    <div class="card grid">
      <div class="muted">推荐来源：{{ props.store.state.recommendation?.source || "rule-based" }}</div>
      <div class="muted">说明：进入首页后按规则自动更新今日推荐</div>
      <div v-if="props.store.state.recommendationDebug" class="muted multiline">{{ props.store.state.recommendationDebug }}</div>
      <div v-if="props.store.stats.value.total === 0" class="muted">当前诗库为空，请先到“数据”页初始化种子诗库。</div>
    </div>

    <div class="card">
      <h3>今日推荐</h3>
      <div v-if="!props.store.state.recommendation?.review.length" class="muted">暂无推荐</div>
      <ul v-else>
        <li v-for="item in props.store.state.recommendation.review" :key="item.poemId">
          {{ poemMap.get(item.poemId) || item.poemId }}
          <div class="muted multiline">{{ item.reason }}</div>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
h3 {
  margin: 0 0 8px;
}

ul {
  margin: 0;
  padding-left: 18px;
}

li {
  margin-bottom: 10px;
}

.multiline {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>

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

async function requestRecommendation() {
  await props.store.recommend();
}
</script>

<template>
  <section class="page">
    <div class="card grid">
      <div class="muted">推荐来源：{{ props.store.state.recommendation?.source || "尚未生成" }}</div>
      <div class="muted">API 模式：{{ props.store.state.apiMode === "default" ? "默认 API" : "自定义 API" }}</div>
      <div class="muted" v-if="props.store.state.apiMode === 'custom'">模型会话：{{ props.store.state.unlocked ? "已解锁" : "已锁定" }}</div>
      <div v-if="props.store.state.recommendationDebug" class="muted">说明：{{ props.store.state.recommendationDebug }}</div>
      <div v-if="props.store.stats.value.total === 0" class="muted">当前诗库为空，请先到“数据”页初始化种子诗库。</div>
      <button :disabled="props.store.state.loading" @click="requestRecommendation">
        <span v-if="props.store.state.loading">生成中<span class="dot-loop"><span>.</span><span>.</span><span>.</span></span></span>
        <span v-else>生成今日推荐</span>
      </button>
    </div>

    <div class="card">
      <h3>复习建议</h3>
      <div v-if="!props.store.state.recommendation?.review.length" class="muted">暂无复习建议</div>
      <ul v-else>
        <li v-for="item in props.store.state.recommendation.review" :key="item.poemId">
          {{ poemMap.get(item.poemId) || item.poemId }}
          <div class="muted">{{ item.reason }}</div>
        </li>
      </ul>
    </div>

    <div class="card">
      <h3>新学习建议</h3>
      <div v-if="!props.store.state.recommendation?.newLearning.length" class="muted">暂无新学习建议</div>
      <ul v-else>
        <li v-for="item in props.store.state.recommendation.newLearning" :key="item.poemId">
          {{ poemMap.get(item.poemId) || item.poemId }}
          <div class="muted">{{ item.reason }}</div>
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
  margin-bottom: 8px;
}
</style>

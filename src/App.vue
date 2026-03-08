<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import HomePage from "./pages/HomePage.vue";
import LibraryPage from "./pages/LibraryPage.vue";
import RecitePage from "./pages/RecitePage.vue";
import ModelPage from "./pages/ModelPage.vue";
import DataPage from "./pages/DataPage.vue";
import { useAppStore } from "./useAppStore";

const store = useAppStore();

const tabs = [
  { id: "home", label: "今日" },
  { id: "library", label: "诗库" },
  { id: "recite", label: "记录" },
  { id: "model", label: "模型" },
  { id: "data", label: "数据" }
] as const;

type TabId = (typeof tabs)[number]["id"];
const current = ref<TabId>("home");

const pageComponent = computed(() => {
  switch (current.value) {
    case "library":
      return LibraryPage;
    case "recite":
      return RecitePage;
    case "model":
      return ModelPage;
    case "data":
      return DataPage;
    default:
      return HomePage;
  }
});

onMounted(() => {
  void store.init();
});
</script>

<template>
  <div class="app-shell">
    <header class="header">
      <h1>古诗背诵助手</h1>
      <div class="muted">总诗词 {{ store.stats.value.total }} · 熟练 {{ store.stats.value.proficientCount }} · 记录 {{ store.stats.value.logs }}</div>
    </header>

    <main>
      <div v-if="store.state.error" class="error">{{ store.state.error }}</div>
      <div v-if="store.state.llmBusy" class="busy">生成中：{{ store.state.llmTask || "请稍候" }}<span class="dot-loop"><span>.</span><span>.</span><span>.</span></span></div>
      <component :is="pageComponent" :store="store" />
    </main>

    <nav class="tabbar">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        :class="{ active: current === tab.id }"
        @click="current = tab.id"
      >
        {{ tab.label }}
      </button>
    </nav>
  </div>
</template>

<style scoped>
.app-shell {
  max-width: 560px;
  margin: 0 auto;
  padding: 10px 12px 0;
  min-height: 100vh;
}

.header {
  position: sticky;
  top: 0;
  z-index: 10;
  backdrop-filter: blur(8px);
  padding: 10px 4px 8px;
}

h1 {
  margin: 0;
  font-size: 24px;
}

main {
  margin-top: 8px;
}

.error {
  margin-bottom: 10px;
  background: #f6c3b7;
  color: #511800;
  border: 1px solid #df9b89;
  border-radius: 12px;
  padding: 8px 10px;
}

.busy {
  margin-bottom: 10px;
  background: #f0e2c9;
  color: #5b3d1f;
  border: 1px solid #d5bb93;
  border-radius: 12px;
  padding: 8px 10px;
}

.tabbar {
  position: fixed;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  width: min(560px, calc(100vw - 24px));
  background: #fff7ed;
  border: 1px solid var(--border);
  border-radius: 14px;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 6px;
}

.tabbar button {
  background: transparent;
  color: #5e4e42;
  padding: 8px 2px;
  font-size: 14px;
}

.tabbar button.active {
  background: var(--primary);
  color: #fff;
}
</style>


<script setup lang="ts">
import { reactive } from "vue";
import type { ProviderConfig } from "../types";
import type { useAppStore } from "../useAppStore";
import { providerLabel } from "../services/llmProviders";

const props = defineProps<{ store: ReturnType<typeof useAppStore> }>();

const passwordInput = reactive({
  init: "",
  unlock: ""
});

const keyInput = reactive<Record<string, string>>({});

async function initPassword() {
  if (!passwordInput.init.trim()) {
    props.store.state.error = "请输入主密码";
    return;
  }
  await props.store.setMasterPassword(passwordInput.init.trim(), props.store.state.rememberBrowserForDay);
  passwordInput.init = "";
}

async function unlock() {
  if (!passwordInput.unlock.trim()) {
    props.store.state.error = "请输入主密码";
    return;
  }
  const ok = await props.store.unlock(passwordInput.unlock.trim(), props.store.state.rememberBrowserForDay);
  if (ok) {
    passwordInput.unlock = "";
  }
}

async function saveConfig(config: ProviderConfig) {
  await props.store.saveProviderConfig({
    ...config,
    plainApiKey: keyInput[config.provider]
  });
  keyInput[config.provider] = "";
}

async function testConfig(config: ProviderConfig) {
  await saveConfig(config);
  await props.store.testProvider(config.provider);
}
</script>

<template>
  <section class="page">
    <div class="card grid">
      <h3>主密码</h3>
      <div class="muted">状态：{{ props.store.state.unlocked ? "已解锁" : "已锁定" }}</div>
      <label class="row">
        <input
          type="checkbox"
          :checked="props.store.state.rememberBrowserForDay"
          @change="props.store.setRememberBrowserForDay(($event.target as HTMLInputElement).checked)"
        />
        <span>记住此浏览器 1 天（减少重复输入）</span>
      </label>
      <div class="muted">需要重新输入密码的场景：首次访问、手动锁定并清除记住、超过 1 天、清理浏览器存储。</div>

      <template v-if="!props.store.state.hasMasterPassword">
        <input v-model="passwordInput.init" type="password" placeholder="初始化主密码" />
        <button :disabled="props.store.state.loading" @click="initPassword">设置主密码</button>
      </template>

      <template v-else>
        <input v-model="passwordInput.unlock" type="password" placeholder="输入主密码解锁" />
        <button :disabled="props.store.state.loading" @click="unlock">解锁</button>
        <button class="secondary" @click="props.store.lock(false)">锁定（保留1天记住）</button>
        <button class="secondary" @click="props.store.lock(true)">锁定并清除记住</button>
      </template>
    </div>

    <div class="card">
      <h3>模型配置</h3>
      <div class="grid">
        <div v-for="config in props.store.state.providerConfigs" :key="config.provider" class="item grid">
          <div class="title">{{ providerLabel[config.provider] }}</div>
          <input :value="config.baseUrl" @input="config.baseUrl = ($event.target as HTMLInputElement).value" placeholder="Base URL" />
          <input :value="config.model" @input="config.model = ($event.target as HTMLInputElement).value" placeholder="Model" />
          <input
            type="number"
            min="0"
            max="1"
            step="0.1"
            :value="config.temperature"
            @input="config.temperature = Number(($event.target as HTMLInputElement).value || 0.3)"
          />
          <input
            type="text"
            :placeholder="`输入 ${providerLabel[config.provider]} API Key（留空则保持不变）`"
            :value="keyInput[config.provider] || ''"
            @input="keyInput[config.provider] = ($event.target as HTMLInputElement).value"
          />
          <label class="row">
            <input type="checkbox" :checked="config.enabled" @change="config.enabled = ($event.target as HTMLInputElement).checked" />
            <span>启用为推荐来源</span>
          </label>
          <div class="actions">
            <button :disabled="props.store.state.loading || !props.store.state.unlocked" @click="saveConfig(config)">保存配置</button>
            <button class="secondary" :disabled="props.store.state.loading || !props.store.state.unlocked" @click="testConfig(config)">测试连接</button>
          </div>
        </div>
      </div>
      <div class="muted">提示：仅在解锁后可保存 API Key。</div>
      <div v-if="props.store.state.providerTestResult" class="result">
        {{ props.store.state.providerTestResult }}
      </div>
    </div>
  </section>
</template>

<style scoped>
.item {
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #fffdfa;
  padding: 10px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.row input {
  width: auto;
}

.actions {
  display: flex;
  gap: 8px;
}

.title {
  font-weight: 700;
}

.result {
  margin-top: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 8px;
  background: #fff5ea;
  color: #4e2f11;
  white-space: pre-wrap;
  word-break: break-word;
}

h3 {
  margin: 0 0 8px;
}
</style>

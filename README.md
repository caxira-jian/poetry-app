# 古诗背诵助手 V1

移动优先的离线 Web 应用，支持本地诗库管理、背诵记录、LLM 推荐（千问/DeepSeek/GLM）以及 JSON 导入导出。

## 核心能力

- IndexedDB 本地持久化
- 事件日志 + 快照状态
- 主密码解锁后本地加密存储 API Key
- 支持默认 API 兜底 + 用户自定义 API
- 默认 API 走服务端代理（访客可直接用，前端不暴露 key）
- 支持 OpenAI-compatible 默认 API（`provider=custom`）
- LLM 推荐，失败时降级为待复习列表
- PWA 配置（可添加到主屏）

## 开发

```bash
npm install
npm run dev
```

## 测试

```bash
npm run test
```

## 构建

```bash
npm run build
```

## 默认 API 配置（可注释切换）

- `.env.local` / Vercel 环境变量分两类：
  - 客户端非敏感：`VITE_DEFAULT_*`（展示与模式元信息）
  - 服务端敏感：`DEFAULT_API_*`（真正调用上游时用，尤其 `DEFAULT_API_KEY`）
- 默认 API 使用服务端路由 `/api/llm` 代理请求，访客访问页面时不会拿到明文 key。
- 你可以在模板里注释掉一种产品、换另一种模型。

## Vercel 上线（访客直用且不暴露 key）

1. 在 Vercel 项目 `Settings -> Environment Variables` 配置：
   - `VITE_DEFAULT_API_PROVIDER`
   - `VITE_DEFAULT_API_BASE_URL`
   - `VITE_DEFAULT_API_MODEL`
   - `VITE_DEFAULT_API_TEMPERATURE`
   - `DEFAULT_API_PROVIDER`
   - `DEFAULT_API_BASE_URL`
   - `DEFAULT_API_MODEL`
   - `DEFAULT_API_KEY`（敏感）
   - `DEFAULT_API_TEMPERATURE`
2. Redeploy 最新版本。
3. 前端选择“默认 API 兜底”后，访客即可直接使用。

## 部署到 Vercel

1. 代码推送到 GitHub 仓库。
2. 登录 [Vercel](https://vercel.com/)，使用 GitHub 账号授权。
3. 在 Vercel 点击 `Add New Project`，导入该仓库。
4. 构建配置保持默认即可（仓库内已提供 `vercel.json`）：
   - Build Command: `npm run build`
   - Output Directory: `dist`
5. 点击 `Deploy` 完成首次发布。
6. 后续每次 push 到默认分支，Vercel 会自动构建并更新。

## 数据导入导出格式

导出 JSON 为：

- `version`
- `exportedAt`
- `poems`
- `reciteLogs`
- `providerConfigs`

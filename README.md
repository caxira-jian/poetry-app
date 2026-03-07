# 古诗背诵助手 V1

移动优先的离线 Web 应用，支持本地诗库管理、背诵记录、LLM 推荐（千问/DeepSeek/GLM）以及 JSON 导入导出。

## 核心能力

- IndexedDB 本地持久化
- 事件日志 + 快照状态
- 主密码解锁后本地加密存储 API Key
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

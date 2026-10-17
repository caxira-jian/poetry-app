import { defineConfig, loadEnv } from "vite";
import type { Connect, Plugin, ViteDevServer } from "vite";
import vue from "@vitejs/plugin-vue";
import { VitePWA } from "vite-plugin-pwa";
import type { IncomingMessage, ServerResponse } from "node:http";

type LlmHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>;

// 本地开发时把 /api/llm 挂到 Vite dev server 上，直接复用 api/llm.ts（Vercel Function），
// 这样 `npm run dev` 也能调试默认 API 代理，不必额外起 vercel dev。
// 注意：`npm run preview` 走的是静态产物，没有这个中间件，默认 API 仍只在 dev 下可用。
function localLlmApi(): Plugin {
  const mount = (middlewares: Connect.Server, loadHandler: () => Promise<LlmHandler>) => {
    middlewares.use("/api/llm", (req, res) => {
      void (async () => {
        try {
          const handler = await loadHandler();
          await handler(req, res);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json; charset=utf-8");
          res.end(JSON.stringify({ error: `Local /api/llm failed: ${message}` }));
        }
      })();
    });
  };

  return {
    name: "local-llm-api",
    apply: "serve",
    configureServer(server: ViteDevServer) {
      mount(server.middlewares, async () => {
        const mod = (await server.ssrLoadModule("/api/llm.ts")) as { default: LlmHandler };
        return mod.default;
      });
    }
  };
}

export default defineConfig(({ mode }) => {
  // 把 .env / .env.local 里的变量（尤其是服务端敏感变量 DEFAULT_API_*）注入 dev server 进程，
  // 让 api/llm.ts 在本地读到和 Vercel 上一致的环境变量。
  // 这些变量只留在 Node 进程里，不会通过 import.meta.env 暴露给浏览器。
  const serverEnv = loadEnv(mode, process.cwd(), "");
  for (const [key, value] of Object.entries(serverEnv)) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return {
    plugins: [
      vue(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.svg"],
        manifest: {
          name: "古诗背诵助手",
          short_name: "背诗",
          start_url: "/",
          display: "standalone",
          background_color: "#f6efe5",
          theme_color: "#222222",
          icons: [
            {
              src: "favicon.svg",
              sizes: "any",
              type: "image/svg+xml",
              purpose: "any"
            }
          ]
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico}"]
        }
      }),
      localLlmApi()
    ]
  };
});

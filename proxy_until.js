/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 20:38:12
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-15 11:35:58
 * @FilePath: /MLC_React/src/api/proxy_until.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 * 
 * Vite 开发环境诊断接口与 DNS 代理，由 vite.config.js 显式加载。
 * COSR跨域问题解决： https://blog.csdn.net/lph159/article/details/141629994
 */

import { createRequire } from "node:module";

// 保留 CommonJS 服务端工具边界，避免原生命令处理器进入浏览器 bundle。
const require = createRequire(import.meta.url);

// 仅迁入检测页实际使用的 DoH 服务；现有 /api 和业务代理仍由 Vite 配置维护。
export const domainDetectProxy = {
  "/dns.alidns": {
    target: "https://dns.alidns.com",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/dns\.alidns/, ""),
  },
  "/dns.google": {
    target: "https://dns.google",
    changeOrigin: true,
    rewrite: (path) => path.replace(/^\/dns\.google/, ""),
  },
};

/**
 * 在 Vite 通用 /api 代理之前注册精确诊断路由，仅开发环境生效。
 * 请求时才加载工具，不在启动 Vite 时安装 mtr；生产部署需另行运行 mtrApiServer.cjs。
 * 探测从开发机发出，开发端口应仅向可信网络开放。
 */
export default function domainDetectMiddleware() {
  return {
    name: "domain-detect-api",
    configureServer(server) {
      // CommonJS handler 不在 Vite 模块图中；文件变化时显式清理缓存，下一次请求加载新代码。
      // 仅修改时失效，保留正常请求间的命令路径缓存，避免每次请求重新初始化工具。
      const handlerPaths = [
        require.resolve("./src/manager_antd/page_modules/domain_module/mtr_tool/mtrServerHandler.cjs"),
        require.resolve("./src/manager_antd/page_modules/domain_module/traceroute_tool/tracerouteServerHandler.cjs"),
      ];
      const invalidateHandler = (file) => {
        if (handlerPaths.includes(file)) delete require.cache[file];
      };
      server.watcher.add(handlerPaths);
      server.watcher.on("change", invalidateHandler);
      server.httpServer?.once("close", () => {
        server.watcher.off("change", invalidateHandler);
      });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url, "http://localhost");
        if (!["/api/mtr", "/api/traceroute"].includes(url.pathname)) {
          return next();
        }

        res.setHeader("Content-Type", "application/json; charset=utf-8");
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.setHeader("Allow", "GET");
          res.end(JSON.stringify({ ok: false, error: "Method Not Allowed" }));
          return;
        }

        try {
          // 两个 handler 均返回可序列化报告；保留原有 ok/text/error 接口契约。
          const target = url.searchParams.get("target");
          const result = url.pathname === "/api/mtr"
            ? await require("./src/manager_antd/page_modules/domain_module/mtr_tool/mtrServerHandler.cjs").runMTR({
                target,
                count: url.searchParams.get("count"),
              })
            : await require("./src/manager_antd/page_modules/domain_module/traceroute_tool/tracerouteServerHandler.cjs").runTraceroute({
                target,
                maxHops: url.searchParams.get("maxHops"),
                timeout: url.searchParams.get("timeout"),
              });
          res.end(JSON.stringify({ ok: true, ...result }));
        } catch (error) {
          res.statusCode = 500;
          res.end(JSON.stringify({ ok: false, error: error?.stderr || error?.message || "诊断失败" }));
        }
      });
    },
  };
}

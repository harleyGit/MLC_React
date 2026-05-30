/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 09:31:27
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-18 11:00:00
 * @FilePath: /MLC_React/vite.config.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 *
 * Vite: 本地代理
 */
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      // 代理阿里 DNS,为了nslookup
      "/dns.alidns": {
        target: "https://dns.alidns.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dns\.alidns/, ""),
      },

      // 公网IP信息获取
      "/ipai": {
        target: "https://ipapi.co/json",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ipai/, ""),
      },

      // 后端上传文件静态资源
      "/uploads": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },

      // 后端新版 API 路径
      "/api/v1": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },

      // 其他 /api 调用（保留）
      "/api": {
        target: "https://itango.tencent.com/out/itango/myip",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },

      // 历史路径（兼容）
      "/auth": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },

      "/user": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },

      "/profile": {
        target: "http://localhost:8080",
        changeOrigin: true,
      },
    },
  },
});

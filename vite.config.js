/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 09:31:27
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-25 22:53:21
 * @FilePath: /MLC_React/vite.config.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 *
 * Vite: 本地代理
 */
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";
// import { viteLogo } from '/vite.svg';

// https://vite.dev/config/
export default defineConfig({
  base: "./", // 添加这一行
  plugins: [react()],
  server: {
    proxy: {
      // 代理阿里 DNS,为了nslookup
      "/dns.alidns": {
        target: "https://dns.alidns.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dns\.alidns/, ""), // 去掉前缀
      },

      // 公网IP信息获取
      "/ipai": {
        target: "https://ipapi.co/json",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/ipai/, ""), // 去掉前缀
      },

      // 代理本地接口
      "/api": {
        target: "https://itango.tencent.com/out/itango/myip",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""), // 去掉 /api
      },
    },
  },
});

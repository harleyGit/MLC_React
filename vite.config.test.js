import assert from "node:assert/strict";
import test from "node:test";
import config from "./vite.config.js";

test("资料页直达请求不被代理，资料 API 仍由后端处理", () => {
  const proxy = config.server.proxy;
  const pagePaths = [
    "/profile",
    "/profile/edit",
    "/profile/user/HGUSR_TW_01M02NDG1231CAKHHC6YGC277V/edit-role",
  ];

  // Vite 的普通代理前缀会优先拦截页面请求，导致浏览器刷新拿不到 SPA 入口。
  for (const pagePath of pagePaths) {
    assert.deepEqual(Object.keys(proxy).filter((prefix) => pagePath.startsWith(prefix)), []);
  }
  assert.equal(proxy["/api/v1"].target, "http://localhost:8080");
});

test("BrowserRouter 的多级路径使用根路径加载构建资源", () => {
  assert.equal(config.base, "/");
});

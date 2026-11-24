import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

/** 只替换网络、时钟与导航，不使用真实用户令牌或服务端。 */
function hgFixture({ expired = false, refresh = true } = {}) {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_auth_guard.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_auth_guard.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const hgListeners = new Map(); // 同一页面注册的浏览器事件。
  const hgTimers = new Map(); // 回调 -> 到期延迟；手动触发，不等候真实的 15 分钟。
  const hgStorage = new Map(refresh ? [["refresh_token", "refresh-fixture"]] : []);
  let hgExpiry = expired ? 0 : Date.now() + 60_000; // 当前 access 到期毫秒；0 表示已过期。
  let hgRenew = () => Promise.resolve(); // 续签结果由每个用例设定。
  let hgCalls = 0; // 权威续签调用次数。
  const hgWindow = {
    addEventListener: (name, listener) => hgListeners.set(name, listener),
    removeEventListener: (name) => hgListeners.delete(name),
    location: { pathname: "/home", search: "" },
  };
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports, React, Promise, Date,
    require: (id) => {
      if (id === "react") return React;
      if (id === "react-router-dom") return { Navigate: () => null, Link: () => null };
      if (id.endsWith("HttpManagerV1")) return { __esModule: true, default: {
        ensureFreshToken: () => { hgCalls++; return hgRenew(); },
      } };
      if (id.endsWith("hg_iam_session")) return { hgCurrentIAMExpiry: () => hgExpiry };
      if (id.endsWith("hg_router_path")) return { ROUTE_PATH: { LOGIN: "/login", WALLET_RECHARGE: "/recharge" } };
      if (id.endsWith("hg_auth")) return {
        REFRESH_TOKEN_KEY: "refresh_token", isAuthenticated: () => hgExpiry > Date.now(),
      };
      throw new Error(`未预期依赖: ${id}`);
    },
    localStorage: { getItem: (key) => hgStorage.get(key) ?? null },
    window: hgWindow,
    setTimeout: (callback, delay) => { hgTimers.set(callback, delay); return callback; },
    clearTimeout: (callback) => hgTimers.delete(callback),
  });
  const hgGuard = new hgModule.exports.default({ children: React.createElement("div") });
  hgGuard.setState = (next) => { hgGuard.state = { ...hgGuard.state, ...next }; };
  return {
    guard: hgGuard, listeners: hgListeners, timers: hgTimers, storage: hgStorage,
    calls: () => hgCalls,
    setExpiry: (value) => { hgExpiry = value; },
    setRenew: (handler) => { hgRenew = handler; },
  };
}

const hgFlush = () => new Promise((resolve) => setImmediate(resolve));

test("已过期 access 在刷新页面时先续签，不把仍有效的 refresh 会话踢到登录页", async () => {
  const hg = hgFixture({ expired: true });
  assert.equal(hg.guard.render().props.role, "status");
  hg.setRenew(async () => { hg.setExpiry(Date.now() + 60_000); });
  hg.guard.componentDidMount();
  await hgFlush();
  assert.equal(hg.calls(), 1);
  assert.equal(hg.guard.render().type, "div");
  assert.equal(hg.timers.size, 1);
  hg.guard.componentWillUnmount();
});

test("页面空闲时在 access 到期前续签；临时网络故障后保留手动重试入口", async () => {
  const hg = hgFixture();
  hg.guard.componentDidMount();
  assert.equal(hg.timers.size, 1);
  const [timer] = hg.timers.keys();
  hg.setRenew(async () => { throw new Error("网络暂不可用"); });
  hg.timers.delete(timer);
  timer();
  await hgFlush();
  assert.equal(hg.calls(), 1);
  hg.setExpiry(0);
  const [expiryTimer] = hg.timers.keys();
  hg.timers.delete(expiryTimer);
  expiryTimer();
  await hgFlush();
  assert.equal(hg.guard.render().props.role, "alert");
  assert.equal(hg.guard.render().props.children[2].props.to, "/login");
  hg.setRenew(async () => { hg.setExpiry(Date.now() + 60_000); });
  await hg.guard.hgRenewSession();
  assert.equal(hg.guard.render().type, "div");
  hg.guard.componentWillUnmount();
});

test("没有 refresh token 的过期会话仍进入登录页，卸载后不保留计时器", () => {
  const hg = hgFixture({ expired: true, refresh: false });
  hg.guard.componentDidMount();
  assert.equal(hg.guard.render().props.to, "/login");
  hg.guard.componentWillUnmount();
  assert.equal(hg.timers.size, 0);
  assert.equal(hg.listeners.size, 0);
});

test("其他标签页退出后立刻取消旧计时并跳转登录，不沿用旧账号内容", () => {
  const hg = hgFixture();
  hg.guard.componentDidMount();
  hg.storage.delete("refresh_token");
  hg.setExpiry(0);
  hg.listeners.get("storage")({ key: "manager_token" });
  assert.equal(hg.guard.render().props.to, "/login");
  assert.equal(hg.timers.size, 0);
  hg.guard.componentWillUnmount();
});

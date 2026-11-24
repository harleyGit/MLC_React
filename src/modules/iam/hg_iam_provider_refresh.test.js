import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

/** 测试 Provider 的重复刷新边界；所有请求和浏览器事件均使用替身。 */
function hgFixture() {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_iam_provider.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_iam_provider.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const hgListeners = new Map(); // 仅记录当前 Provider 注册的事件；没有真实窗口。
  const hgEvents = []; // 本人通知提示发给消息中心的事件，不携带通知正文。
  const hgWindow = {
    addEventListener: (name, callback) => { hgListeners.set(name, callback); },
    removeEventListener: (name) => { hgListeners.delete(name); },
    dispatchEvent: (event) => { hgEvents.push(event); },
  };
  let hgFetchCount = 0; // 本轮向权威接口发起的请求次数。
  const hgRequestModes = []; // false 为 /me/access，true 为 /me/sync。
  const hgResolves = []; // 逐个控制异步响应，验证变更通知在首个请求后补拉。
  let hgOwner = "operator-a"; // 模拟当前登录账号；切换后旧响应不得覆盖新账号。
  let hgRealtimeStarts = 0; // 同一账号 503 后不应在下一次权限复核时再次申请频道票据。
  let hgRealtimeFailure = false; // true 模拟未启用 IM 的旧环境。
  let hgRealtimeInstance = null; // 测试触发的当前账号 Socket 回调。
  let hgLocalSnapshot = null; // 已按账号隔离且未过期的 IndexedDB 展示副本；null 表示缓存未命中。
  let hgPushedSnapshot = null; // 已通过本人频道更新的展示快照；null 表示尚未收到有效消息。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    require: (id) => {
      if (id === "react") return React;
      if (id.endsWith("hg_iam_session")) return {
        hgClearIAM: () => {}, hgGetIAMSnapshot: () => hgPushedSnapshot,
        hgLoadLocalIAM: async () => hgLocalSnapshot?.user_id === hgOwner ? hgLocalSnapshot : null,
        hgCurrentIAMUser: () => hgOwner,
        hgCurrentIAMExpiry: () => Date.now() + 3_600_000,
        hgApplyPushedIAM: async (snapshot) => {
          if (snapshot?.user_id !== hgOwner) return false;
          hgPushedSnapshot = snapshot;
          return true;
        },
        hgRefreshIAM: ({ sync } = {}) => {
          hgFetchCount += 1;
          hgRequestModes.push(sync);
          return new Promise((resolve) => { hgResolves.push(resolve); });
        },
        hgSubscribeIAM: () => () => {},
      };
      if (id.endsWith("hg_business_realtime")) return { __esModule: true,
        hgValidBusinessEventType: (eventType) => typeof eventType === "string" && eventType.endsWith(".v1"),
        default: class {
        constructor(owner, recover, offline) {
          hgRealtimeInstance = { owner, recover, offline, handlers: new Map() };
        }
        hgListen(eventType, callback) {
          hgRealtimeInstance.handlers.set(eventType, callback);
          return () => hgRealtimeInstance.handlers.delete(eventType);
        }
        hgStart() {
          hgRealtimeStarts += 1;
          return hgRealtimeFailure ? Promise.reject({ status: 503 }) : Promise.resolve();
        }
        hgClose() {}
      } };
      throw new Error(`未预期的依赖: ${id}`);
    },
    window: hgWindow, clearTimeout, setTimeout,
    CustomEvent: class { constructor(type, options = {}) { this.type = type; this.detail = options.detail; } },
  });
  const hgProvider = new hgModule.exports.HGIAMAccessProvider({});
  hgProvider.setState = (next) => {
    hgProvider.state = { ...hgProvider.state, ...next };
  };
  return {
    provider: hgProvider, listeners: hgListeners,
    fetchCount: () => hgFetchCount,
    requestModes: () => hgRequestModes,
    realtimeStarts: () => hgRealtimeStarts,
    realtimeUnavailable: () => { hgRealtimeFailure = true; },
    setLocalSnapshot: (snapshot) => { hgLocalSnapshot = snapshot; },
    realtime: () => hgRealtimeInstance,
    events: () => hgEvents,
    switchOwner: (owner) => { hgOwner = owner; },
    resolve: (value) => hgResolves.shift()(value),
  };
}

const hgFlush = () => new Promise((resolve) => setImmediate(resolve));

test("窗口获焦不触发权限拉取，同一账号并发变更仅复核一次", async () => {
  const hg = hgFixture();
  hg.provider.componentDidMount();
  await hgFlush();
  assert.equal(hg.fetchCount(), 1);
  assert.equal(hg.listeners.has("focus"), false);
  const hgFirst = hg.provider.hgRefresh();
  const hgSecond = hg.provider.hgRefresh();
  await hgFlush();
  assert.equal(hg.fetchCount(), 1);
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await Promise.all([hgFirst, hgSecond]);
  hg.provider.componentWillUnmount();
});

test("通知提示只由当前账号传播，重连不请求 IAM 快照", async () => {
  const hg = hgFixture();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  const original = hg.realtime();
  original.handlers.get("notification.inbox.updated.v1")({ category: "marketing" });
  assert.equal(hg.events().at(-1)?.type, "hg:notification-changed");
  assert.equal(hg.events().at(-1)?.detail?.category, "marketing");
  original.recover();
  await hgFlush();
  assert.equal(hg.fetchCount(), 1);
  assert.deepEqual(hg.requestModes(), [false]);
  assert.equal(hg.events().at(-1)?.detail, undefined);
  const beforeSwitch = hg.events().length;
  hg.switchOwner("operator-b");
  original.handlers.get("notification.inbox.updated.v1")({ category: "system" });
  assert.equal(hg.events().length, beforeSwitch);
  hg.provider.componentWillUnmount();
});

test("实时频道断线和恢复均保留最近快照，不触发 IAM 请求", async () => {
  const hg = hgFixture();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 120_000).toISOString() });
  await hgFlush();
  const latest = hg.provider.state.snapshot;
  hg.realtime().offline();
  await hgFlush();
  assert.equal(hg.provider.state.status, "ready");
  assert.equal(hg.provider.state.snapshot, latest);
  hg.realtime().recover();
  await hgFlush();
  assert.equal(hg.provider.state.snapshot, latest);
  assert.deepEqual(hg.requestModes(), [false]);
  hg.provider.componentWillUnmount();
});

test("Socket 恢复后仅收到本人新快照消息才更新展示", async () => {
  const hg = hgFixture();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 120_000).toISOString() });
  await hgFlush();
  hg.realtime().offline();
  hg.realtime().recover();
  const pushed = { user_id: "operator-a", roles: ["editor"], grants: [], policy_version: 2,
    expires_at: "2099-01-01T00:00:00Z" };
  hg.realtime().handlers.get("iam.access.updated.v1")({ snapshot: pushed });
  await hgFlush();
  assert.equal(hg.provider.state.snapshot, pushed);
  assert.deepEqual(hg.requestModes(), [false]);
  hg.provider.componentWillUnmount();
});

test("后续业务复用当前用户 Socket，旧账号提示不可投递到新账号", async () => {
  const hg = hgFixture();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 120_000).toISOString() });
  await hgFlush();
  let delivered = 0; // 收到的本账号业务提示数量，不使用推送内容更新权威状态。
  const stop = hg.provider.hgSubscribeBusinessEvent("wallet.balance.changed.v1", () => { delivered++; });
  const previous = hg.realtime();
  assert.equal(hg.realtimeStarts(), 1, "登记新业务不得新开连接");
  previous.handlers.get("wallet.balance.changed.v1")({});
  assert.equal(delivered, 1);
  hg.switchOwner("operator-b");
  previous.handlers.get("wallet.balance.changed.v1")({});
  assert.equal(delivered, 1, "账号变化后旧业务事件必须失效");
  hg.listeners.get("hg:auth-changed")();
  await hgFlush();
  hg.resolve({ user_id: "operator-b", grants: [], expires_at: new Date(Date.now() + 120_000).toISOString() });
  await hgFlush();
  assert.equal(hg.realtimeStarts(), 2);
  assert.equal(hg.realtime().handlers.has("wallet.balance.changed.v1"), false);
  stop();
  hg.provider.componentWillUnmount();
});

test("IM 返回 503 后保留最近快照，不主动补拉", async () => {
  const hg = hgFixture();
  hg.realtimeUnavailable();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  assert.equal(hg.realtimeStarts(), 1);
  assert.deepEqual(hg.requestModes(), [false]);
  assert.equal(hg.provider.state.status, "ready");
  assert.equal(hg.provider.state.snapshot.user_id, "operator-a");
  hg.provider.componentWillUnmount();
});

test("冷启动使用本人未过期缓存，无需重新请求授权快照", async () => {
  const hg = hgFixture();
  hg.realtimeUnavailable();
  hg.setLocalSnapshot({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  hg.provider.componentDidMount();
  await hgFlush();
  assert.equal(hg.provider.state.status, "ready");
  assert.equal(hg.provider.state.snapshot.user_id, "operator-a");
  assert.deepEqual(hg.requestModes(), []);
  assert.equal(hg.realtimeStarts(), 1);
  hg.provider.componentWillUnmount();
});

test("IM 不可用且快照到期时仅补拉一次 /me/access，二次到期本地失效", async () => {
  const hg = hgFixture();
  hg.realtimeUnavailable();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  hg.provider.hgScheduleExpiry({ user_id: "operator-a", expires_at: new Date(Date.now() - 1).toISOString() });
  await hgFlush();
  assert.deepEqual(hg.requestModes(), [false, false]);
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  hg.provider.hgScheduleExpiry({ user_id: "operator-a", expires_at: new Date(Date.now() - 1).toISOString() });
  await hgFlush();
  assert.deepEqual(hg.requestModes(), [false, false]);
  assert.equal(hg.provider.state.status, "error");
  assert.equal(hg.provider.state.snapshot, null);
  hg.provider.componentWillUnmount();
});

test("请求进行期间收到登录变更时，首个响应后必须再次请求", async () => {
  const hg = hgFixture();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.listeners.get("hg:auth-changed")();
  hg.listeners.get("hg:auth-changed")();
  assert.equal(hg.fetchCount(), 1);
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  assert.equal(hg.fetchCount(), 2);
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  hg.provider.componentWillUnmount();
});

test("账号切换立即发起新请求，旧账号的延迟响应不可覆盖", async () => {
  const hg = hgFixture();
  hg.provider.componentDidMount();
  await hgFlush();
  hg.switchOwner("operator-b");
  hg.listeners.get("hg:auth-changed")();
  await hgFlush();
  assert.equal(hg.fetchCount(), 2);
  hg.resolve({ user_id: "operator-a", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  assert.equal(hg.provider.state.snapshot, null);
  hg.resolve({ user_id: "operator-b", grants: [], expires_at: new Date(Date.now() + 60_000).toISOString() });
  await hgFlush();
  assert.equal(hg.provider.state.snapshot?.user_id, "operator-b", JSON.stringify(hg.provider.state));
  hg.provider.componentWillUnmount();
});

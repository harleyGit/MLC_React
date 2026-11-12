import assert from "node:assert/strict";
import { test } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

/** 用内存账号/事件总线验证页面协作，不请求 Go 或 Centrifugo。 */
test("Chat 重连入口、失败标红和恢复", async (hgTest) => {
  const hgOriginal = { window: globalThis.window, localStorage: globalThis.localStorage, sessionStorage: globalThis.sessionStorage };
  const hgWindow = new EventTarget(); // 模拟当前标签页的自定义事件总线。
  globalThis.window = hgWindow;
  globalThis.localStorage = { getItem: () => `h.${Buffer.from(JSON.stringify({ uid: "user-1" })).toString("base64url")}.s` };
  globalThis.sessionStorage = { getItem: () => null };
  const hgVite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, preTransformRequests: false }, appType: "custom", mode: "debug" });
  hgTest.after(async () => {
    await hgVite.close();
    Object.assign(globalThis, hgOriginal);
  });
  const [{ default: HGTopNavLayout }, { default: HGHomePage }, { default: HGHomeVM }, { HG_IM_CONNECTION_EVENT, HG_IM_RECONNECT_EVENT }, { hgMessage }] = await Promise.all([
    hgVite.ssrLoadModule("/src/manager_antd/page_modules/home/hg_top_nav_layout.jsx"),
    hgVite.ssrLoadModule("/src/manager_antd/page_modules/home/hg_home_page.jsx"),
    hgVite.ssrLoadModule("/src/manager_antd/page_modules/home/hg_home_vm.jsx"),
    hgVite.ssrLoadModule("/src/manager_antd/page_modules/home/hg_im_connection_events.js"),
    hgVite.ssrLoadModule("/src/components/hg_message/hg_message_page.jsx"),
  ]);
  const hgToasts = []; // 记录失败提示，不挂载真实 toast DOM。
  const hgOriginalError = hgMessage.error;
  hgMessage.error = (hgReason) => hgToasts.push(hgReason);
  hgTest.after(() => { hgMessage.error = hgOriginalError; });
  const hgLayout = new HGTopNavLayout({ location: { pathname: "/home" } });
  hgLayout.hgMounted = true;
  hgLayout.setState = (hgPatch) => Object.assign(hgLayout.state, hgPatch);
  hgWindow.addEventListener(HG_IM_CONNECTION_EVENT, hgLayout.hgOnChatConnection);
  hgTest.after(() => hgWindow.removeEventListener(HG_IM_CONNECTION_EVENT, hgLayout.hgOnChatConnection));

  await hgTest.test("同页点击 Chat 发出重连命令，页面无手动按钮", () => {
    const hgPage = new HGHomePage({});
    let hgReconnects = 0;
    hgPage.hgVM = { hgAlive: () => true, hgReconnect: () => { hgReconnects++; } };
    hgWindow.addEventListener(HG_IM_RECONNECT_EVENT, hgPage.hgReconnect);
    hgLayout.handleClick({ key: "home" });
    assert.equal(hgReconnects, 1);
    hgLayout.props.location.pathname = "/products";
    hgLayout.handleClick({ key: "home" }); // 新页面挂载时自行启动，无需旧 VM 重连。
    assert.equal(hgReconnects, 1);
    assert.doesNotMatch(renderToStaticMarkup(hgPage.renderStatus()), /重连实时/);
    hgWindow.removeEventListener(HG_IM_RECONNECT_EVENT, hgPage.hgReconnect);
  });

  await hgTest.test("缺少设备凭据时标红且只提示一次，恢复后清除", async () => {
    const hgVM = new HGHomeVM(async () => {}, () => {});
    hgVM.hgSync = async () => {}; // 缺设备路径不触发外部同步请求。
    await hgVM.hgStart();
    assert.equal(hgLayout.state.hgChatFailed, true);
    assert.match(hgToasts[0], /无本设备凭据/);
    const hgChatLabel = hgLayout.renderTopMenu("home").props.items[0].label;
    assert.match(hgChatLabel.props.className, /menuLinkFailed/);
    hgVM.hgPublishConnection("failed", "无本设备凭据");
    assert.equal(hgToasts.length, 1);
    hgVM.hgOnRealtimeStatus("实时已连接");
    assert.equal(hgLayout.state.hgChatFailed, false);
    hgVM.hgClose();
  });

  await hgTest.test("断线只在有界等待后告警，恢复可清理计时器", () => {
    const hgVM = new HGHomeVM(async () => {}, () => {});
    const hgOriginalTimeout = globalThis.setTimeout;
    let hgDeadline; // 捕获观察窗口到期回调，避免测试真实等待 20 秒。
    globalThis.setTimeout = (hgCallback, hgDelay) => { assert.equal(hgDelay, 20000); hgDeadline = hgCallback; return 1; };
    try {
      hgVM.hgOnRealtimeStatus("实时重连中 · HTTP 补拉可用");
      assert.equal(hgLayout.state.hgChatFailed, false);
      hgDeadline();
      assert.equal(hgLayout.state.hgChatFailed, true);
      assert.match(hgToasts.at(-1), /连接超时|网络已断开/);
      hgVM.hgOnRealtimeStatus("实时已连接");
      assert.equal(hgVM.hgConnectionTimer, null);
      assert.equal(hgLayout.state.hgChatFailed, false);
    } finally {
      globalThis.setTimeout = hgOriginalTimeout;
      hgVM.hgClose();
    }
  });

  await hgTest.test("获取实时 token 瞬态失败只尝试两次，最终反馈安全原因", async () => {
    const hgVM = new HGHomeVM(async () => {}, () => {});
    hgVM.hgCredential = { deviceId: "a".repeat(32), secret: "b".repeat(64) };
    let hgAttempts = 0;
    hgVM.hgAPI.hgRealtimeToken = async () => { hgAttempts++; throw new Error("不应出现在 UI 的原始响应"); };
    try {
      await hgVM.hgReconnect();
      assert.equal(hgAttempts, 2);
      assert.equal(hgLayout.state.hgChatFailed, true);
      assert.doesNotMatch(hgToasts.at(-1), /原始响应/);
    } finally {
      hgVM.hgClose();
    }
  });

  await hgTest.test("会话同步不再定时轮询，同步期间的新事件仍会补拉", async () => {
    const hgVM = new HGHomeVM(async () => {}, () => {});
    hgVM.hgRealtime = { hgClient: { state: "connected" }, hgClose: () => {} };
    hgVM.hgState.activeId = "1";
    hgVM.hgFollow = false; // 此用例只核对会话同步调度，不触发消息历史请求。
    let hgLoads = 0;
    let hgRelease; // 第二轮同步的完成回调，用于模拟请求期间到达的新事件。
    hgVM.hgLoadConversations = () => {
      hgLoads++;
      return hgLoads === 2 ? new Promise((hgResolve) => { hgRelease = hgResolve; }) : Promise.resolve();
    };
    const hgOriginalTimeout = globalThis.setTimeout;
    const hgTimers = []; // 只记录本用例的调度，不等待真实时钟。
    globalThis.setTimeout = (hgCallback, hgDelay) => { hgTimers.push({ hgCallback, hgDelay }); return 1; };
    try {
      await hgVM.hgSync();
      assert.equal(hgLoads, 1);
      assert.equal(hgTimers.length, 0, "没有新事件时不应继续轮询");

      const hgPending = hgVM.hgSync();
      hgVM.hgSchedule(); // 请求进行中，事件必须合并为下一轮补拉。
      hgRelease();
      await hgPending;
      assert.equal(hgTimers.length, 1);
      assert.equal(hgTimers[0].hgDelay, 1000);
      hgTimers[0].hgCallback();
      assert.equal(hgLoads, 3);
    } finally {
      globalThis.setTimeout = hgOriginalTimeout;
      hgVM.hgClose();
    }
  });
});

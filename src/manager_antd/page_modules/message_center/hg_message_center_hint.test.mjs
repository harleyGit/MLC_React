import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";

function hgTestWindow(hgTest) {
  const oldWindow = globalThis.window;
  globalThis.window = { addEventListener() {}, removeEventListener() {} };
  hgTest.after(() => { globalThis.window = oldWindow; });
}

/** 不连接实时网关，验证消息中心的当前会话指针不会刷新整页列表。 */
test("消息中心仅对其他会话及未知事件重拉会话列表", async (hgTest) => {
  hgTestWindow(hgTest);
  const hgVite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, preTransformRequests: false }, appType: "custom", mode: "debug" });
  hgTest.after(() => hgVite.close());
  const { default: HGMessageCenterPage } = await hgVite.ssrLoadModule("/src/manager_antd/page_modules/message_center/hg_message_center_page.jsx");
  const hgPage = new HGMessageCenterPage({});
  hgPage.hgMounted = true;
  hgPage.state.activeKey = "im";
  hgPage.state.activeConversationId = "1";
  let hgLists = 0;
  let hgHistories = 0;
  let hgPending = 0;
  hgPage.loadIMConversations = () => { hgLists++; };
  hgPage.loadIMHistory = () => { hgHistories++; };
  hgPage.loadIMDevicePending = () => { hgPending++; };

  hgPage.handleIMHint({ eventType: "message.committed", conversationId: "1" });
  assert.deepEqual([hgLists, hgHistories, hgPending], [0, 1, 1]);
  hgPage.handleIMHint({ eventType: "message.committed", conversationId: "2" });
  hgPage.handleIMHint({ eventType: "call.changed", conversationId: "1" });
  assert.deepEqual([hgLists, hgHistories, hgPending], [2, 1, 3]);
  hgPage.componentWillUnmount();
});

/** 本人权限更新推送只触发受认证的系统通知列表补拉，不能相信推送中的通知正文。 */
test("IAM 通知事件使消息中心重新读取权威系统通知", async (hgTest) => {
  hgTestWindow(hgTest);
  const hgVite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, preTransformRequests: false }, appType: "custom", mode: "debug" });
  hgTest.after(() => hgVite.close());
  const { default: HGMessageCenterPage } = await hgVite.ssrLoadModule("/src/manager_antd/page_modules/message_center/hg_message_center_page.jsx");
  const { default: HGMessageCenterVM } = await hgVite.ssrLoadModule("/src/manager_antd/page_modules/message_center/hg_message_center_vm.jsx");
  const wasRemote = HGMessageCenterVM.isRemote;
  HGMessageCenterVM.isRemote = () => true;
  hgTest.after(() => { HGMessageCenterVM.isRemote = wasRemote; });
  const page = new HGMessageCenterPage({});
  page.hgMounted = true;
  page.state.activeKey = "system";
  let refreshed = 0;
  page.loadRemoteData = () => { refreshed += 1; };
  page.hgOnIAMNotification();
  assert.equal(refreshed, 1);
  page.hgMounted = false;
  page.hgOnIAMNotification();
  assert.equal(refreshed, 1);
  page.componentWillUnmount();
});

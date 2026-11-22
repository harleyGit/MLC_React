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

/** 只按本人频道的分类提示决定需要补拉的视图；私信视图不能请求通知列表。 */
test("实时通知提示按分类补拉权威列表与未读数", async (hgTest) => {
  hgTestWindow(hgTest);
  const hgVite = await createServer({ configFile: false, optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, preTransformRequests: false }, appType: "custom", mode: "debug" });
  hgTest.after(() => hgVite.close());
  const { default: HGMessageCenterPage } = await hgVite.ssrLoadModule("/src/manager_antd/page_modules/message_center/hg_message_center_page.jsx");
  const { default: HGMessageCenterVM, MESSAGE_CATEGORIES, NOTIFY_CHANNEL_OPTIONS } = await hgVite.ssrLoadModule("/src/manager_antd/page_modules/message_center/hg_message_center_vm.jsx");
  const wasRemote = HGMessageCenterVM.isRemote;
  HGMessageCenterVM.isRemote = () => true;
  hgTest.after(() => { HGMessageCenterVM.isRemote = wasRemote; });
  const page = new HGMessageCenterPage({});
  page.hgMounted = true;
  page.state.activeKey = "system";
  let refreshed = 0;
  let unread = 0;
  const originalLoad = page.loadRemoteData; // 类字段方法绑定实例，不存在于原型上。
  page.loadRemoteData = () => { refreshed += 1; };
  const wasUnread = HGMessageCenterVM.fetchUnreadSummary;
  HGMessageCenterVM.fetchUnreadSummary = async () => { unread += 1; return { unreadByCategory: { trade: 2 } }; };
  hgTest.after(() => { HGMessageCenterVM.fetchUnreadSummary = wasUnread; });
  page.setState = (next) => { page.state = { ...page.state, ...next }; };
  page.hgOnNotification({ detail: { category: "system", content: "不可使用推送正文" } });
  assert.equal(refreshed, 1);
  page.hgOnNotification({ detail: { category: "trade" } });
  await Promise.resolve();
  assert.equal(refreshed, 1);
  assert.equal(unread, 1);
  assert.deepEqual(page.state.unreadByCategory, { trade: 2 });
  page.state.activeKey = "im";
  page.hgOnNotification();
  await Promise.resolve();
  assert.equal(refreshed, 1);
  assert.equal(unread, 2);
  const wasList = HGMessageCenterVM.fetchNotifications;
  let lastRequest; // 收件箱 API 的查询参数；只验有界页和“只看未读”条件。
  HGMessageCenterVM.fetchNotifications = async (options) => {
    lastRequest = options;
    return { list: [], nextCursor: "" };
  };
  hgTest.after(() => { HGMessageCenterVM.fetchNotifications = wasList; });
  page.state.activeKey = "marketing";
  page.state.unreadOnly = true;
  page.loadRemoteData = originalLoad;
  page.loadRemoteData();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(lastRequest?.category, "marketing");
  assert.equal(lastRequest?.unreadOnly, true);
  page.hgMounted = false;
  page.hgOnNotification();
  assert.equal(refreshed, 1);
  assert.equal(unread, 3); // 两次提示补拉 + 一次显式初始化补拉。
  assert.equal(HGMessageCenterVM.getCategoryMeta("marketing")?.label, "运营通知");
  assert.equal(MESSAGE_CATEGORIES.filter((item) => item.key === "marketing").length, 1);
  assert.match(NOTIFY_CHANNEL_OPTIONS.find((item) => item.key === "realtime")?.desc || "", /自动启用/);
  page.componentWillUnmount();
});

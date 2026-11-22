import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { transformSync } from "@swc/core";
import React from "react";

/** 在内存中编译真实页面；网络和 UI 组件均用无副作用替身。 */
function hgLoadPage(file, api, messages = []) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const code = transformSync(source, {
    filename: file, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const module = { exports: {} };
  runInNewContext(code, {
    module, exports: module.exports, React,
    window: { addEventListener() {}, removeEventListener() {} },
    require(path) {
      if (path === "react") return React;
      if (path === "./hg_notify_channel_page") return { __esModule: true, default: hgLoadPage("./hg_notify_channel_page.jsx", api, messages) };
      if (path === "./hg_notify_channel_vm") return {
        __esModule: true, default: api, CHANNEL_DATA_SOURCE: "remote",
        CHANNEL_PRIORITY_OPTIONS: [], RETRY_LADDER: [], TEMPLATE_CATEGORY_LABELS: {},
      };
      if (path.endsWith("hg_iam_provider")) return { HGIAMContext: React.createContext(null) };
      if (path.endsWith("hg_iam_session")) return { hgCurrentIAMUser: () => "ADMIN" };
      if (path.endsWith("hg_message_page")) return { hgMessage: { error: (text) => messages.push(text) } };
      if (path.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: {} };
      if (path.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
      return { __esModule: true, default: () => null };
    },
  });
  return module.exports.default;
}

/** 手动提交类组件状态，仅核对业务页面分支与异步加载结果，不执行实际 DOM 操作。 */
function hgInstance(Type, props) {
  const page = new Type(props);
  page.setState = (update) => {
    page.state = { ...page.state, ...(typeof update === "function" ? update(page.state) : update) };
  };
  return page;
}

test("投递列表请求失败时渠道仍展示服务端渠道卡片，发送表单不再出现在渠道页", async () => {
  const errors = [];
  const api = {
    isRemote: () => true,
    fetchChannels: async () => ({ channels: [{ code: "in_app", name: "站内信", providers: [], enabled: true,
      tone: "blue", successRate: 0, primaryMetricLabel: "投递量", p95: "--", desc: "已接入" }], providers: [] }),
    fetchDeliveries: async () => { throw new Error("投递记录不可用"); },
    getHealthTone: () => "neutral",
  };
  const Type = hgLoadPage("./hg_notify_channel_page.jsx", api, errors);
  const page = hgInstance(Type, { hgView: "channel" });
  page.hgMounted = true;
  page.hgOwner = "ADMIN";
  await page.loadRemoteData();
  assert.equal(page.state.channels.length, 1);
  assert.equal(page.state.channelError, "");
  assert.equal(page.state.loading, false);
  assert.deepEqual(errors, ["投递记录不可用"]);
  const cards = page.renderChannelSection().props.children;
  assert.equal(cards.props.children.length, 1);
  assert.equal(cards.props.children[0].key, "in_app");
  assert.ok(!page.render().props.children.some((child) => child?.props?.title === "发送通知任务"));
});

test("发送页只显示任务和审批区域，挂载时不请求渠道与投递列表", () => {
  const calls = [];
  const api = {
    isRemote: () => true,
    isSendable: () => false,
    parseUserIds: () => [],
    fetchChannels: () => { calls.push("channels"); },
    fetchDeliveries: () => { calls.push("deliveries"); },
  };
  const Type = hgLoadPage("./hg_notify_send_page.jsx", api);
  const page = hgInstance(Type, Type.defaultProps);
  page.componentDidMount();
  assert.deepEqual(calls, []);
  const children = page.render().props.children;
  assert.ok(children.some((child) => child?.props?.title === "发送通知任务"));
  assert.ok(!children.some((child) => child?.props?.title === "渠道总览"));
  page.componentWillUnmount();
});

test("连续刷新时旧渠道响应不能覆盖新渠道列表", async () => {
  const resolveChannels = [];
  const api = {
    isRemote: () => true,
    fetchChannels: () => new Promise((resolve) => resolveChannels.push(resolve)),
    fetchDeliveries: async () => ({ list: [] }),
  };
  const Type = hgLoadPage("./hg_notify_channel_page.jsx", api);
  const page = hgInstance(Type, { hgView: "channel" });
  page.hgMounted = true;
  page.hgOwner = "ADMIN";
  const oldRequest = page.loadRemoteData();
  const newRequest = page.loadRemoteData();
  resolveChannels[1]({ channels: [{ code: "in_app", providers: [] }] });
  await newRequest;
  resolveChannels[0]({ channels: [{ code: "sms", providers: [] }] });
  await oldRequest;
  assert.equal(page.state.channels[0].code, "in_app");
});

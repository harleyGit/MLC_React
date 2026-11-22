import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { transformSync } from "@swc/core";
import React from "react";
import {
  hgBuildSendCommand, hgDefaultSendVariables, hgSendableTemplate,
  hgValidateSendInput, hgValidateSendSchedule,
} from "./hg_notify_send_contract.js";

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
      if (path.endsWith("hg_message_page")) return { hgMessage: {
        error: (text) => messages.push(text), warning: (text) => messages.push(text),
      } };
      if (path.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: {
        USER_READ: "user:directory:read", NOTIFICATION_SEND_READ: "notification:send:read",
      } };
      if (path === "./hg_notify_send_contract.js") return {
        hgBuildSendCommand, hgDefaultSendVariables, hgValidateSendInput, hgValidateSendSchedule,
      };
      if (path.endsWith(".module.css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
      return { __esModule: true, default: () => null };
    },
  });
  return module.exports.default;
}

/** 手动提交类组件状态，仅核对业务页面分支与异步加载结果，不执行实际 DOM 操作。 */
function hgInstance(Type, props) {
  const page = new Type(props);
  page.setState = (update, done) => {
    page.state = { ...page.state, ...(typeof update === "function" ? update(page.state) : update) };
    done?.();
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

test("模板下拉按 title_template 展示，选择后回填默认变量并显示标题正文", () => {
  const template = {
    templateId: "9007199254740993", templateCode: "system.notice", templateName: "站内通知",
    version: 2, status: "published", publishedVersion: 2, category: "system",
    actionType: "none", actionConfig: {}, channels: ["in_app"],
    titleTemplate: "通知 {{name}}", bodyTemplate: "您好 {{name}}",
    variablesSchema: { name: { type: "string", required: true, default: "小明" } },
  };
  const api = { isRemote: () => true, isSendable: hgSendableTemplate,
    renderTemplate: (item, variables) => ({
      title: item.titleTemplate.replace("{{name}}", variables.name || "{{name}}"),
      content: item.bodyTemplate.replace("{{name}}", variables.name || "{{name}}"),
    }) };
  const Type = hgLoadPage("./hg_notify_send_page.jsx", api);
  const page = hgInstance(Type, Type.defaultProps);
  page.setState({ templates: [template] });
  page.handleSelectTemplate(template.templateId);
  assert.equal(page.state.sendForm.templateId, template.templateId);
  assert.equal(page.state.sendForm.variables.name, "小明");
  const section = page.renderSendSection();
  const toolbar = section.props.children[0];
  const selector = toolbar.props.children[1];
  assert.match(selector.props.options[0].label, /^通知 \{\{name\}\}/);
  const summary = page.renderSelectedTemplate(template);
  assert.match(JSON.stringify(summary), /您好 \{\{name\}\}/);
  assert.match(JSON.stringify(summary), /您好 小明/);
});

test("用户目录弹窗跨页多选并确认后才提交 ID，取消不改变已选用户", async () => {
  const cursors = [];
  const api = {
    isRemote: () => true,
    isSendable: () => true,
    fetchRecipientUsers: async (cursor) => {
      cursors.push(cursor);
      return cursor
        ? { list: [{ id: "U2", name: "小李" }], nextCursor: "" }
        : { list: [{ id: "U1", name: "小明" }], nextCursor: "2" };
    },
  };
  const Type = hgLoadPage("./hg_notify_send_page.jsx", api);
  const page = hgInstance(Type, Type.defaultProps);
  page.hgMounted = true;
  page.hgOwner = "ADMIN";
  page.hgRequire = () => true;
  page.hgOpenRecipientPicker();
  await Promise.resolve();
  assert.equal(page.state.recipientRows.length, 1);
  page.hgChangeRecipientDraft(["U1"], [{ id: "U1", name: "小明" }]);
  await page.hgLoadRecipients();
  page.hgChangeRecipientDraft(["U1", "U2"], [{ id: "U2", name: "小李" }]);
  assert.deepEqual(cursors, ["", "2"]);
  assert.equal(page.state.sendForm.recipients.length, 0, "确认前不得改变发送表单");
  page.hgConfirmRecipients();
  assert.deepEqual(JSON.parse(JSON.stringify(page.state.sendForm.recipients)), [
    { id: "U1", name: "小明" }, { id: "U2", name: "小李" },
  ]);
  const table = page.renderAudienceFields().props.children[1];
  assert.equal(table.props.columns[0].render("小明", table.props.dataSource[0]), "小明（U1）");
  page.setState({ templates: [{ templateId: "1", version: 2, variablesSchema: {} }],
    sendForm: { ...page.state.sendForm, templateId: "1" } });
  assert.deepEqual(JSON.parse(JSON.stringify(page.buildSendPayload().userIds)), ["U1", "U2"]);
  assert.equal(page.state.recipientPickerOpen, false);
  page.hgOpenRecipientPicker();
  page.hgChangeRecipientDraft(["U1"], []);
  page.hgCloseRecipientPicker();
  assert.equal(page.state.sendForm.recipients.length, 2, "取消不得丢失已确认用户");
});

test("无用户目录读取权限时不打开收件人弹窗，也不发起请求", () => {
  const calls = [];
  const warnings = [];
  const Type = hgLoadPage("./hg_notify_send_page.jsx", {
    isRemote: () => true, fetchRecipientUsers: () => { calls.push("directory"); },
  }, warnings);
  const page = hgInstance(Type, Type.defaultProps);
  page.hgOpenRecipientPicker();
  assert.equal(page.state.recipientPickerOpen, false);
  assert.deepEqual(calls, []);
  assert.ok(warnings.some((text) => text.includes("user:directory:read")));
});

test("关窗后过期用户请求不能回填，超出 100 人不更改草稿", async () => {
  let resolvePage;
  const warnings = [];
  const Type = hgLoadPage("./hg_notify_send_page.jsx", {
    isRemote: () => true, fetchRecipientUsers: () => new Promise((resolve) => { resolvePage = resolve; }),
  }, warnings);
  const page = hgInstance(Type, Type.defaultProps);
  page.hgMounted = true;
  page.hgOwner = "ADMIN";
  page.hgRequire = () => true;
  page.hgOpenRecipientPicker();
  page.hgCloseRecipientPicker();
  resolvePage({ list: [{ id: "U1", name: "小明" }], nextCursor: "" });
  await Promise.resolve();
  assert.equal(page.state.recipientRows.length, 0);
  assert.equal(page.state.recipientPickerOpen, false);
  page.hgChangeRecipientDraft(Array.from({ length: 101 }, (_, i) => `U${i}`), []);
  assert.equal(page.state.recipientDraft.length, 0);
  assert.ok(warnings.some((text) => text.includes("100")));
});

test("记录独立页使用 HGCollectionView，任务列表按本人游标读取", async () => {
  const api = { isRemote: () => true, taskPage: async () => ({
    list: [{ taskId: "10", templateId: "1", templateVersion: 2,
      status: "pending", processed: 0, total: 2 }], nextCursor: "",
  }) };
  const Type = hgLoadPage("./hg_notify_send_records_page.jsx", api);
  const page = hgInstance(Type, Type.defaultProps);
  page.hgRequire = () => true;
  page.componentDidMount();
  await Promise.resolve();
  assert.equal(page.state.tasks[0].taskId, "10");
  assert.equal(page.state.tasksLoaded, true);
  const list = page.renderTaskList();
  const collection = list.props.children[0];
  assert.equal(collection.props.ariaLabel, "本人发送记录");
  assert.equal(collection.props.items.length, 1);
  assert.ok(!page.render().props.children.some((child) => child?.props?.title === "发送通知任务"));
  page.componentWillUnmount();
});

test("发送页只显示任务和审批区域，挂载时不请求渠道与投递列表", () => {
  const calls = [];
  const api = {
    isRemote: () => true,
    isSendable: () => false,
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

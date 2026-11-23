import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { hgTemplatePayload, hgTemplateToForm } from "./hg_template_form.js";
import {
  hgCreateVariableEntry,
  hgPreviewSampleValues,
  hgPreviewText,
  hgUnknownPlaceholders,
} from "./hg_template_form.js";
import { hgFullTemplateDraft } from "./hg_full_template_draft.js";
import { hgRoleUpdateTemplateDraft } from "./hg_role_update_template.js";
import { hgNormalizeSendTemplate, hgPublishableSendTemplate } from "../notify_channel/hg_notify_send_contract.js";

const hgSource = new URL("./hg_system_notify_template_page.jsx", import.meta.url); // 测试真实页面逻辑，隔离网络与浏览器。
const hgEmpty = {
  template_code: "", name: "", category: "system", title_template: "",
  body_template: "", variables_schema: [], action_type: "none",
  action_config: { route_name: "", params: [] }, channels: ["in_app"],
  priority: 2, locale: "zh-CN", version: 0,
};

/** 模拟受控 React 状态和模板 API，不访问浏览器凭据或真实数据库。 */
function hgTestPage(api, messages, permissions = null) {
  const module = { exports: {} };
  const code = transformSync(readFileSync(hgSource, "utf8"), {
    filename: "hg_system_notify_template_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(code, {
    module, exports: module.exports, React,
    window: { addEventListener() {}, removeEventListener() {}, confirm: () => true },
    require: (path) => {
      if (path === "react") return React;
      if (path.endsWith("hg_system_notify_template_vm")) return {
        __esModule: true, default: api, HG_EMPTY_TEMPLATE: hgEmpty,
      };
      if (path.endsWith("hg_template_form.js")) return {
        hgTemplatePayload,
        hgTemplateToForm,
        hgCreateVariableEntry,
        hgPreviewSampleValues,
        hgPreviewText,
        hgUnknownPlaceholders,
      };
      if (path.endsWith("hg_full_template_draft.js")) return { hgFullTemplateDraft };
      if (path.endsWith("hg_role_update_template.js")) return { hgRoleUpdateTemplateDraft };
      if (path.endsWith("hg_notify_send_contract.js")) return { hgNormalizeSendTemplate, hgPublishableSendTemplate };
      if (path.endsWith("hg_message_page")) return { hgMessage: { success: (text) => messages.push(text) } };
      if (path.endsWith("hg_access_evaluator")) return {
        hgEvaluateAccess: (_, { permission }) => ({ allowed: !permissions || permissions.includes(permission) }),
      };
      if (path.endsWith("hg_iam_provider")) return { HGIAMContext: React.createContext(null) };
      if (path.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: {
        NOTIFICATION_TEMPLATE_CREATE: "notification:template:create",
        NOTIFICATION_TEMPLATE_UPDATE: "notification:template:update",
        NOTIFICATION_TEMPLATE_DELETE: "notification:template:delete",
        NOTIFICATION_TEMPLATE_PUBLISH: "notification:template:publish",
      } };
      if (path.endsWith(".module.css")) return { default: {} };
      return { default: () => null, __esModule: true };
    },
  });
  const page = new module.exports.default({});
  page.setState = (update) => {
    const patch = typeof update === "function" ? update(page.state, page.props) : update;
    page.state = { ...page.state, ...patch };
  };
  page.hgMounted = true;
  return page;
}

test("通用发布与站内发送显式分离；角色更新模板仍走专用发布", async () => {
  const calls = [];
  const messages = [];
  const page = hgTestPage({
    publish: async (id, version) => calls.push(["role", id, version]),
    publishSend: async (id, version) => calls.push(["send", id, version]),
    publishGeneral: async (id, version) => calls.push(["general", id, version]),
    list: async () => ({ list: [], nextCursor: "" }),
    errorMessage: (error) => error.message,
  }, messages, ["notification:template:publish"]);
  const role = { id: "1", template_code: "iam.role.updated", version: 2, published_version: null, publication_status: "draft" };
  const send = {
    id: "2", template_code: "system.notice", version: 2, published_version: 1, publication_status: "draft",
    category: "system", action_type: "none", action_config: {}, variables_schema: {},
    channels: ["in_app"],
  };
  const security = { ...send, id: "3", template_code: "security.code", category: "security", channels: ["in_app", "realtime"] };
  const buttons = (item, targetPage = page) => {
    const found = [];
    function collect(element) {
      if (!React.isValidElement(element)) return;
      if (element.type === "button") found.push(element);
      React.Children.forEach(element.props.children, collect);
    }
    collect(targetPage.hgRenderCard(item));
    return found;
  };
  assert.equal(buttons(role).some((button) => button.props.children === "发布当前版本"), false);
  const sendButton = buttons(send).find((button) => button.props.children === "发布供站内发送");
  assert.ok(sendButton, "站内发送版发布权限不依赖编辑权限");
  assert.ok(buttons(send).some((button) => button.props.children === "发布通用版本"));
  assert.equal(buttons({ ...send, channels: ["in_app", "realtime"] })
    .some((button) => button.props.children === "发布供站内发送"), false, "不符合站内发送条件不能发布发送版");
  assert.ok(buttons(security).some((button) => button.props.children === "发布通用版本"));
  assert.equal(buttons(security).some((button) => button.props.children === "发布供站内发送"), false);
  assert.ok(buttons({ ...security, status: "draft", publication_status: undefined, published_version: null })
    .some((button) => button.props.children === "发布通用版本"), "旧服务端缺少 publication_status 时仍显示未发布草稿");
  assert.ok(buttons({ ...send, status: "published", publication_status: undefined })
    .some((button) => button.props.children === "发布通用版本"), "已发布模板的新草稿不能被主表 published 状态遮住");
  assert.equal(buttons({ ...send, status: "published", publication_status: undefined, published_version: 2 })
    .some((button) => button.props.children === "发布通用版本"), false, "旧服务端已发布的当前版本不能误作草稿");
  const noPublishPage = hgTestPage({}, [], ["notification:template:update"]);
  const disabledPublish = buttons(security, noPublishPage).find((button) => button.props.children === "发布通用版本");
  assert.equal(disabledPublish.props.disabled, true, "缺少发布授权时显示入口和原因，但不允许触发写请求");
  assert.match(JSON.stringify(noPublishPage.hgRenderCard(security)), /notification:template:publish/);
  await buttons(security).find((button) => button.props.children === "发布通用版本").props.onClick();
  assert.deepEqual(calls, [["general", "3", 2]]);
  assert.deepEqual(messages, ["通用版本已发布；尚不可用于运营发送"]);
  await sendButton.props.onClick();
  assert.deepEqual(calls, [["general", "3", 2], ["send", "2", 2]]);
  assert.ok(buttons({ ...send, published_version: 2, publication_status: "published_general" })
    .some((button) => button.props.children === "发布供站内发送"), "通用发布后仍可单独审核升级为发送版");
  assert.equal(buttons({ ...send, published_version: 2, publication_status: "published" })
    .some((button) => button.props.children === "发布供站内发送"), false);
  const rolePage = hgTestPage({
    publish: async (id, version) => calls.push(["role", id, version]),
    list: async () => ({ list: [], nextCursor: "" }),
    errorMessage: (error) => error.message,
  }, messages, ["notification:template:update"]);
  const roleButtons = [];
  function collectRole(element) {
    if (!React.isValidElement(element)) return;
    if (element.type === "button") roleButtons.push(element);
    React.Children.forEach(element.props.children, collectRole);
  }
  collectRole(rolePage.hgRenderCard(role));
  await roleButtons.find((button) => button.props.children === "发布当前版本").props.onClick();
  assert.deepEqual(calls, [["general", "3", 2], ["send", "2", 2], ["role", "1", 2]]);
});

test("旧服务端不提供通用发布接口时显示可操作的错误，不伪装为成功", async () => {
  const page = hgTestPage({
    publishGeneral: async () => { throw { status: 404 }; },
    errorMessage: () => "请求失败",
  }, [], ["notification:template:publish"]);
  await page.hgPublish({
    id: "3", name: "安全通知", version: 1, template_code: "security.code", published_version: null,
  });
  assert.match(page.state.hgError, /服务端已部署通用发布功能/);
});

test("保存草稿并刷新旧格式列表后出现通用发布入口", async () => {
  const calls = [];
  const page = hgTestPage({
    create: async (body) => {
      calls.push(["create"]);
      return { ...body, id: "13", version: 1, status: "draft", published_version: null };
    },
    list: async () => ({
      list: [{ id: "13", name: "平台验证码", template_code: "security.code",
        status: "draft", version: 1, published_version: null }],
      nextCursor: "",
    }),
    publishGeneral: async (id, version) => calls.push(["publishGeneral", id, version]),
    errorMessage: (error) => error.message,
  }, [], ["notification:template:create", "notification:template:publish"]);
  page.hgCreate();
  await page.hgSave({ preventDefault() {} });
  assert.equal(page.state.hgEditing, false);
  const actions = [];
  function collect(element) {
    if (!React.isValidElement(element)) return;
    if (element.type === "button") actions.push(element);
    React.Children.forEach(element.props.children, collect);
  }
  collect(page.hgRenderCard(page.state.hgItems[0]));
  const publish = actions.find((button) => button.props.children === "发布通用版本");
  assert.equal(publish?.props.disabled, false);
  await publish.props.onClick();
  assert.deepEqual(calls, [["create"], ["publishGeneral", "13", 1]]);
});

test("预填角色更新模板，经创建接口提交后刷新列表、读取详情回填并按版本编辑", async () => {
  const calls = [];
  const messages = [];
  let stored = null; // 仅测试用的服务端快照；null 表示尚未创建。
  const api = {
    list: async (cursor) => {
      calls.push(["list", cursor]);
      return { list: stored ? [stored] : [], nextCursor: "" };
    },
    create: async (body) => {
      calls.push(["create", body]);
      stored = { ...body, id: "9007199254740993", version: 1, status: "draft", published_version: null };
      return { id: stored.id, version: 1, status: "draft" };
    },
    detail: async (id) => {
      calls.push(["detail", id]);
      return { ...stored, version: 2, name: "服务端最新名称" };
    },
    update: async (id, body) => {
      calls.push(["update", id, body]);
      stored = { ...stored, ...body, version: 3 };
      return { id, version: 3, status: "draft" };
    },
    errorMessage: (error) => error.message,
  };
  const page = hgTestPage(api, messages);
  page.hgCreate(true);
  assert.equal(page.state.hgForm.template_code, "iam.role.updated");
  assert.equal(page.state.hgForm.body_template, "您的角色 {{role_name}} 已更新，请查看最新权限。");
  assert.deepEqual(page.state.hgForm.variables_schema.map((entry) => entry.name), ["role_name"]);
  assert.equal(calls.length, 0, "选择预设不能自动写入");
  await page.hgSave({ preventDefault() {} });
  const create = calls.find(([method]) => method === "create");
  assert.equal(create[1].template_code, "iam.role.updated");
  assert.deepEqual(JSON.parse(JSON.stringify(create[1].variables_schema)), {
    role_name: { type: "string", required: true, max_length: 128 },
  });
  assert.deepEqual(create[1].channels, ["in_app", "realtime"]);
  assert.equal(page.state.hgItems[0].id, "9007199254740993");
  assert.equal(page.state.hgItems[0].template_code, "iam.role.updated");
  assert.equal(page.state.hgEditing, false);
  await page.hgOpen(page.state.hgItems[0]);
  assert.deepEqual(calls.find(([method]) => method === "detail"), ["detail", stored.id]);
  assert.equal(page.state.hgForm.name, "服务端最新名称", "编辑应读取详情，不使用列表旧快照");
  assert.equal(page.state.hgForm.version, 2);
  assert.equal(page.state.hgForm.variables_schema[0].name, "role_name");
  page.hgChange("body_template", "角色 {{role_name}} 权限已更新。");
  await page.hgSave({ preventDefault() {} });
  const update = calls.find(([method]) => method === "update");
  assert.equal(update[1], stored.id);
  assert.equal(update[2].version, 2);
  assert.equal(update[2].body_template, "角色 {{role_name}} 权限已更新。");
  assert.equal(Object.hasOwn(update[2], "template_code"), false);
  assert.equal(page.state.hgItems[0].version, 3);
  assert.deepEqual(messages, ["已创建模板草稿", "已生成新草稿版本"]);
});

test("新建默认预填最全示例模板，按钮式增删变量、参数与渠道后提交", async () => {
  const calls = [];
  const api = {
    list: async () => ({ list: [], nextCursor: "" }),
    create: async (body) => {
      calls.push(["create", body]);
      return { id: "9007199254740994", version: 1, status: "draft" };
    },
    errorMessage: (error) => error.message,
  };
  const page = hgTestPage(api, []);
  page.hgCreate();
  assert.equal(page.state.hgForm.template_code, "example.full_notification");
  assert.equal(page.state.hgForm.variables_schema.length, 5, "默认草稿包含最全变量示例");
  assert.deepEqual(page.state.hgForm.channels, ["in_app", "realtime"]);
  assert.equal(page.state.hgForm.action_config.params.length, 1);
  // 按钮式增删：变量行追加、改名、删除首行。
  page.hgAddVariable();
  assert.equal(page.state.hgForm.variables_schema.length, 6);
  page.hgChangeVariable(5, "name", "extra_note");
  page.hgRemoveVariable(0);
  // 跨 vm 上下文数组原型不同，用逗号拼接比较，避免 deepEqual 的引用相等限制。
  assert.equal(
    page.state.hgForm.variables_schema.map((entry) => entry.name).join(","),
    "order_no,pay_time,amount,remark,extra_note"
  );
  // 点击参数行：追加、改键值、删除首行。
  page.hgAddActionParam();
  page.hgChangeActionParam(1, "key", "from");
  page.hgChangeActionParam(1, "value", "preview");
  page.hgRemoveActionParam(0);
  // 渠道：取消 realtime，仅保留站内信。
  page.hgToggleChannel("realtime");
  assert.deepEqual(page.state.hgForm.channels, ["in_app"]);
  await page.hgSave({ preventDefault() {} });
  const body = calls.find(([method]) => method === "create")[1];
  assert.deepEqual(body.action_config, { route_name: "order_detail", params: { from: "preview" } });
  assert.deepEqual(body.channels, ["in_app"]);
  assert.deepEqual(body.variables_schema.order_no, { type: "string", required: true, max_length: 64, description: "业务订单号" });
  assert.deepEqual(body.variables_schema.extra_note, { type: "string", required: true });
});

test("接口失败时保留角色更新模板草稿，不假装已写入", async () => {
  const page = hgTestPage({
    create: async () => { throw new Error("无创建权限"); },
    errorMessage: (error) => error.message,
  }, []);
  page.hgCreate(true);
  await page.hgSave({ preventDefault() {} });
  assert.equal(page.state.hgEditing, true);
  assert.equal(page.state.hgForm.template_code, "iam.role.updated");
  assert.equal(page.state.hgError, "无创建权限");
});

test("变量行未填写名称时本地校验拦截，不调用创建接口", async () => {
  const calls = [];
  const page = hgTestPage({
    list: async () => ({ list: [], nextCursor: "" }),
    create: async (body) => {
      calls.push(body);
      return { id: "1", version: 1 };
    },
    errorMessage: (error) => error.message,
  }, []);
  page.hgCreate();
  page.hgAddVariable();
  await page.hgSave({ preventDefault() {} });
  assert.equal(calls.length, 0, "未填写变量名不得提交");
  assert.match(page.state.hgError, /未填写变量名/);
  assert.equal(page.state.hgEditing, true, "草稿保留在编辑器中");
});

test("新建支持大写编码；切换为无跳转清除旧 route_name 并禁用点击配置", () => {
  const page = hgTestPage({ errorMessage: (error) => error.message }, []);
  page.hgCreate();
  page.hgChange("template_code", "SMS_001");
  const field = page.hgRenderField("模板编码", "template_code", { maxLength: 100 });
  const input = React.Children.toArray(field.props.children).find((child) => child?.type === "input");
  assert.equal(input.props.pattern, "[A-Za-z][A-Za-z0-9_.]{1,99}");
  assert.match(input.props.title, /区分大小写/);
  assert.equal(page.state.hgForm.action_config.route_name, "order_detail");
  page.hgChange("action_type", "none");
  assert.deepEqual(JSON.parse(JSON.stringify(page.state.hgForm.action_config)), {
    route_name: "", params: [], extra: {},
  });
  const body = hgTemplatePayload(page.state.hgForm, false);
  assert.equal(body.template_code, "SMS_001");
  assert.deepEqual(body.action_config, {});
  const actionEditor = page.hgRenderActionConfigEditor(false);
  const controls = [];
  function collect(element) {
    if (!React.isValidElement(element)) return;
    if (["input", "button"].includes(element.type)) controls.push(element);
    React.Children.forEach(element.props.children, collect);
  }
  collect(actionEditor);
  assert.ok(controls.length > 0);
  assert.ok(controls.every((control) => control.props.disabled === true));
});

test("切换点击行为自动填写匹配路由并清除旧路由参数", async () => {
  const calls = [];
  const page = hgTestPage({
    list: async () => ({ list: [], nextCursor: "" }),
    create: async (body) => {
      calls.push(body);
      return { id: "1", version: 1 };
    },
    errorMessage: (error) => error.message,
  }, []);
  page.hgCreate();
  page.hgChange("action_type", "security_center");
  assert.deepEqual(JSON.parse(JSON.stringify(page.state.hgForm.action_config)), {
    route_name: "security_center", params: [], extra: {},
  });
  await page.hgSave({ preventDefault() {} });
  assert.equal(calls[0].action_type, "security_center");
  assert.deepEqual(calls[0].action_config, { route_name: "security_center" });
  const editor = page.hgRenderActionConfigEditor(false);
  const controls = [];
  function collect(element) {
    if (!React.isValidElement(element)) return;
    if (element.type === "input") controls.push(element);
    React.Children.forEach(element.props.children, collect);
  }
  collect(editor);
  assert.equal(controls[0].props.value, "security_center");
  assert.equal(controls[0].props.readOnly, true, "路由名必须与点击行为保持一致");
  page.hgCreate(true);
  page.hgChange("action_type", "security_center");
  assert.deepEqual(hgTemplatePayload(page.state.hgForm, false).action_config, {
    route_name: "security_center",
  }, "角色通知从无跳转切换到安全中心时也应自动填充路由名");
});

test("打开旧版空路由配置时补齐路由名，保留版本与其他字段", async () => {
  const calls = [];
  const detail = {
    ...hgEmpty, id: "1", version: 2, template_code: "iam.role.updated",
    name: "角色更新通知", title_template: "角色信息已更新",
    body_template: "您的角色 {{role_name}} 已更新，请查看最新权限。",
    variables_schema: { role_name: { type: "string", required: true, max_length: 128 } },
    action_type: "security_center", action_config: {}, channels: ["in_app", "realtime"],
  };
  const page = hgTestPage({
    detail: async () => detail,
    update: async (id, body) => calls.push([id, body]),
    list: async () => ({ list: [], nextCursor: "" }),
    errorMessage: (error) => error.message,
  }, []);
  await page.hgOpen({ id: "1" });
  assert.equal(page.state.hgForm.action_config.route_name, "security_center");
  assert.equal(page.state.hgForm.version, 2);
  await page.hgSave({ preventDefault() {} });
  assert.equal(calls[0][0], "1");
  assert.equal(calls[0][1].version, 2);
  assert.deepEqual(calls[0][1].action_config, { route_name: "security_center" });
});

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

const hgSource = new URL("./hg_system_notify_template_page.jsx", import.meta.url); // 测试真实页面逻辑，隔离网络与浏览器。
const hgEmpty = {
  template_code: "", name: "", category: "system", title_template: "",
  body_template: "", variables_schema: [], action_type: "none",
  action_config: { route_name: "", params: [] }, channels: ["in_app"],
  priority: 2, locale: "zh-CN", version: 0,
};

/** 模拟受控 React 状态和模板 API，不访问浏览器凭据或真实数据库。 */
function hgTestPage(api, messages) {
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
      if (path.endsWith("hg_message_page")) return { hgMessage: { success: (text) => messages.push(text) } };
      if (path.endsWith("hg_access_evaluator")) return { hgEvaluateAccess: () => ({ allowed: true }) };
      if (path.endsWith("hg_iam_provider")) return { HGIAMContext: React.createContext(null) };
      if (path.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: {
        NOTIFICATION_TEMPLATE_CREATE: "notification:template:create",
        NOTIFICATION_TEMPLATE_UPDATE: "notification:template:update",
        NOTIFICATION_TEMPLATE_DELETE: "notification:template:delete",
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

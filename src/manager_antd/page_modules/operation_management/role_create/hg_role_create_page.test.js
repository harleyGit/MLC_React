import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { hgSelectNotificationTemplatePermissions, HG_NOTIFICATION_TEMPLATE_PERMISSIONS } from "./hg_role_permission_presets.js";

const HG_TEST_SOURCE = new URL("./hg_role_create_page.jsx", import.meta.url); // 创建、编辑共用页面的真实源码。
const INITIAL_VALUES = {
  code: "",
  name: "",
  description: "",
  permissions: [],
};

/** 组件替身只承接真实页面生成的 props，不启动 DOM 或网络。 */
const HGTestComponent = () => null;

/** 编译真实页面并注入可控 VM；消息、返回和请求均保留在测试进程内。 */
function hgRoleFormPage(props, vmOverrides = {}, messages = []) {
  const module = { exports: {} };
  const code = transformSync(readFileSync(HG_TEST_SOURCE, "utf8"), {
    filename: "hg_role_create_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const vm = {
    getFormRules: () => ({
      code: [],
      name: [],
      description: [],
      permissions: [],
      mfaCode: [{ pattern: /^\d{6}$/, message: "请输入 6 位 MFA 验证码" }],
    }),
    transformSubmitData: (values) => values,
    fetchPermissions: async () => ({ list: [], selected: [] }),
    submitRole: async () => ({}),
    submitRoleEdit: async () => ({}),
    permissionsChanged: (before, after) => JSON.stringify([...before].sort()) !== JSON.stringify([...after].sort()),
    selectNotificationTemplatePermissions: hgSelectNotificationTemplatePermissions,
    ...vmOverrides,
  };
  runInNewContext(code, {
    module,
    exports: module.exports,
    React,
    URLSearchParams,
    require: (dependency) => {
      if (dependency === "react") return React;
      if (dependency.endsWith("hg_form_page")) {
        return {
          HGFormPage: HGTestComponent,
          HGFormItem: HGTestComponent,
        };
      }
      if (dependency.endsWith("hg_message_page")) {
        return {
          hgMessage: {
            success: (text) => messages.push(text),
            error: (text) => messages.push(text),
          },
        };
      }
      if (dependency.endsWith("hg_role_create_vm")) {
        return {
          default: vm,
          INITIAL_ROLE_CREATE_FORM_VALUES: INITIAL_VALUES,
          __esModule: true,
        };
      }
      if (dependency.endsWith(".module.css")) return { default: {} };
      return { default: HGTestComponent, __esModule: true };
    },
  });
  const page = new module.exports.default(props);
  page.setState = (update, callback) => {
    const patch =
      typeof update === "function" ? update(page.state, page.props) : update;
    page.state = { ...page.state, ...patch };
    callback?.();
  };
  return page;
}

test("创建模式始终使用空白初始值", () => {
  const page = hgRoleFormPage({ selectedKey: "role_create" });
  assert.deepEqual(
    JSON.parse(JSON.stringify(page.getInitialFormValues())),
    INITIAL_VALUES
  );
  assert.equal(page.getEditRole(), null);
});

test("创建角色页从 IAM 目录预选通知模板权限，不改变已选项也不自动提交", async () => {
  const messages = [];
  const selected = [];
  const page = hgRoleFormPage({ selectedKey: "role_create" }, {
    fetchPermissions: async () => ({
      list: HG_NOTIFICATION_TEMPLATE_PERMISSIONS.map((code) => ({ code, description: code })),
      selected: [],
    }),
  }, messages);
  page.formRef.current = {
    getFieldValue: () => ["iam:role:read"],
    setFieldsValue: (values) => selected.push(values),
  };
  await page.componentDidMount();
  page.handleNotificationTemplatePreset();
  assert.deepEqual(JSON.parse(JSON.stringify(selected.at(-1))), {
    permissions: ["iam:role:read", ...HG_NOTIFICATION_TEMPLATE_PERMISSIONS],
  });
  assert.match(messages.at(-1), /另一名管理员审批/);
});

test("编辑模式核对 URL 角色 ID，并回填基础信息与服务端已选权限", async () => {
  const calls = [];
  const formValues = [];
  const page = hgRoleFormPage(
    {
      selectedKey: "role_edit",
      location: {
        search: "?menu=role_edit&roleId=101",
        state: {
          role: {
            id: "101",
            code: "content_editor",
            name: "内容编辑",
            description: "维护内容",
          },
        },
      },
    },
    {
      fetchPermissions: async (roleId) => {
        calls.push(roleId);
        return {
          list: [{ code: "video:read", description: "查看视频" }],
          selected: ["video:read"],
        };
      },
    }
  );
  page.formRef.current = {
    setFieldsValue: (values) => formValues.push(values),
  };

  assert.deepEqual(JSON.parse(JSON.stringify(page.getInitialFormValues())), {
    code: "content_editor",
    name: "内容编辑",
    description: "维护内容",
    permissions: [],
  });
  await page.componentDidMount();
  assert.deepEqual(calls, ["101"]);
  assert.deepEqual(JSON.parse(JSON.stringify(page.state.initialPermissions)), [
    "video:read",
  ]);
  assert.deepEqual(JSON.parse(JSON.stringify(formValues)), [
    { permissions: ["video:read"] },
  ]);
});

test("编辑提交先弹 MFA 确认，输入正确后才携带角色 ID 和权限快照请求", async () => {
  const submissions = [];
  const messages = [];
  let backs = 0;
  const page = hgRoleFormPage(
    {
      selectedKey: "role_edit",
      location: {
        search: "?menu=role_edit&roleId=101",
        state: {
          role: {
            id: "101",
            code: "content_editor",
            name: "内容编辑",
            description: "",
          },
        },
      },
      onBack: () => {
        backs += 1;
      },
    },
    {
      submitRoleEdit: async (values, initialPermissions) => {
        submissions.push([values, initialPermissions]);
        return { approvalId: "approval-1" };
      },
    },
    messages
  );
  page.state.permissionsLoading = false;
  page.state.initialPermissions = ["video:read"];

  page.handleFinish({
    code: "content_editor",
    name: "内容主管",
    description: "维护内容",
    permissions: ["video:write"],
  });
  assert.deepEqual(submissions, [], "点击保存尚未调用接口");
  assert.equal(page.renderMFAModal().props.visible, true);
  assert.equal(page.state.mfaCode, "");
  page.handleConfirmSubmit();
  assert.deepEqual(submissions, [], "缺少 MFA 时不调用接口");
  assert.match(page.state.mfaError, /6 位 MFA/);
  page.renderMFAField().props.children[0].props.children[1].props.onChange({ target: { value: "12a3456" } });
  assert.equal(page.state.mfaCode, "123456");
  assert.equal(page.state.mfaError, "");
  await page.handleConfirmSubmit();
  assert.deepEqual(JSON.parse(JSON.stringify(submissions)), [
    [
      {
        id: "101",
        code: "content_editor",
        name: "内容主管",
        description: "维护内容",
        permissions: ["video:write"],
        mfaCode: "123456",
      },
      ["video:read"],
    ],
  ]);
  assert.deepEqual(messages, ["角色已更新，权限申请 approval-1 待审批"]);
  assert.equal(backs, 1);
  assert.equal(page.renderMFAModal().props.visible, false);
  assert.equal(page.state.mfaCode, "");
});

test("创建角色取消确认只关闭弹窗并清空验证码，重新保存必须重新输入", () => {
  const submissions = [];
  const page = hgRoleFormPage({ selectedKey: "role_create" }, {
    submitRole: async (data) => { submissions.push(data); return {}; },
  });
  page.state.permissionsLoading = false;
  const values = { code: "editor", name: "编辑", description: "", permissions: ["video:read"] };
  page.handleFinish(values);
  const modal = page.renderMFAModal();
  assert.equal(modal.props.visible, true);
  page.state.mfaCode = "123456";
  modal.props.onCancel();
  assert.equal(page.state.pendingSubmitData, null);
  assert.equal(page.state.mfaCode, "");
  assert.deepEqual(submissions, []);
  page.handleFinish(values);
  assert.equal(page.state.mfaCode, "");
  page.state.mfaCode = "654321";
  page.renderMFAModal().props.onClose();
  assert.deepEqual(submissions, []);
  assert.equal(page.state.mfaCode, "");
});

test("创建角色选择权限时确认前不发请求，确认后仅使用弹窗内的 MFA", async () => {
  const submissions = [];
  const page = hgRoleFormPage({ selectedKey: "role_create" }, {
    submitRole: async (data) => { submissions.push(data); return { approvalId: "approval-2" }; },
  });
  page.state.permissionsLoading = false;
  page.handleFinish({
    code: "editor", name: "编辑", description: "", permissions: ["video:read"],
    mfaCode: "000000", // 旧主表单值不能绕开弹窗或作为申请人的验证码。
  });
  assert.equal(submissions.length, 0);
  assert.equal(page.state.pendingSubmitData.mfaCode, "");
  page.handleConfirmSubmit();
  assert.equal(submissions.length, 0);
  page.state.mfaCode = "654321";
  await page.handleConfirmSubmit();
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].mfaCode, "654321");
});

test("创建空权限角色仍先弹确认，但不要求不会被验证的 MFA", async () => {
  const submissions = [];
  const page = hgRoleFormPage({ selectedKey: "role_create" }, {
    submitRole: async (data) => { submissions.push(data); return {}; },
  });
  page.state.permissionsLoading = false;
  page.handleFinish({ code: "reader", name: "只读", description: "", permissions: [] });
  assert.deepEqual(submissions, []);
  const modal = page.renderMFAModal();
  assert.equal(modal.props.visible, true);
  assert.equal(page.renderMFAField().props.children[0].props.children[1].props.disabled, true);
  await modal.props.onOk();
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0].mfaCode, "");
});

test("编辑仅更新基础信息也要确认，但不发送无需验证的 MFA", async () => {
  const submissions = [];
  const page = hgRoleFormPage({
    selectedKey: "role_edit",
    location: {
      search: "?roleId=101",
      state: { role: { id: "101", code: "editor", name: "编辑", description: "" } },
    },
  }, {
    submitRoleEdit: async (data, initial) => {
      submissions.push([data, initial]);
      return {};
    },
  });
  page.state.permissionsLoading = false;
  page.state.initialPermissions = ["video:read"];
  page.handleFinish({ code: "editor", name: "新名称", description: "", permissions: ["video:read"] });
  assert.deepEqual(submissions, []);
  assert.equal(page.renderMFAField().props.children[0].props.children[1].props.disabled, true);
  await page.handleConfirmSubmit();
  assert.equal(submissions.length, 1);
  assert.equal(submissions[0][0].mfaCode, "");
});

test("重复点击确认仅提交一次，失败清除验证码且保留主表单草稿", async () => {
  let calls = 0;
  let rejectRequest;
  const messages = [];
  const page = hgRoleFormPage({ selectedKey: "role_create" }, {
    submitRole: () => {
      calls += 1;
      return new Promise((_, reject) => { rejectRequest = reject; });
    },
  }, messages);
  page.state.permissionsLoading = false;
  page.handleFinish({ code: "reader", name: "只读", description: "", permissions: ["video:read"] });
  page.state.mfaCode = "123456";
  const pending = page.handleConfirmSubmit();
  page.handleConfirmSubmit();
  page.handleCancelSubmit();
  assert.equal(calls, 1);
  assert.equal(page.state.mfaCode, "");
  assert.equal(page.state.pendingSubmitData, null);
  rejectRequest(new Error("服务端拒绝"));
  await pending;
  assert.deepEqual(messages, ["服务端拒绝"]);
  assert.equal(page.state.submitting, false);
});

test("编辑 URL 与回填角色不一致时拒绝展示表单", () => {
  const page = hgRoleFormPage({
    selectedKey: "role_edit",
    location: {
      search: "?menu=role_edit&roleId=101",
      state: { role: { id: "102", code: "other", name: "其他角色" } },
    },
  });
  page.componentDidMount();
  assert.match(page.state.loadError, /缺少有效的角色回填数据/);
  const card = React.Children.toArray(page.render().props.children)[1];
  assert.equal(card.props.children.type, "p");
  assert.equal(card.props.children.props.role, "alert");
});

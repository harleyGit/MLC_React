import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

const HGTestButton = () => null; // 保留按钮回调，不触达 DOM 或真实 IAM。
const HGTestInput = () => null; // 保留目标用户输入的 onChange/value 协议。
const HGTestModal = () => null; // 检查弹窗显隐与关闭回调，不访问真实 DOM。

/** 转换当前员工角色页；授权查询/撤销已经迁移，替身只提供申请与独立审批队列。 */
function hgEmployeePage(vm) {
  const module = { exports: {} }; // 当前隔离页面模块。
  const code = transformSync(readFileSync(new URL("./hg_employee_role_page.jsx", import.meta.url), "utf8"), {
    filename: "hg_employee_role_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const messages = { errors: [], successes: [] }; // 不保存验证码，仅记录用户反馈。
  runInNewContext(code, {
    module, exports: module.exports, React,
    require: (path) => {
      if (path === "react") return React;
      if (path.endsWith("hg_employee_role_vm")) return {
        __esModule: true, INITIAL_BINDING_FORM: { userId: "", roleId: "", scopeType: "global", scopeId: "", expiresAt: "", mfaCode: "" },
        default: { fetchRolePermissions: async () => ({ list: [], selected: [] }), ...vm },
      };
      if (path.endsWith("hg_button_page")) return { __esModule: true, default: HGTestButton };
      if (path.endsWith("hg_permission")) return { HGAuthButton: HGTestButton };
      if (path.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: { IAM_GRANT: "iam:role:grant", IAM_APPROVE: "iam:approval:approve" } };
      if (path.endsWith("hg_input_page")) return { __esModule: true, default: HGTestInput };
      if (path.endsWith("hg_modal_page")) return { __esModule: true, default: HGTestModal };
      if (path.endsWith(".module.css")) return { __esModule: true, default: {} };
      if (path.endsWith("hg_message_page")) return {
        hgMessage: { error: (text) => messages.errors.push(text), success: (text) => messages.successes.push(text) },
      };
      return { __esModule: true, default: () => null };
    },
  });
  const page = new module.exports.default({}); // 测试中手动控制挂载/状态更新。
  page.hgMounted = true;
  page.setState = (update) => {
    const previous = page.state; // 用真实生命周期检测切换角色后的权限重新加载。
    page.state = { ...page.state, ...(typeof update === "function" ? update(page.state) : update) };
    page.componentDidUpdate({}, previous);
  };
  return { page, messages };
}

/** 收集 JSX 节点供断言，不渲染组件真实 DOM。 */
function hgFind(node, predicate, results = []) {
  if (Array.isArray(node)) node.forEach((item) => hgFind(item, predicate, results));
  else if (React.isValidElement(node)) {
    if (predicate(node)) results.push(node);
    hgFind(node.props.children, predicate, results);
  }
  return results;
}

/** 读取可见文案供空态/错误断言。 */
function hgText(node) {
  if (Array.isArray(node)) return node.map(hgText).join(" ");
  if (React.isValidElement(node)) return hgText(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

/** 等待 Promise 链完成，不依赖固定睡眠。 */
const hgFlush = () => new Promise((resolve) => setImmediate(resolve));

test("员工角色页删除目标授权查询区，仅保留目标输入、新授权申请及独立审批队列", () => {
  const { page } = hgEmployeePage({});
  assert.equal(page.renderUserLookup, undefined);
  assert.equal(page.loadAssignments, undefined);
  assert.equal(page.renderBindings, undefined);
  assert.equal(page.hgSelectBinding, undefined);
  const input = hgFind(page.renderGrantForm(), (node) => node.type === HGTestInput && node.props.id === "hg-iam-user-id")[0];
  assert.ok(input);
  input.props.onChange({ target: { value: "hgid_A" } });
  assert.equal(page.state.form.userId, "hgid_A");
  assert.match(hgText(page.render()), /待审批授权/);
  assert.doesNotMatch(hgText(page.render()), /查询角色授权|加载目标授权|查看回填/);
});

test("左上角按钮打开授权弹窗，关闭清除 MFA 且提交中不能关闭", () => {
  const { page } = hgEmployeePage({});
  assert.equal(hgFind(page.render(), (node) => node.type === HGTestModal).length, 0);
  const button = hgFind(page.render(), (node) => node.type === HGTestButton && hgText(node) === "分配管理员角色权限")[0];
  assert.ok(button);
  button.props.onClick();
  let modal = hgFind(page.render(), (node) => node.type === HGTestModal)[0];
  assert.equal(modal.props.title, "分配管理员角色权限");
  assert.ok(hgFind(modal, (node) => node.type === HGTestInput && node.props.id === "hg-iam-user-id").length);
  page.setField("userId", "hgid_A");
  page.setField("mfaCode", "123456");
  page.hgGranting = true;
  page.setState({ granting: true });
  modal = hgFind(page.render(), (node) => node.type === HGTestModal)[0];
  assert.equal(modal.props.closable, false);
  modal.props.onClose();
  assert.equal(page.state.grantModalVisible, true);
  page.hgGranting = false;
  page.setState({ granting: false });
  modal.props.onClose();
  assert.equal(hgFind(page.render(), (node) => node.type === HGTestModal).length, 0);
  assert.equal(page.state.form.userId, "hgid_A");
  assert.equal(page.state.form.mfaCode, "");
});

test("申请表单的业务权限仍只展示所选角色权限，旧角色响应不可覆盖", async () => {
  const resolves = new Map(); // 按角色控制返回顺序，不发真实请求。
  const { page } = hgEmployeePage({
    fetchRolePermissions: (roleId) => new Promise((resolve) => resolves.set(roleId, resolve)),
  });
  page.setField("roleId", "11");
  page.setField("roleId", "12");
  resolves.get("11")({ list: [{ code: "iam:role:grant", description: "授予" }], selected: ["iam:role:grant"] });
  await hgFlush();
  assert.equal(page.state.hgRolePermissions.length, 0);
  resolves.get("12")({ list: [{ code: "asset:read", description: "资产读取" }, { code: "asset:write", description: "资产写入" }], selected: ["asset:read"] });
  await hgFlush();
  assert.equal(page.state.hgRolePermissions.length, 1);
  assert.equal(page.state.hgRolePermissions[0].code, "asset:read");
});

test("新授权申请保留 MFA、作用域校验与并发锁；服务端负责跨页重复授权校验", async () => {
  let resolveGrant; // 保留提交中的请求以验证重复点击。
  const grants = []; // 只记录目标和角色 ID，不保存 MFA。
  const { page, messages } = hgEmployeePage({
    grant: async (form) => {
      grants.push([form.userId, form.roleId]);
      return new Promise((resolve) => { resolveGrant = resolve; });
    },
    fetchApprovals: async () => ({ list: [] }),
  });
  page.setField("userId", "hgid_A");
  page.setField("roleId", "11");
  await page.grantRole();
  assert.equal(grants.length, 0);
  assert.match(messages.errors.at(-1), /MFA/);
  page.setField("mfaCode", "123456");
  const submitting = page.grantRole();
  await page.grantRole();
  assert.deepEqual(grants, [["hgid_A", "11"]]);
  resolveGrant({ approvalId: "9" });
  await submitting;
  await hgFlush();
  assert.equal(page.state.form.roleId, "");
  assert.equal(page.state.form.userId, "hgid_A");
  assert.match(messages.successes.at(-1), /等待另一名管理员审批/);
});

test("授权申请按后端 MFA 与目标业务码 toast 提示，失败时只清除已提交动态码", async () => {
  for (const [code, expected] of [
    [404009, /尚未绑定 MFA/],
    [404010, /MFA 尚未启用/],
    [404011, /验证码错误或已过期/],
    [404012, /验证码已使用/],
    [404013, /次数过多/],
    [404014, /目标不是活动管理员/],
    [300004, /无权执行此操作/],
  ]) {
    const { page, messages } = hgEmployeePage({
      grant: async () => { throw { type: "HTTP_ERROR", code, message: "无权执行此操作" }; },
    });
    page.setField("userId", "TARGET");
    page.setField("roleId", "8");
    page.setField("mfaCode", "123456");
    await page.grantRole();
    assert.match(messages.errors.at(-1), expected);
    assert.equal(messages.errors.length, 1);
    assert.equal(page.state.form.mfaCode, "");
    assert.equal(page.state.form.userId, "TARGET");
    assert.equal(page.state.form.roleId, "8");
  }
});

test("独立审批队列仍能使用本人 MFA 裁决，并在成功后刷新队列", async () => {
  const decisions = []; // 仅记录申请编号和裁决方向，不记录验证码。
  let reads = 0; // 审批后应刷新一次首页。
  const { page, messages } = hgEmployeePage({
    fetchApprovals: async () => { reads += 1; return { list: [{ id: "8", applicantId: "actor", action: "iam.binding.grant", expiresAt: "2026-12-01T00:00:00Z" }] }; },
    decideApproval: async (id, _mfaCode, approve) => { decisions.push([id, approve]); },
  });
  page.loadApprovals(0);
  await hgFlush();
  page.decideQueueApproval("8", true);
  assert.equal(decisions.length, 0);
  assert.match(messages.errors.at(-1), /MFA/);
  page.setState({ queueApprovalCode: "123456" });
  page.decideQueueApproval("8", true);
  await hgFlush();
  assert.deepEqual(decisions, [["8", true]]);
  assert.equal(page.state.queueApprovalCode, "");
  assert.equal(reads, 2);
});

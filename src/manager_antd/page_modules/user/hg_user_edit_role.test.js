import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

const HGTestButton = () => null; // 只承载按钮的点击回调，不渲染真实 DOM。

/** 本地转换真实页面，替换请求与路由能力，不触达真实用户资料或授权服务。 */
function hgEditRolePage(hgBindings, hgUpdates, hgGrants, hgPending = async () => ({ list: [], hasMore: false })) {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_user_edit_role_page.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_user_edit_role_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    React,
    window: { history: { length: 0 } },
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency.endsWith("HttpManagerV1")) return { handleError: () => {} };
      if (hgDependency.endsWith("hg_naviagion_hook")) return { WithNavigation: (hgPage) => hgPage };
      if (hgDependency.endsWith("hg_employee_role_vm")) return {
        INITIAL_BINDING_FORM: { userId: "", roleId: "", scopeType: "global", scopeId: "", expiresAt: "", mfaCode: "" },
        default: { fetchBindings: hgBindings, fetchPendingGrants: hgPending, grant: hgGrants },
        __esModule: true,
      };
      if (hgDependency.endsWith("hg_user_vm")) return { default: { updateUserByUserId: hgUpdates }, __esModule: true };
      if (hgDependency.endsWith("hg_button_page")) return { default: HGTestButton, __esModule: true };
      if (hgDependency.endsWith("hg_message_page")) return { hgMessage: { error: () => {}, success: () => {} } };
      if (hgDependency.endsWith(".module.css")) return { default: {}, __esModule: true };
      return { default: () => null, __esModule: true };
    },
  });
  const hgPage = new hgModule.exports.default({ params: { userId: "staff-1" }, location: { state: { user: { nickname: "员工" } } } });
  hgPage.hgMounted = true;
  hgPage.setState = (hgUpdate) => {
    hgPage.state = { ...hgPage.state, ...(typeof hgUpdate === "function" ? hgUpdate(hgPage.state) : hgUpdate) };
  };
  return hgPage;
}

/** 查找组件树中所有指定的轻量按钮替身。 */
function hgButtons(hgNode, hgResult = []) {
  if (Array.isArray(hgNode)) {
    hgNode.forEach((hgItem) => hgButtons(hgItem, hgResult));
  } else if (React.isValidElement(hgNode)) {
    if (hgNode.type === HGTestButton) hgResult.push(hgNode);
    hgButtons(hgNode.props.children, hgResult);
  }
  return hgResult;
}

/** 定位回填角色 select，核对未加载到角色选项时仍有已授权角色的只读展示。 */
function hgRoleSelect(hgNode) {
  if (Array.isArray(hgNode)) {
    for (const hgItem of hgNode) {
      const hgFound = hgRoleSelect(hgItem);
      if (hgFound) return hgFound;
    }
  } else if (React.isValidElement(hgNode)) {
    if (hgNode.type === "select" && hgNode.props.id === "hg-iam-role-id") return hgNode;
    return hgRoleSelect(hgNode.props.children);
  }
  return null;
}

/** 从轻量 JSX 树读取可见文案，确认状态与申请编号不混淆。 */
function hgText(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgText).join(" ");
  if (React.isValidElement(hgNode)) return hgText(hgNode.props.children);
  return typeof hgNode === "string" || typeof hgNode === "number" ? String(hgNode) : "";
}

/** 等待请求 Promise 链（then/finally）完成；不使用固定睡眠。 */
const hgFlush = () => new Promise((resolve) => setImmediate(resolve));

test("查询到多条已授权绑定后逐条手动回填；保存资料不会重复授予", async () => {
  const hgExisting = [
    { id: "binding-1", roleId: "101", roleCode: "viewer", scopeType: "global", scopeId: "", expiresAt: null },
    { id: "binding-2", roleId: "202", roleCode: "editor", scopeType: "shop", scopeId: "shop-9", expiresAt: "2026-12-01T10:30:00Z" },
  ];
  let hgUpdateCount = 0;
  let hgGrantCount = 0;
  const hgPage = hgEditRolePage(
    async () => ({ list: hgExisting, hasMore: false }),
    async () => { hgUpdateCount += 1; },
    async () => { hgGrantCount += 1; }
  );
  hgPage.loadBindings(0);
  await Promise.resolve();
  assert.equal(hgPage.state.bindings.length, 2);
  assert.equal(hgPage.state.form.roleId, "");
  const hgChoices = hgButtons(hgPage.renderBindings());
  assert.equal(hgChoices.length, 4);
  hgChoices[2].props.onClick();
  assert.equal(hgPage.state.form.roleId, "202");
  assert.equal(hgPage.state.form.scopeType, "shop");
  assert.equal(hgPage.state.form.scopeId, "shop-9");
  assert.equal(new Date(hgPage.state.form.expiresAt).getTime(), new Date(hgExisting[1].expiresAt).getTime());
  assert.equal(hgPage.state.form.mfaCode, "");
  assert.equal(hgPage.state.hgSelectedBindingId, "binding-2");
  const hgRole = hgRoleSelect(hgPage.renderGrantForm());
  assert.equal(hgRole.props.disabled, true);
  assert.equal(hgRole.props.value, "202");
  assert.ok(hgRole.props.children.some((hgOption) => hgOption?.props?.value === "202"));
  assert.equal(hgPage.validateGrant().skip, true);
  await hgPage.handleSubmit();
  assert.equal(hgUpdateCount, 1);
  assert.equal(hgGrantCount, 0);
  hgPage.hgClearBindingSelection();
  assert.equal(hgPage.state.form.roleId, "");
  assert.equal(hgPage.state.hgSelectedBindingId, "");
  hgPage.setField("roleId", "303");
  hgPage.setField("mfaCode", "123456");
  await hgPage.handleSubmit();
  assert.equal(hgUpdateCount, 2);
  assert.equal(hgGrantCount, 1);
});

test("新授权不可重复选择已授权的角色与作用域，切换用户会清除回填", async () => {
  const hgPage = hgEditRolePage(async () => ({ list: [
    { id: "binding-1", roleId: "101", roleCode: "viewer", scopeType: "global", scopeId: "", expiresAt: null },
  ] }), async () => {}, async () => {});
  hgPage.loadBindings(0);
  await Promise.resolve();
  hgPage.hgSelectBinding(hgPage.state.bindings[0]);
  hgPage.hgClearBindingSelection();
  hgPage.setField("roleId", "101");
  hgPage.setField("mfaCode", "123456");
  assert.equal(hgPage.validateGrant().valid, false);
  hgPage.setField("userId", "staff-2");
  assert.equal(hgPage.state.form.userId, "staff-2");
  assert.equal(hgPage.state.form.roleId, "");
  assert.equal(hgPage.state.form.mfaCode, "");
  assert.equal(hgPage.state.bindings.length, 0);
});

test("切换查询用户后忽略旧用户授权响应", async () => {
  let hgResolve;
  const hgPage = hgEditRolePage(() => new Promise((resolve) => { hgResolve = resolve; }), async () => {}, async () => {});
  hgPage.loadBindings(0);
  hgPage.setField("userId", "staff-2");
  hgResolve({ list: [{ id: "old", roleId: "101", roleCode: "viewer", scopeType: "global", scopeId: "" }] });
  await Promise.resolve();
  assert.equal(hgPage.state.bindings.length, 0);
  assert.equal(hgPage.state.form.userId, "staff-2");
});

test("待审批回执刷新后仍在合并列表，不能当作生效绑定撤销或回填", async () => {
  let hgPending = [];
  const hgGrants = [];
  const hgFetchPending = async (hgUserId) => {
    assert.equal(hgUserId, "staff-1");
    return { list: hgPending, hasMore: false };
  };
  const hgPage = hgEditRolePage(
    async () => ({ list: [], hasMore: false }),
    async () => {},
    async (hgForm) => {
      hgGrants.push(hgForm);
      hgPending = [{ approvalId: "5", roleId: hgForm.roleId, scopeType: "global", scopeId: "", expiresAt: null, status: "pending" }];
      return { approvalId: "5", status: "pending" };
    },
    hgFetchPending
  );
  hgPage.loadAssignments();
  await hgFlush();
  hgPage.setField("roleId", "11");
  hgPage.setField("mfaCode", "123456");
  await hgPage.handleSubmit();
  await hgFlush();
  assert.equal(hgGrants.length, 1);
  assert.equal(hgPage.state.form.roleId, "");
  assert.equal(hgPage.state.bindings.length, 0);
  assert.equal(hgPage.state.pendingGrants[0].approvalId, "5");
  assert.match(hgText(hgPage.renderBindings()), /待审批/);
  assert.match(hgText(hgPage.renderBindings()), /申请 #\s*5/);
  assert.equal(hgButtons(hgPage.renderBindings()).length, 0);
  const hgReloaded = hgEditRolePage(async () => ({ list: [] }), async () => {}, async () => {}, hgFetchPending);
  hgReloaded.loadAssignments(); // 模拟重新进入页面：无本地回执时仍按目标 ID 查到申请。
  await hgFlush();
  assert.equal(hgReloaded.state.pendingGrants[0].roleId, "11");
  hgPage.setField("roleId", "11");
  assert.equal(hgPage.validateGrant().valid, false);
});

test("两个来源分别分页，审批通过后刷新显示为已授权而非待审批", async () => {
  let hgApproved = false;
  const hgBindingCursors = [];
  const hgPendingCursors = [];
  const hgPage = hgEditRolePage(
    async (_hgUserId, hgCursor) => {
      hgBindingCursors.push(hgCursor);
      return { list: hgApproved ? [{ id: "100", roleId: "11", roleCode: "viewer", scopeType: "global", scopeId: "" }] : [], hasMore: !hgApproved && !hgCursor, nextCursor: "99" };
    }, async () => {}, async () => {},
    async (_hgUserId, hgCursor) => {
      hgPendingCursors.push(hgCursor);
      return { list: hgApproved ? [] : [{ approvalId: hgCursor ? "4" : "5", roleId: "11", scopeType: "global", scopeId: "", status: "pending" }], hasMore: !hgApproved && !hgCursor, nextCursor: hgCursor ? "4" : "5" };
    }
  );
  hgPage.loadAssignments();
  await hgFlush();
  assert.equal(hgPage.state.hasMoreBindings, true);
  assert.equal(hgPage.state.hasMorePending, true);
  hgPage.loadBindings(hgPage.state.nextBindingCursor);
  hgPage.loadPendingGrants(hgPage.state.nextPendingCursor);
  await hgFlush();
  assert.equal(hgPage.state.pendingGrants.length, 2);
  assert.equal(hgBindingCursors[1], "99");
  assert.equal(hgPendingCursors[1], "5");
  hgApproved = true;
  hgPage.loadAssignments();
  await hgFlush();
  assert.equal(hgPage.state.pendingGrants.length, 0);
  assert.equal(hgPage.state.bindings.length, 1);
  assert.match(hgText(hgPage.renderBindings()), /已授权/);
  assert.doesNotMatch(hgText(hgPage.renderBindings()), /待审批/);
});

test("切换用户或刷新后迟到的待审批响应不能覆盖新查询", async () => {
  const hgResolvers = [];
  const hgPage = hgEditRolePage(async () => ({ list: [] }), async () => {}, async () => {},
    () => new Promise((resolve) => { hgResolvers.push(resolve); }));
  hgPage.loadPendingGrants();
  hgPage.setField("userId", "staff-2");
  hgPage.loadPendingGrants();
  hgResolvers[0]({ list: [{ approvalId: "old", roleId: "11" }] });
  await hgFlush();
  assert.equal(hgPage.state.pendingGrants.length, 0);
  hgPage.loadPendingGrants();
  hgResolvers[1]({ list: [{ approvalId: "stale", roleId: "11" }] });
  hgResolvers[2]({ list: [{ approvalId: "new", roleId: "12" }] });
  await hgFlush();
  assert.equal(hgPage.state.pendingGrants[0].approvalId, "new");
});

test("待审批查询失败必须显示错误，不能显示无授权空态", async () => {
  const hgPage = hgEditRolePage(async () => ({ list: [] }), async () => {}, async () => {}, async () => { throw new Error("unavailable"); });
  hgPage.loadAssignments();
  await hgFlush();
  assert.match(hgText(hgPage.renderBindings()), /待审批角色查询失败/);
  assert.doesNotMatch(hgText(hgPage.renderBindings()), /暂无已授权或待审批角色/);
});

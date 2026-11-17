import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

const HGTestButton = () => null; // 只承载按钮的点击回调，不渲染真实 DOM。
const HGTestTable = () => null; // 保存真实 HGTablePage 的 columns/dataSource 配置供断言，不渲染 DOM。

/** 本地转换真实页面，替换请求与路由能力，不触达真实用户资料或授权服务。 */
function hgEditRolePage(hgBindings, hgGrants, hgPending = async () => ({ list: [], hasMore: false }), hgDecide = async () => {}, hgFetchPermissions = async () => ({ list: [], selected: [] })) {
  const hgModule = { exports: {} };
  const hgMessages = { errors: [], successes: [] }; // 本地消息替身；仅用于检查失败/成功反馈，不收集验证码。
  const hgSource = readFileSync(new URL("./hg_employee_role_page.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_employee_role_page.jsx",
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
        default: { fetchBindings: hgBindings, fetchPendingGrants: hgPending, fetchRolePermissions: hgFetchPermissions, fetchApprovals: async () => ({ list: [] }), grant: hgGrants, decideApproval: hgDecide },
        __esModule: true,
      };
      if (hgDependency.endsWith("hg_button_page")) return { default: HGTestButton, __esModule: true };
      if (hgDependency.endsWith("hg_table_page")) return { default: HGTestTable, __esModule: true };
      if (hgDependency.endsWith("hg_message_page")) return { hgMessage: { error: (text) => hgMessages.errors.push(text), success: (text) => hgMessages.successes.push(text) } };
      if (hgDependency.endsWith(".module.css")) return { default: {}, __esModule: true };
      return { default: () => null, __esModule: true };
    },
  });
  const hgPage = new hgModule.exports.default({});
  hgPage.hgMounted = true;
  hgPage.setState = (hgUpdate) => {
    const hgPreviousState = hgPage.state; // 模拟 React 更新后生命周期，触发角色变更时的权限同步。
    hgPage.state = { ...hgPage.state, ...(typeof hgUpdate === "function" ? hgUpdate(hgPage.state) : hgUpdate) };
    hgPage.componentDidUpdate({}, hgPreviousState);
  };
  hgPage.setField("userId", "staff-1");
  hgPage.hgMessages = hgMessages;
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

/** 从合并列表中取 HGTablePage 的真实行和列渲染结果，避免把按钮计数误当作业务行为。 */
function hgTable(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgTable).find(Boolean);
  if (!React.isValidElement(hgNode)) return null;
  if (hgNode.type === HGTestTable) return hgNode;
  return hgTable(hgNode.props.children);
}

function hgCell(hgNode, hgRowKey, hgTitle) {
  const hgProps = hgTable(hgNode)?.props;
  const hgRecord = hgProps?.dataSource.find((hgRow) => hgRow.hgRowKey === hgRowKey); // 唯一行 key 保留绑定/申请类型前缀。
  const hgColumn = hgProps?.columns.find((hgCol) => hgCol.title === hgTitle); // 精确列标题；不存在时测试失败。
  assert.ok(hgRecord && hgColumn, `找不到 ${hgRowKey} 的 ${hgTitle} 列`);
  return hgColumn.render(hgRecord[hgColumn.dataIndex], hgRecord);
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

/** 定位授权表单的业务权限下拉，核对它只展示当前角色的已生效权限。 */
function hgPermissionSelect(hgNode) {
  if (Array.isArray(hgNode)) {
    for (const hgItem of hgNode) {
      const hgFound = hgPermissionSelect(hgItem);
      if (hgFound) return hgFound;
    }
  } else if (React.isValidElement(hgNode)) {
    if (hgNode.type === "select" && hgNode.props.id === "hg-iam-role-permission") return hgNode;
    return hgPermissionSelect(hgNode.props.children);
  }
  return null;
}

/** 从轻量 JSX 树读取可见文案，确认状态与申请编号不混淆。 */
function hgText(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgText).join(" ");
  if (React.isValidElement(hgNode)) {
    if (hgNode.type === HGTestTable) return hgNode.props.dataSource.map((hgRow) =>
      hgNode.props.columns.map((hgCol) => hgText(hgCol.render(hgRow[hgCol.dataIndex], hgRow))).join(" ")
    ).join(" ");
    return hgText(hgNode.props.children);
  }
  return typeof hgNode === "string" || typeof hgNode === "number" ? String(hgNode) : "";
}

/** 等待请求 Promise 链（then/finally）完成；不使用固定睡眠。 */
const hgFlush = () => new Promise((resolve) => setImmediate(resolve));

test("业务权限仅展示所选角色已生效权限；切换角色后旧请求不可覆盖", async () => {
  const hgResolvers = new Map(); // 按角色保存请求完成函数，用于模拟交错返回。
  const hgPage = hgEditRolePage(async () => ({ list: [] }), async () => {}, undefined, undefined,
    (hgRoleId) => new Promise((resolve) => { hgResolvers.set(hgRoleId, resolve); }));
  assert.equal(hgPermissionSelect(hgPage.renderGrantForm()).props.disabled, true);
  hgPage.setField("roleId", "101");
  assert.equal(hgPermissionSelect(hgPage.renderGrantForm()).props.disabled, true);
  hgPage.setField("roleId", "202");
  hgResolvers.get("101")({ list: [{ code: "iam:role:read", description: "读取角色" }], selected: ["iam:role:read"] });
  await hgFlush();
  assert.equal(hgPage.state.hgRolePermissions.length, 0);
  hgResolvers.get("202")({ list: [
    { code: "video:submission:publish", description: "发布视频" },
    { code: "iam:role:grant", description: "授予角色" },
  ], selected: ["video:submission:publish"] });
  await hgFlush();
  const hgSelect = hgPermissionSelect(hgPage.renderGrantForm());
  assert.equal(hgSelect.props.disabled, false);
  assert.deepEqual(hgSelect.props.children.flat().filter(Boolean).map((hgOption) => hgOption.props.value), ["", "video:submission:publish"]);
  hgSelect.props.onChange({ target: { value: "video:submission:publish" } });
  assert.equal(hgPage.state.hgSelectedPermission, "video:submission:publish");
  hgPage.setField("roleId", "");
  assert.equal(hgPage.state.hgSelectedPermission, "");
  assert.equal(hgPage.state.hgRolePermissions.length, 0);
  assert.equal(hgPermissionSelect(hgPage.renderGrantForm()).props.disabled, true);
});

test("业务权限查询失败显示错误与重试，已有绑定回填也按角色加载", async () => {
  const hgCalls = []; // 记录请求使用的角色 ID，避免将绑定 ID 当作权限查询参数。
  const hgPage = hgEditRolePage(async () => ({ list: [] }), async () => {}, undefined, undefined,
    async (hgRoleId) => {
      hgCalls.push(hgRoleId);
      if (hgCalls.length === 1) throw new Error("unavailable");
      return { list: [{ code: "iam:role:read", description: "读取角色" }], selected: ["iam:role:read"] };
    });
  hgPage.hgSelectBinding({ id: "binding-7", roleId: "7", roleCode: "viewer", scopeType: "global" });
  await hgFlush();
  assert.match(hgText(hgPage.renderGrantForm()), /业务权限加载失败，请重试/);
  assert.equal(hgPermissionSelect(hgPage.renderGrantForm()).props.disabled, true);
  const hgRetry = hgButtons(hgPage.renderGrantForm()).find((hgButton) => hgText(hgButton) === "重试");
  hgRetry.props.onClick();
  await hgFlush();
  assert.deepEqual(hgCalls, ["7", "7"]);
  assert.equal(hgPermissionSelect(hgPage.renderGrantForm()).props.disabled, false);
  assert.equal(hgPage.validateGrant().valid, false);
});

test("查询到多条已授权绑定后逐条手动回填；查看时不能重复授予", async () => {
  const hgExisting = [
    { id: "binding-1", roleId: "101", roleCode: "viewer", scopeType: "global", scopeId: "", expiresAt: null },
    { id: "binding-2", roleId: "202", roleCode: "editor", scopeType: "shop", scopeId: "shop-9", expiresAt: "2026-12-01T10:30:00Z" },
  ];
  let hgGrantCount = 0;
  const hgPage = hgEditRolePage(
    async () => ({ list: hgExisting, hasMore: false }),
    async () => { hgGrantCount += 1; }
  );
  hgPage.loadBindings(0);
  await Promise.resolve();
  assert.equal(hgPage.state.bindings.length, 2);
  assert.equal(hgPage.state.form.roleId, "");
  const hgTableNode = hgTable(hgPage.renderBindings());
  assert.equal(hgTableNode.props.rowKey, "hgRowKey");
  assert.equal(hgTableNode.props.pagination, false);
  assert.equal(hgTableNode.props.dataSource.length, 2);
  const hgChoices = hgButtons(hgCell(hgPage.renderBindings(), "binding-binding-2", "操作"));
  assert.equal(hgChoices.length, 2);
  hgChoices[0].props.onClick();
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
  assert.equal(hgPage.validateGrant().valid, false);
  await hgPage.grantRole();
  assert.equal(hgGrantCount, 0);
  hgPage.hgClearBindingSelection();
  assert.equal(hgPage.state.form.roleId, "");
  assert.equal(hgPage.state.hgSelectedBindingId, "");
  hgPage.setField("roleId", "303");
  hgPage.setField("mfaCode", "123456");
  await hgPage.grantRole();
  assert.equal(hgGrantCount, 1);
});

test("新授权不可重复选择已授权的角色与作用域，切换用户会清除回填", async () => {
  const hgPage = hgEditRolePage(async () => ({ list: [
    { id: "binding-1", roleId: "101", roleCode: "viewer", scopeType: "global", scopeId: "", expiresAt: null },
  ] }), async () => {});
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

test("授权申请独立提交，不选角色或缺少 MFA 不发请求；并发点击只提交一次", async () => {
  let hgResolveGrant; // 手动结束请求以覆盖重复点击窗口。
  const hgGrants = []; // 仅记录目标和角色，验证码不写入测试结果。
  const hgPage = hgEditRolePage(async () => ({ list: [] }), (hgForm) => {
    hgGrants.push([hgForm.userId, hgForm.roleId]);
    return new Promise((resolve) => { hgResolveGrant = resolve; });
  });
  await hgPage.grantRole();
  hgPage.setField("roleId", "11");
  await hgPage.grantRole();
  assert.equal(hgGrants.length, 0);
  hgPage.setField("mfaCode", "123456");
  const hgSubmitting = hgPage.grantRole();
  await hgPage.grantRole();
  assert.deepEqual(hgGrants, [["staff-1", "11"]]);
  assert.equal(hgPage.state.granting, true);
  hgResolveGrant({ approvalId: "9" });
  await hgSubmitting;
  assert.equal(hgPage.state.granting, false);
  assert.equal(hgPage.state.form.roleId, "");
});

test("切换查询用户后忽略旧用户授权响应", async () => {
  let hgResolve;
  const hgPage = hgEditRolePage(() => new Promise((resolve) => { hgResolve = resolve; }), async () => {});
  hgPage.loadBindings(0);
  hgPage.setField("userId", "staff-2");
  hgResolve({ list: [{ id: "old", roleId: "101", roleCode: "viewer", scopeType: "global", scopeId: "" }] });
  await Promise.resolve();
  assert.equal(hgPage.state.bindings.length, 0);
  assert.equal(hgPage.state.form.userId, "staff-2");
});

test("待审批回执刷新后仍在合并列表，仅有允许和拒绝而无撤销回填", async () => {
  let hgPending = [];
  const hgGrants = [];
  const hgFetchPending = async (hgUserId) => {
    assert.equal(hgUserId, "staff-1");
    return { list: hgPending, hasMore: false };
  };
  const hgPage = hgEditRolePage(
    async () => ({ list: [], hasMore: false }),
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
  await hgPage.grantRole();
  await hgFlush();
  assert.equal(hgGrants.length, 1);
  assert.equal(hgPage.state.form.roleId, "");
  assert.equal(hgPage.state.bindings.length, 0);
  assert.equal(hgPage.state.pendingGrants[0].approvalId, "5");
  assert.match(hgText(hgPage.renderBindings()), /待审批/);
  assert.match(hgText(hgPage.renderBindings()), /申请 #\s*5/);
  const hgPendingActions = hgCell(hgPage.renderBindings(), "approval-5", "操作");
  assert.equal(hgButtons(hgPendingActions).length, 2);
  assert.match(hgText(hgPendingActions), /允许/);
  assert.match(hgText(hgPendingActions), /拒绝/);
  assert.doesNotMatch(hgText(hgPendingActions), /撤销|回填/);
  const hgReloaded = hgEditRolePage(async () => ({ list: [] }), async () => {}, hgFetchPending);
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
    }, async () => {},
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
  const hgPage = hgEditRolePage(async () => ({ list: [] }), async () => {},
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
  const hgPage = hgEditRolePage(async () => ({ list: [] }), async () => {}, async () => { throw new Error("unavailable"); });
  hgPage.loadAssignments();
  await hgFlush();
  assert.match(hgText(hgPage.renderBindings()), /待审批角色查询失败/);
  assert.doesNotMatch(hgText(hgPage.renderBindings()), /暂无已授权或待审批角色/);
});

test("审批允许使用独立 MFA、只提交申请编号，成功后刷新为已授权", async () => {
  let hgApproved = false;
  const hgDecisions = [];
  const hgPage = hgEditRolePage(
    async () => ({ list: hgApproved ? [{ id: "binding-9", roleId: "11", roleCode: "viewer", scopeType: "global" }] : [] }),
    async () => {},
    async () => ({ list: hgApproved ? [] : [{ approvalId: "5", roleId: "11", scopeType: "global" }] }),
    async (hgId, hgCode, hgApprove) => {
      hgDecisions.push([hgId, hgCode, hgApprove]);
      hgApproved = true;
    }
  );
  hgPage.loadAssignments();
  await hgFlush();
  hgPage.setField("mfaCode", "654321"); // 申请人 MFA 不能充当审批验证码。
  await hgPage.decideApproval(hgPage.state.pendingGrants[0], true);
  assert.equal(hgDecisions.length, 0);
  assert.match(hgPage.hgMessages.errors.at(-1), /审批人的 6 位 MFA/);
  hgPage.setState({ approvalCode: "123456" });
  await hgButtons(hgCell(hgPage.renderBindings(), "approval-5", "操作"))[0].props.onClick();
  await hgFlush();
  assert.deepEqual(hgDecisions, [["5", "123456", true]]);
  assert.equal(hgPage.state.approvalCode, "");
  assert.equal(hgPage.state.pendingGrants.length, 0);
  assert.equal(hgPage.state.bindings[0].id, "binding-9");
  assert.match(hgText(hgPage.renderBindings()), /已授权/);
});

test("拒绝不生效、同一申请只发送一次；失败时不伪造结果", async () => {
  let hgResolveDecision;
  const hgDecisions = [];
  let hgRejected = false;
  const hgPage = hgEditRolePage(
    async () => ({ list: [] }), async () => {},
    async () => ({ list: hgRejected ? [] : [{ approvalId: "5", roleId: "11", scopeType: "global" }] }),
    (hgId, hgCode, hgApprove) => {
      hgDecisions.push([hgId, hgCode, hgApprove]);
      return new Promise((resolve) => { hgResolveDecision = resolve; });
    }
  );
  hgPage.loadAssignments();
  await hgFlush();
  hgPage.setState({ approvalCode: "123456" });
  const hgReject = hgPage.decideApproval(hgPage.state.pendingGrants[0], false);
  await hgPage.decideApproval(hgPage.state.pendingGrants[0], true);
  assert.deepEqual(hgDecisions, [["5", "123456", false]]);
  assert.equal(hgPage.state.approvalCode, "");
  assert.equal(hgButtons(hgCell(hgPage.renderBindings(), "approval-5", "操作"))[1].props.disabled, true);
  hgRejected = true;
  hgResolveDecision();
  await hgReject;
  await hgFlush();
  assert.equal(hgPage.state.bindings.length, 0);
  assert.equal(hgPage.state.pendingGrants.length, 0);

  const hgFailed = hgEditRolePage(async () => ({ list: [] }), async () => {},
    async () => ({ list: [{ approvalId: "6", roleId: "11", scopeType: "global" }] }),
    async () => { throw new Error("审批权限不足"); });
  hgFailed.loadAssignments();
  await hgFlush();
  hgFailed.setState({ approvalCode: "222222" });
  await hgFailed.decideApproval(hgFailed.state.pendingGrants[0], true);
  assert.equal(hgFailed.state.pendingGrants.length, 1);
  assert.equal(hgFailed.state.bindings.length, 0);
  assert.equal(hgFailed.state.approvalCode, "");
  assert.match(hgFailed.hgMessages.errors.at(-1), /审批权限不足/);
});

test("裁决完成前切换用户时不刷新新用户列表，也不保留审批验证码", async () => {
  let hgResolveDecision;
  const hgPendingUsers = [];
  const hgPage = hgEditRolePage(async () => ({ list: [] }), async () => {},
    async (hgUserId) => { hgPendingUsers.push(hgUserId); return { list: [{ approvalId: "5", roleId: "11" }] }; },
    () => new Promise((resolve) => { hgResolveDecision = resolve; }));
  hgPage.loadAssignments();
  await hgFlush();
  hgPage.setState({ approvalCode: "123456" });
  const hgDecision = hgPage.decideApproval(hgPage.state.pendingGrants[0], true);
  hgPage.setField("userId", "staff-2");
  assert.equal(hgPage.state.approvalCode, "");
  hgResolveDecision();
  await hgDecision;
  assert.deepEqual(hgPendingUsers, ["staff-1"]);
  assert.equal(hgPage.state.pendingGrants.length, 0);
});

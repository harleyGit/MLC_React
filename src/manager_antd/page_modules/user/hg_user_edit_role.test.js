import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

const HGTestTable = () => null; // 只保留真实 HGTablePage 的列和数据以测试用户交互，不操作 DOM。
const HGTestButton = () => null; // 捕获点击回调，不发送真实授权请求。

/** 转换真实编辑页并隔离 IAM 与用户请求，不使用登录状态或真实管理员数据。 */
function hgUserEditPage(hgUpdate, hgRoleVM = {}) {
  const hgModule = { exports: {} }; // JSX 模块替身，仅用于取得页面类。
  const hgMessages = []; // 资料保存反馈；不保存个人资料或验证码。
  const hgSource = readFileSync(new URL("./hg_user_edit_role_page.jsx", import.meta.url), "utf8"); // 当前真实页面源码。
  const hgCode = transformSync(hgSource, {
    filename: "hg_user_edit_role_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code; // Node 测试环境下的 JSX 转换产物，仅保存在内存。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    React,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency.endsWith("HttpManagerV1")) return { handleError: (error) => { throw error; } };
      if (hgDependency.endsWith("hg_naviagion_hook")) return { WithNavigation: (hgPage) => hgPage };
      if (hgDependency.endsWith("hg_user_vm")) return { default: { updateUserByUserId: hgUpdate }, __esModule: true };
      if (hgDependency.endsWith("hg_user_role_assign_vm")) return { default: hgRoleVM, __esModule: true };
      if (hgDependency.endsWith("hg_message_page")) return { hgMessage: { success: (text) => hgMessages.push(text), error: (text) => hgMessages.push(text) } };
      if (hgDependency.endsWith("hg_table_page")) return { default: HGTestTable, __esModule: true };
      if (hgDependency.endsWith("hg_button_page")) return { default: HGTestButton, __esModule: true };
      return { default: () => null, __esModule: true };
    },
  });
  const hgPage = new hgModule.exports.default({ params: { userId: "route-7" }, location: { state: { user: { user_id: "stale-9", nickname: "员工" } } } }); // 路由目标优先于列表回填 ID。
  hgPage.hgMounted = true;
  hgPage.setState = (hgUpdateState, hgCallback) => {
    hgPage.state = { ...hgPage.state, ...(typeof hgUpdateState === "function" ? hgUpdateState(hgPage.state) : hgUpdateState) };
    hgCallback?.();
  };
  return { hgPage, hgMessages };
}

test("资料保存使用路由目标 ID，且不触发独立角色授权请求", async () => {
  const hgCalls = []; // 仅记录目标与昵称以确认用户资料更新的范围。
  const { hgPage, hgMessages } = hgUserEditPage(async (hgPayload) => {
    hgCalls.push({ userId: hgPayload.userId, nickname: hgPayload.nickname });
  });
  await hgPage.handleSubmit();
  assert.deepEqual(hgCalls, [{ userId: "route-7", nickname: "员工" }]);
  assert.deepEqual(hgMessages, ["用户资料已更新"]);
  assert.equal(hgPage.state.saving, false);
  assert.equal(hgPage.renderUserLookup, undefined);
  assert.equal(hgPage.renderGrantForm, undefined);
  assert.equal(typeof hgPage.renderRoleAssignment, "function");
});

/** 在页面 JSX 中查找表格替身；断言只有真实绑定与手动新增行出现。 */
function hgFindTable(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgFindTable).find(Boolean);
  if (!React.isValidElement(hgNode)) return null;
  if (hgNode.type === HGTestTable) return hgNode;
  return hgFindTable(hgNode.props.children);
}

const hgFlush = () => new Promise((resolve) => setImmediate(resolve)); // 等待 Promise 链清空，无固定睡眠。

test("先读取有界角色目录再按路由 user_id 查询绑定；无绑定时不显示已授权行", async () => {
  const hgCalls = []; // 只记录调用顺序与目标 ID。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => { hgCalls.push("roles"); return { list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }; },
    fetchBindings: async (hgUserId) => { hgCalls.push(hgUserId); return { list: [] }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  assert.deepEqual(hgCalls, ["roles", "route-7"]);
  assert.equal(hgFindTable(hgPage.renderRoleAssignment()) ?? null, null);
  hgPage.hgToggleAssignRow();
  const hgTable = hgFindTable(hgPage.renderRoleAssignment());
  assert.equal(hgTable.props.rowKey, "hgRowKey");
  assert.equal(hgTable.props.dataSource.length, 1);
  assert.equal(hgTable.props.dataSource[0].hgIsNew, true);
});

test("选择角色联动只读业务权限与作用域，保存时仅提交角色绑定并刷新生效记录", async () => {
  const hgRequests = []; // 不保留 MFA 明文，只记录目标、角色及作用域。
  let hgActive = false; // 模拟服务端授权前后活动绑定变化。
  const { hgPage, hgMessages } = hgUserEditPage(async () => { throw new Error("角色授权不应写用户资料"); }, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: hgActive ? [{ id: "18", roleId: "7", roleCode: "reviewer", scopeType: "shop", scopeId: "shop-1" }] : [] }),
    fetchRolePermissions: async () => ({ list: [
      { code: "mall:product:create", description: "创建商品" }, { code: "iam:role:grant", description: "授予角色" },
    ], selected: ["mall:product:create"] }),
    grantDirect: async (hgForm) => {
      hgRequests.push([hgForm.userId, hgForm.roleId, hgForm.scopeType, hgForm.scopeId]);
      hgActive = true;
      return { granted: true };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgToggleAssignRow();
  const hgRoleColumn = hgFindTable(hgPage.renderRoleAssignment()).props.columns.find((item) => item.title === "角色");
  const hgNew = hgFindTable(hgPage.renderRoleAssignment()).props.dataSource[0];
  hgRoleColumn.render(null, hgNew).props.onChange({ target: { value: "7" } });
  await hgFlush();
  assert.deepEqual(hgPage.state.hgPermissions.map((item) => item.code), ["mall:product:create"]);
  hgPage.setState({ hgScopeType: "shop", hgScopeId: "shop-1", hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  await hgFlush();
  assert.deepEqual(hgRequests, [["route-7", "7", "shop", "shop-1"]]);
  assert.ok(hgMessages.includes("角色已立即生效"));
  assert.equal(hgPage.state.hgMFACode, "");
  assert.equal(hgPage.state.hgShowAssignRow, false);
  assert.equal(hgFindTable(hgPage.renderRoleAssignment()).props.dataSource[0].hgRowKey, "binding-18");
});

test("切换角色时拒绝过期权限响应，重复授权或无效 MFA 不发送写请求", async () => {
  const hgResolvers = new Map(); // 人工安排权限查询响应顺序，不依赖网络或时钟。
  let hgWrites = 0; // 统计授权请求次数，不记录一次性验证码。
  const { hgPage, hgMessages } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7" }, { id: "8" }], truncated: false }),
    fetchBindings: async () => ({ list: [{ id: "18", roleId: "8", scopeType: "global", scopeId: "" }] }),
    fetchRolePermissions: (hgRoleId) => new Promise((resolve) => { hgResolvers.set(hgRoleId, resolve); }),
    grantDirect: async () => { hgWrites += 1; return { granted: true }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgToggleAssignRow();
  hgPage.hgSelectRole("7", true);
  hgPage.hgSelectRole("8", true);
  hgResolvers.get("7")({ list: [{ code: "iam:role:grant" }], selected: ["iam:role:grant"] });
  await hgFlush();
  assert.equal(hgPage.state.hgPermissions.length, 0);
  hgResolvers.get("8")({ list: [{ code: "mall:product:create" }], selected: ["mall:product:create"] });
  await hgFlush();
  hgPage.setState({ hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  assert.equal(hgWrites, 0);
  assert.ok(hgMessages.includes("该角色在此作用域已生效"));
  hgPage.hgSelectRole("7", true);
  hgResolvers.get("7")({ list: [], selected: [] });
  await hgFlush();
  hgPage.setState({ hgMFACode: "123" });
  await hgPage.hgSubmitRole();
  assert.equal(hgWrites, 0);
});

test("同一页面实例切换用户时清空旧角色与 MFA，旧请求不得覆盖新用户", async () => {
  let hgResolveBindings; // 老用户绑定查询尚未完成时切换路由。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7" }], truncated: false }),
    fetchBindings: (hgId) => hgId === "route-7"
      ? new Promise((resolve) => { hgResolveBindings = resolve; })
      : Promise.resolve({ list: [] }),
  });
  await hgPage.hgLoadRolesAndBindings();
  hgPage.setState({ hgMFACode: "123456", hgShowAssignRow: true });
  const hgOldProps = hgPage.props; // 模拟 WithNavigation 因路由参数变化更新同一个类组件实例。
  hgPage.props = { params: { userId: "route-8" }, location: { state: { user: { user_id: "route-8", nickname: "新用户" } } } };
  hgPage.componentDidUpdate(hgOldProps);
  hgResolveBindings({ list: [{ id: "old", roleId: "7" }] });
  await hgFlush();
  assert.equal(hgPage.userId, "route-8");
  assert.equal(hgPage.state.hgMFACode, "");
  assert.equal(hgPage.state.hgShowAssignRow, false);
  assert.deepEqual(hgPage.state.hgBindings, []);
  assert.equal(hgPage.state.profileForm.nickname, "新用户");
});

test("角色目录重复加载时忽略较早响应，分配期间已有绑定的权限入口不覆盖待分配角色", async () => {
  let hgResolveOldRoles; // 同一目标第一次角色目录请求稍后返回。
  let hgRoleFetches = 0; // 只在新角色目录完成后读取绑定。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: () => ++hgRoleFetches === 1
      ? new Promise((resolve) => { hgResolveOldRoles = resolve; })
      : Promise.resolve({ list: [{ id: "7", name: "可用角色", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: [{ id: "1", roleId: "8", roleCode: "old", scopeType: "global", scopeId: "" }] }),
    fetchRolePermissions: async () => ({ list: [], selected: [] }),
  });
  const hgOldRequest = hgPage.hgLoadRolesAndBindings();
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgResolveOldRoles({ list: [{ id: "9", name: "过期角色" }], truncated: false });
  await hgOldRequest;
  assert.deepEqual(hgPage.state.hgRoles.map((role) => role.id), ["7"]);
  hgPage.hgToggleAssignRow();
  hgPage.hgSelectRole("7", true);
  await hgFlush();
  const hgTable = hgFindTable(hgPage.renderRoleAssignment());
  const hgExisting = hgTable.props.dataSource.find((item) => !item.hgIsNew);
  const hgPermissionColumn = hgTable.props.columns.find((item) => item.title.startsWith("业务权限"));
  assert.equal(hgPermissionColumn.render(null, hgExisting).props.children, "分配完成后可查看");
  assert.equal(hgPage.state.hgPermissionRoleId, "7");
});

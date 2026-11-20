import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

const HGTestCollectionView = () => null; // 只保留真实 HGCollectionView 的数据与 renderCell 以测试用户交互，不操作 DOM。
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
      if (hgDependency.endsWith("hg_user_role_assign_vm")) return { default: { fetchScopeTypes: async () => ({ list: [
        { code: "global", name: "平台全局", status: 1 }, { code: "shop", name: "店铺", status: 1 }, { code: "org", name: "组织", status: 1 },
      ], hasMore: false }), ...hgRoleVM }, __esModule: true };
      if (hgDependency.endsWith("hg_message_page")) return { hgMessage: { success: (text) => hgMessages.push(text), error: (text) => hgMessages.push(text) } };
      if (hgDependency.endsWith("hg_collection_view")) return { default: HGTestCollectionView, __esModule: true };
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

/** 在页面 JSX 中查找卡片列表替身；断言只有真实绑定与手动新增行出现。 */
function hgFindCollectionView(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgFindCollectionView).find(Boolean);
  if (!React.isValidElement(hgNode)) return null;
  if (hgNode.type === HGTestCollectionView) return hgNode;
  return hgFindCollectionView(hgNode.props.children);
}

/** 按 aria-label 查找卡片内的控件，用于触发与旧表格列相同的交互。 */
function hgFindByAriaLabel(hgNode, hgLabel) {
  if (Array.isArray(hgNode)) return hgNode.map((child) => hgFindByAriaLabel(child, hgLabel)).find(Boolean);
  if (!React.isValidElement(hgNode)) return null;
  if (hgNode.props?.["aria-label"] === hgLabel) return hgNode;
  return hgFindByAriaLabel(hgNode.props.children, hgLabel);
}

/** 在卡片 JSX 中查找指定文本，用于断言只读文案与按钮。 */
function hgFindText(hgNode, hgText) {
  if (Array.isArray(hgNode)) return hgNode.map((child) => hgFindText(child, hgText)).find(Boolean);
  if (!React.isValidElement(hgNode)) return null;
  if (hgNode.props.children === hgText) return hgNode;
  return hgFindText(hgNode.props.children, hgText);
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
  assert.equal(hgFindCollectionView(hgPage.renderRoleAssignment()) ?? null, null);
  hgPage.hgToggleAssignRow();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  assert.equal(hgCollection.props.getKey(hgCollection.props.items[0]), "new-assignment");
  assert.equal(hgCollection.props.items.length, 1);
  assert.equal(hgCollection.props.items[0].hgIsNew, true);
  assert.equal(hgCollection.props.onRefresh, hgPage.hgLoadBindings); // 顶部下拉即刷新绑定，替代独立刷新按钮。
});

test("多选角色联动只读业务权限，一次 MFA 原子提交并刷新生效记录", async () => {
  const hgRequests = []; // 不保留 MFA 明文，只记录目标、角色及作用域。
  let hgActive = false; // 模拟服务端授权前后活动绑定变化。
  const { hgPage, hgMessages } = hgUserEditPage(async () => { throw new Error("角色授权不应写用户资料"); }, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: hgActive ? [{ id: "18", roleId: "7", roleCode: "reviewer", scopeType: "shop", scopeId: "shop-1" }] : [] }),
    fetchRolePermissions: async () => ({ list: [
      { code: "mall:product:create", description: "创建商品" }, { code: "iam:role:grant", description: "授予角色" },
    ], selected: ["mall:product:create"] }),
    grantDirectBatch: async (hgForm) => {
      hgRequests.push([hgForm.userId, hgForm.bindings]);
      hgActive = true;
      return { granted: true };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgToggleAssignRow();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgNew = hgCollection.props.items[0];
  const hgDraftCard = hgCollection.props.renderCell(hgNew, 0);
  hgFindByAriaLabel(hgDraftCard, "分配角色（可多选）").props.children.props.onChange(["7"]);
  await hgFlush();
  assert.equal(hgPage.state.hgPermissions.map((item) => item.code).join(","), "mall:product:create");
  hgPage.hgSelectScopeTypes(["shop"]);
  hgPage.setState({ hgScopeIDs: { shop: "shop-1" }, hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  await hgFlush();
  assert.equal(JSON.stringify(hgRequests), JSON.stringify([["route-7", [{ roleId: "7", scopeType: "shop", scopeId: "shop-1" }]]]));
  assert.ok(hgMessages.includes("角色已立即生效"));
  assert.equal(hgPage.state.hgMFACode, "");
  assert.equal(hgPage.state.hgShowAssignRow, false);
  assert.equal(hgFindCollectionView(hgPage.renderRoleAssignment()).props.items[0].hgRowKey, "binding-18");
});

test("作用域类型显示全部目录项（含 status=0）且可提交，下拉项只显示名称", async () => {
  const hgAllScopes = ["global", "shop", "org", "team", "dept"]; // 超过旧的三种上限，且含 status=0。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchScopeTypes: async () => ({ list: [
      { code: "global", name: "平台全局", status: 1 }, { code: "shop", name: "店铺", status: 1 },
      { code: "org", name: "组织", status: 1 }, { code: "team", name: "团队", status: 0 },
      { code: "dept", name: "部门", status: 0 },
    ], hasMore: false }),
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  assert.deepEqual(hgPage.state.hgScopeCatalog.map((item) => item.code), hgAllScopes); // status=0 的项也进入目录。
  hgPage.hgToggleAssignRow();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgDraftCard = hgCollection.props.renderCell(hgCollection.props.items[0], 0);
  const hgScopeTree = hgFindByAriaLabel(hgDraftCard, "作用域类型（可多选）").props.children;
  assert.deepEqual(hgScopeTree.props.treeData.map((item) => item.title), ["平台全局", "店铺", "组织", "团队", "部门"]);
  hgScopeTree.props.onChange(hgAllScopes);
  assert.deepEqual(hgPage.state.hgScopeTypes, hgAllScopes);
});

test("status=0 的作用域类型选中后可完成授权提交", async () => {
  const hgRequests = []; // 记录实际提交的作用域类型，不保留 MFA 明文。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchScopeTypes: async () => ({ list: [
      { code: "global", name: "平台全局", status: 1 }, { code: "region", name: "业务区域", status: 0 },
    ], hasMore: false }),
    fetchRolePermissions: async () => ({ list: [], selected: [] }),
    grantDirectBatch: async (hgForm) => { hgRequests.push(hgForm.bindings); return { granted: true }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgToggleAssignRow();
  hgPage.hgSelectRoles(["7"]);
  await hgFlush();
  hgPage.hgSelectScopeTypes(["region"]);
  hgPage.setState({ hgScopeIDs: { region: "region-1" }, hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  assert.equal(JSON.stringify(hgRequests), JSON.stringify([[{ roleId: "7", scopeType: "region", scopeId: "region-1" }]]));
});

test("切换角色时拒绝过期权限响应，重复授权或无效 MFA 不发送写请求", async () => {
  const hgResolvers = new Map(); // 人工安排权限查询响应顺序，不依赖网络或时钟。
  let hgWrites = 0; // 统计授权请求次数，不记录一次性验证码。
  const { hgPage, hgMessages } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7" }, { id: "8" }], truncated: false }),
    fetchBindings: async () => ({ list: [{ id: "18", roleId: "8", scopeType: "global", scopeId: "" }] }),
    fetchRolePermissions: (hgRoleId) => new Promise((resolve) => { hgResolvers.set(hgRoleId, resolve); }),
    grantDirectBatch: async () => { hgWrites += 1; return { granted: true }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgToggleAssignRow();
  hgPage.hgSelectRoles(["7"]);
  hgPage.hgSelectRoles(["8"]);
  hgResolvers.get("7")({ list: [{ code: "iam:role:grant" }], selected: ["iam:role:grant"] });
  await hgFlush();
  assert.equal(hgPage.state.hgPermissions.length, 0);
  hgResolvers.get("8")({ list: [{ code: "mall:product:create" }], selected: ["mall:product:create"] });
  await hgFlush();
  hgPage.hgSelectScopeTypes(["global"]);
  hgPage.setState({ hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  assert.equal(hgWrites, 0);
  assert.ok(hgMessages.includes("选中的角色与作用域中存在已生效绑定"));
  hgPage.hgSelectRoles(["7"]);
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
  hgPage.hgSelectRoles(["7"]);
  await hgFlush();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgExisting = hgCollection.props.items.find((item) => !item.hgIsNew);
  const hgExistingCard = hgCollection.props.renderCell(hgExisting, 0);
  assert.ok(hgFindText(hgExistingCard, "分配完成后可查看"));
  assert.equal(hgPage.state.hgPermissionRoleId, "7");
});

test("两个角色与两个作用域仅提交一次 MFA，权限只读取服务端并集", async () => {
  const hgCalls = []; // 只记录请求数量与绑定组合，不保留验证码。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", code: "reviewer" }, { id: "8", code: "operator" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchRolePermissions: async (id) => ({ list: [{ code: `test:permission:${id}` }], selected: [`test:permission:${id}`] }),
    grantDirectBatch: async (payload) => { hgCalls.push({ count: payload.bindings.length, types: payload.bindings.map((item) => item.scopeType), otpLength: payload.mfaCode.length }); return { granted: true }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgToggleAssignRow();
  hgPage.hgSelectRoles(["7", "8"]);
  await hgFlush();
  assert.equal(hgPage.state.hgPermissions.length, 2);
  hgPage.hgSelectScopeTypes(["global", "shop"]);
  hgPage.setState({ hgScopeIDs: { shop: "shop-1" }, hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  assert.equal(JSON.stringify(hgCalls), JSON.stringify([{ count: 4, types: ["global", "shop", "global", "shop"], otpLength: 6 }]));
  assert.equal(hgPage.state.hgMFACode, "");
});

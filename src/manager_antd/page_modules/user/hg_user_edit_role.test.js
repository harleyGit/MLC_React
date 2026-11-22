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
       if (hgDependency.endsWith("hg_user_role_assign_vm")) return { default: {
         fetchScopeResources: async (type) => ({ list: [{ id: `${type}-1`, name: `${type} 测试资源` }], hasMore: false }),
         fetchScopeTypes: async () => ({ list: [
         { code: "global", name: "平台全局", status: 1 }, { code: "shop", name: "店铺", status: 1 }, { code: "org", name: "组织", status: 1 },
       ], hasMore: false }), ...hgRoleVM }, __esModule: true };
      if (hgDependency.endsWith("hg_message_page")) return { hgMessage: { success: (text) => hgMessages.push(text), error: (text) => hgMessages.push(text) } };
      if (hgDependency.endsWith("hg_collection_view")) return { default: HGTestCollectionView, __esModule: true };
      if (hgDependency.endsWith("hg_button_page")) return { default: HGTestButton, __esModule: true };
      if (hgDependency.endsWith("hg_permission")) return { HGAuthButton: HGTestButton };
      if (hgDependency.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: { IAM_GRANT: "iam:role:grant", IAM_GRANT_DIRECT: "iam:role:grant_direct" } };
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

/** 在页面 JSX 中查找卡片列表替身；断言真实绑定与手动新增行分离。 */
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

/** 查找错误提示容器，验证权限失败与绑定空态不会混淆。 */
function hgFindByRole(hgNode, hgRole) {
  if (Array.isArray(hgNode)) return hgNode.map((child) => hgFindByRole(child, hgRole)).find(Boolean);
  if (!React.isValidElement(hgNode)) return null;
  if (hgNode.props.role === hgRole) return hgNode;
  return hgFindByRole(hgNode.props.children, hgRole);
}

const hgFlush = () => new Promise((resolve) => setImmediate(resolve)); // 等待 Promise 链清空，无固定睡眠。

test("独立读取角色目录与路由 user_id 的绑定；无绑定时不显示已授权行", async () => {
  const hgCalls = []; // 只记录调用顺序与目标 ID。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => { hgCalls.push("roles"); return { list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }; },
    fetchBindings: async (hgUserId) => { hgCalls.push(hgUserId); return { list: [] }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  assert.deepEqual(hgCalls, ["route-7", "roles"]);
  assert.equal(hgFindCollectionView(hgPage.renderRoleAssignment()) ?? null, null);
  assert.ok(hgFindText(hgPage.renderRoleAssignment(), "当前用户暂无已生效 IAM 角色绑定；普通账号身份不等于 IAM 授权。"));
  hgPage.hgAddDraft();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  assert.equal(hgCollection.props.getKey(hgCollection.props.items[0]), "draft-1");
  assert.equal(hgCollection.props.items.length, 1);
  assert.equal(hgCollection.props.items[0].hgIsNew, true);
  assert.equal(hgCollection.props.onRefresh, hgPage.hgLoadBindings); // 顶部下拉即刷新绑定，替代独立刷新按钮。
});

test("受限绑定不将共享角色的全部权限误展示为当前用户权限", async () => {
  let hgRolePermissionCalls = 0;
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: [{
      id: "18", roleId: "7", roleCode: "reviewer", scopeType: "global", scopeId: "", permissionsLimited: true,
    }] }),
    fetchRolePermissions: async () => { hgRolePermissionCalls += 1; return { list: [], selected: [] }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgCard = hgCollection.props.renderCell(hgCollection.props.items[0]);
  assert.ok(hgFindText(hgCard, "该绑定已单独限制权限；角色权限并非此用户实际权限，请以服务端授权为准"));
  assert.equal(hgRolePermissionCalls, 0);
});

test("单选角色默认选中该角色权限，底部保存弹一次 MFA 并刷新生效记录", async () => {
  const hgRequests = []; // 不保留 MFA 明文，只记录目标、角色及作用域。
  let hgActive = false; // 模拟服务端授权前后活动绑定变化。
  let hgProfileWrites = 0; // 资料应先于授权保存一次。
  const { hgPage, hgMessages } = hgUserEditPage(async () => { hgProfileWrites += 1; }, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: hgActive ? [{ id: "18", roleId: "7", roleCode: "reviewer", scopeType: "shop", scopeId: "shop-1" }] : [] }),
    fetchRolePermissions: async () => ({ list: [
      { code: "mall:product:create", description: "创建商品" }, { code: "iam:role:grant", description: "授予角色" },
    ], selected: ["mall:product:create"] }),
    grantDirectBatch: async (hgForm) => {
      hgRequests.push([hgForm.userId, hgForm.bindings, hgProfileWrites]);
      hgActive = true;
      return { granted: true };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgNew = hgCollection.props.items[0];
  const hgDraftCard = hgCollection.props.renderCell(hgNew, 0);
  const hgRoleTree = hgFindByAriaLabel(hgDraftCard, "分配角色（单选）").props.children;
  assert.equal(hgRoleTree.props.treeCheckable, undefined);
  hgRoleTree.props.onChange("7");
  await hgFlush();
  assert.equal(hgPage.state.hgDrafts[0].permissions.map((item) => item.code).join(","), "mall:product:create");
  hgPage.hgSelectScopeTypes("draft-1", ["shop"]);
  await hgFlush();
  assert.equal(hgPage.state.hgDrafts[0].scopeIDs.shop, "shop-1"); // 唯一候选自动填写，无需管理员复制 ID。
  const hgScopeCard = hgFindCollectionView(hgPage.renderRoleAssignment()).props;
  const hgScopeSelect = hgFindByAriaLabel(hgScopeCard.renderCell(hgScopeCard.items[0]), "shop 作用域 ID");
  assert.deepEqual(hgScopeSelect.props.children[1][0].props.value, "shop-1");
  hgScopeSelect.props.onChange({ target: { value: "shop-1" } });
  await hgPage.handleSubmit();
  assert.equal(hgPage.state.hgMFAVisible, true);
  assert.equal(hgProfileWrites, 0);
  hgPage.setState({ hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  await hgFlush();
  assert.equal(JSON.stringify(hgRequests), JSON.stringify([["route-7", [{ roleId: "7", scopeType: "shop", scopeId: "shop-1", permissions: ["mall:product:create"] }], 1]]));
  assert.ok(hgMessages.includes("用户资料已更新，角色已立即生效"));
  assert.equal(hgPage.state.hgMFACode, "");
  assert.equal(hgPage.state.hgDrafts.length, 0);
  assert.equal(hgFindCollectionView(hgPage.renderRoleAssignment()).props.items[0].hgRowKey, "binding-18");
});

test("目录保留停用类型，但只有服务端已支持的启用作用域可以选择", async () => {
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
  hgPage.hgAddDraft();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgDraftCard = hgCollection.props.renderCell(hgCollection.props.items[0], 0);
  const hgScopeTree = hgFindByAriaLabel(hgDraftCard, "作用域类型（可多选）").props.children;
  assert.deepEqual(hgScopeTree.props.treeData.map((item) => item.title), ["平台全局", "店铺", "组织"]);
  hgScopeTree.props.onChange(hgAllScopes);
  assert.deepEqual(hgPage.state.hgDrafts[0].scopeTypes, ["global", "shop", "org"]);
});

test("六类新作用域仅在字典启用后展示，候选 ID 从服务端资源登记读取", async () => {
  const hgTypes = ["creator", "organization", "environment", "crawler_project", "content_channel", "region"];
  const hgRequests = []; // 只记录查询类型，不生成或猜测资源 ID。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchScopeTypes: async () => ({ list: [
      { code: "global", name: "平台全局", status: 1 }, ...hgTypes.map((code) => ({ code, name: code, status: 1 })),
    ], hasMore: false }),
    fetchScopeResources: async (type) => { hgRequests.push(type); return { list: [{ id: `${type}-registered`, name: type }], hasMore: false }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgScopeTree = hgFindByAriaLabel(hgCollection.props.renderCell(hgCollection.props.items[0]), "作用域类型（可多选）").props.children;
  assert.deepEqual(Array.from(hgScopeTree.props.treeData, (item) => item.value), ["global", ...hgTypes]);
  hgPage.hgSelectScopeTypes("draft-1", hgTypes);
  await hgFlush();
  assert.deepEqual(hgRequests, hgTypes);
  assert.equal(hgPage.state.hgDrafts[0].scopeIDs.creator, "creator-registered");
});

test("停用或未接入授权的作用域不得通过构造草稿提交", async () => {
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
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-1", "7");
  await hgFlush();
  hgPage.hgSelectScopeTypes("draft-1", ["region"]);
  hgPage.hgUpdateDraft("draft-1", () => ({ scopeIDs: { region: "region-1" } }));
  await hgPage.handleSubmit();
  assert.equal(hgPage.state.hgMFAVisible, false);
  assert.equal(hgRequests.length, 0);
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
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-1", "7");
  hgPage.hgSelectRole("draft-1", "8");
  hgResolvers.get("7")({ list: [{ code: "iam:role:grant" }], selected: ["iam:role:grant"] });
  await hgFlush();
  assert.equal(hgPage.state.hgDrafts[0].permissions.length, 0);
  hgResolvers.get("8")({ list: [{ code: "mall:product:create" }], selected: ["mall:product:create"] });
  await hgFlush();
  hgPage.hgSelectScopeTypes("draft-1", ["global"]);
  await hgPage.handleSubmit();
  assert.equal(hgPage.state.hgMFAVisible, false);
  assert.equal(hgWrites, 0);
  assert.ok(hgMessages.includes("选中的角色与作用域中存在重复或已生效绑定"));
  hgPage.hgSelectRole("draft-1", "7");
  hgResolvers.get("7")({ list: [], selected: [] });
  await hgFlush();
  await hgPage.handleSubmit();
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
  hgPage.hgAddDraft();
  hgPage.setState({ hgMFACode: "123456", hgMFAVisible: true });
  const hgOldProps = hgPage.props; // 模拟 WithNavigation 因路由参数变化更新同一个类组件实例。
  hgPage.props = { params: { userId: "route-8" }, location: { state: { user: { user_id: "route-8", nickname: "新用户" } } } };
  hgPage.componentDidUpdate(hgOldProps);
  hgResolveBindings({ list: [{ id: "old", roleId: "7" }] });
  await hgFlush();
  assert.equal(hgPage.userId, "route-8");
  assert.equal(hgPage.state.hgMFACode, "");
  assert.equal(hgPage.state.hgMFAVisible, false);
  assert.equal(hgPage.state.hgDrafts.length, 0);
  assert.deepEqual(hgPage.state.hgBindings, []);
  assert.equal(hgPage.state.profileForm.nickname, "新用户");
});

test("角色目录重复加载时忽略较早响应，已有绑定权限与待分配权限相互独立", async () => {
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
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-1", "7");
  await hgFlush();
  const hgCollection = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgExisting = hgCollection.props.items.find((item) => !item.hgIsNew);
  const hgExistingCard = hgCollection.props.renderCell(hgExisting, 0);
  assert.ok(hgFindText(hgExistingCard, "该角色暂无业务权限"));
  assert.equal(hgPage.state.hgDrafts[0].roleId, "7");
});

test("已有绑定自动回填角色、作用域和已选业务权限；同角色多作用域只查询一次", async () => {
  const hgRoles = []; // 仅记录查询角色 ID，验证相同角色复用一次请求。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "审核员", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: [
      { id: "18", roleId: "7", scopeType: "shop", scopeId: "shop-1" },
      { id: "19", roleId: "7", scopeType: "org", scopeId: "org-1" },
    ] }),
    fetchRolePermissions: async (id) => {
      hgRoles.push(id);
      return { list: [
        { code: "video:submission:read", description: "读取投稿" },
        { code: "iam:role:grant", description: "管理授权" },
      ], selected: ["video:submission:read"] };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  assert.deepEqual(hgRoles, ["7"]);
  const hgList = hgFindCollectionView(hgPage.renderRoleAssignment());
  assert.equal(hgList.props.items.length, 2);
  const hgCard = hgList.props.renderCell(hgList.props.items[0], 0);
  assert.ok(hgFindText(hgCard, "审核员"));
  const hgScopeFields = hgCard.props.children[1].props.children.map((item) => item.props.children.join(""));
  assert.deepEqual(hgScopeFields, ["作用域类型 · shop", "作用域 ID · shop-1"]);
  const hgPermissions = hgFindByAriaLabel(hgCard, "该角色已生效的业务权限（仅查看）").props.children;
  assert.deepEqual(Array.from(hgPermissions.props.value), ["video:submission:read"]);
  assert.equal(hgPermissions.props.treeData[0].title, "读取投稿");
  assert.equal(hgPermissions.props.disabled, true);
});

test("目录故障不遮挡已生效绑定；权限查询失败可以按角色重试", async () => {
  let hgPermissionCalls = 0; // 第一次权限请求失败后，重试恢复，不影响绑定本身。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => { throw new Error("目录暂不可用"); },
    fetchBindings: async () => ({ list: [
      { id: "18", roleId: "7", roleCode: "reviewer", scopeType: "global", scopeId: "" },
    ] }),
    fetchRolePermissions: async () => {
      hgPermissionCalls += 1;
      if (hgPermissionCalls === 1) throw new Error("权限暂不可用");
      return { list: [{ code: "video:submission:read" }], selected: ["video:submission:read"] };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  assert.equal(hgPage.state.hgRolesError, "目录暂不可用");
  let hgList = hgFindCollectionView(hgPage.renderRoleAssignment());
  assert.equal(hgList.props.items.length, 1);
  let hgCard = hgList.props.renderCell(hgList.props.items[0], 0);
  assert.ok(hgFindText(hgCard, "reviewer"));
  assert.equal(hgFindByRole(hgCard, "alert").props.children[0], "权限暂不可用");
  const hgRetry = hgFindText(hgCard, "重试");
  hgRetry.props.onClick();
  await hgFlush();
  hgList = hgFindCollectionView(hgPage.renderRoleAssignment());
  hgCard = hgList.props.renderCell(hgList.props.items[0], 0);
  assert.ok(hgFindByAriaLabel(hgCard, "该角色已生效的业务权限（仅查看）"));
  assert.equal(hgPermissionCalls, 2);
});

test("绑定查询失败显示错误而不是无角色，并可重新读取", async () => {
  let hgBindingCalls = 0; // 首次绑定读取失败；重试后返回空列表。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [], truncated: false }),
    fetchBindings: async () => {
      if (++hgBindingCalls === 1) throw new Error("绑定暂不可用");
      return { list: [] };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  assert.equal(hgFindCollectionView(hgPage.renderRoleAssignment()) ?? null, null);
  assert.equal(hgFindByRole(hgPage.renderRoleAssignment(), "alert").props.children[0], "绑定暂不可用");
  assert.ok(!hgFindText(hgPage.renderRoleAssignment(), "当前用户暂无已生效 IAM 角色绑定；普通账号身份不等于 IAM 授权。"));
  const hgRetry = hgFindText(hgPage.renderRoleAssignment(), "重试");
  hgRetry.props.onClick();
  await hgFlush();
  assert.equal(hgBindingCalls, 2);
  assert.ok(hgFindText(hgPage.renderRoleAssignment(), "当前用户暂无已生效 IAM 角色绑定；普通账号身份不等于 IAM 授权。"));
});

test("刷新绑定后旧权限响应不能回填到新查询结果", async () => {
  let hgResolveOld; // 首次权限查询保持未完成，用于模拟刷新前的迟到响应。
  let hgPermissionCalls = 0; // 第二次权限查询立即返回新的角色权限。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [], truncated: false }),
    fetchBindings: async () => ({ list: [{ id: "18", roleId: "7", roleCode: "reviewer", scopeType: "global", scopeId: "" }] }),
    fetchRolePermissions: () => ++hgPermissionCalls === 1
      ? new Promise((resolve) => { hgResolveOld = resolve; })
      : Promise.resolve({ list: [{ code: "new:permission:read" }], selected: ["new:permission:read"] }),
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgLoadBindings(0);
  await hgFlush();
  hgResolveOld({ list: [{ code: "old:permission:read" }], selected: ["old:permission:read"] });
  await hgFlush();
  assert.deepEqual(Array.from(hgPage.state.hgBindingPermissions["7"].list.map((item) => item.code)), ["new:permission:read"]);
});

test("两个单选草稿与多个作用域仅提交一次 MFA，且重复点击不会重复授权", async () => {
  const hgCalls = []; // 只记录请求数量与绑定组合，不保留验证码。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", code: "reviewer" }, { id: "8", code: "operator" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchRolePermissions: async (id) => ({ list: [{ code: `test:permission:${id}` }], selected: [`test:permission:${id}`] }),
    grantDirectBatch: async (payload) => { hgCalls.push({ count: payload.bindings.length, roles: payload.bindings.map((item) => item.roleId), otpLength: payload.mfaCode.length }); return { granted: true }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-1", "7");
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-2", "8");
  await hgFlush();
  assert.equal(hgPage.state.hgDrafts.length, 2);
  assert.equal(hgPage.state.hgDrafts[0].permissions[0].code, "test:permission:7");
  assert.equal(hgPage.state.hgDrafts[1].permissions[0].code, "test:permission:8");
  hgPage.hgSelectScopeTypes("draft-1", ["global", "shop"]);
  await hgFlush();
  hgPage.hgUpdateDraft("draft-1", () => ({ scopeIDs: { shop: "shop-1" } }));
  hgPage.hgSelectScopeTypes("draft-2", ["global", "shop"]);
  await hgFlush();
  hgPage.hgUpdateDraft("draft-2", () => ({ scopeIDs: { shop: "shop-1" } }));
  const hgList = hgFindCollectionView(hgPage.renderRoleAssignment());
  assert.deepEqual(hgList.props.items.map((item) => item.hgRowKey), ["draft-1", "draft-2"]);
  await hgPage.handleSubmit();
  hgPage.setState({ hgMFACode: "123456" });
  await Promise.all([hgPage.hgSubmitRole(), hgPage.hgSubmitRole()]);
  assert.equal(JSON.stringify(hgCalls), JSON.stringify([{ count: 4, roles: ["7", "7", "8", "8"], otpLength: 6 }]));
  assert.equal(hgPage.state.hgMFACode, "");
 });

test("选择其他角色不新增草稿；追加和移除只通过分配新角色入口", async () => {
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7" }, { id: "8" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchRolePermissions: async () => ({ list: [], selected: [] }),
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  let hgList = hgFindCollectionView(hgPage.renderRoleAssignment());
  hgFindByAriaLabel(hgList.props.renderCell(hgList.props.items[0]), "分配角色（单选）").props.children.props.onChange("7");
  await hgFlush();
  hgList = hgFindCollectionView(hgPage.renderRoleAssignment());
  hgFindByAriaLabel(hgList.props.renderCell(hgList.props.items[0]), "分配角色（单选）").props.children.props.onChange("8");
  await hgFlush();
  assert.equal(hgPage.state.hgDrafts.length, 1);
  assert.equal(hgPage.state.hgDrafts[0].roleId, "8");
  hgPage.hgAddDraft();
  assert.equal(hgPage.state.hgDrafts.length, 2);
  hgPage.hgRemoveDraft("draft-1");
  assert.equal(hgPage.state.hgDrafts[0].key, "draft-2");
});

test("权限为空时说明角色尚未配置；作用域候选分页、失败重试且不允许手输 ID", async () => {
  const hgCursors = []; // 只记录游标和类型，验证失败后的重试读取同一页。
  const { hgPage, hgMessages } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", code: "tester" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchRolePermissions: async () => ({ list: [{ code: "test:permission:read" }], selected: [] }),
    fetchScopeResources: async (type, cursor) => {
      hgCursors.push([type, cursor]);
      if (cursor && hgCursors.length === 2) throw new Error("暂时不可用");
      return cursor ? { list: [{ id: "org-2", name: "二号组织" }], hasMore: false }
        : { list: [{ id: "org-1", name: "一号组织" }], nextCursor: "org-1", hasMore: true };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  let hgPermissionTree = hgFindByAriaLabel(hgPage.renderRolePermissions(hgPage.state.hgDrafts[0]), "本次绑定业务权限（可多选）").props.children[0];
  assert.equal(hgPermissionTree.props.disabled, true);
  assert.equal(hgPermissionTree.props.placeholder, "请先选择角色");
  hgPage.hgSelectRole("draft-1", "7");
  hgPermissionTree = hgFindByAriaLabel(hgPage.renderRolePermissions(hgPage.state.hgDrafts[0]), "本次绑定业务权限（可多选）").props.children[0];
  assert.equal(hgPermissionTree.props.disabled, true);
  assert.equal(hgPermissionTree.props.placeholder, "权限加载中");
  await hgFlush();
  assert.ok(hgFindText(hgPage.renderRolePermissions(hgPage.state.hgDrafts[0]), "该角色尚未配置业务权限，请先在角色权限管理中配置并生效后再分配"));
  hgPermissionTree = hgFindByAriaLabel(hgPage.renderRolePermissions(hgPage.state.hgDrafts[0]), "本次绑定业务权限（可多选）").props.children[0];
  assert.equal(hgPermissionTree.props.disabled, true);
  assert.equal(hgPermissionTree.props.placeholder, "该角色暂无业务权限");
  assert.equal(hgPermissionTree.props.treeData.length, 0);
  hgPage.hgSelectScopeTypes("draft-1", ["org"]);
  await hgFlush();
  let hgCard = hgFindCollectionView(hgPage.renderRoleAssignment()).props;
  let hgScopeSelect = hgFindByAriaLabel(hgCard.renderCell(hgCard.items[0]), "org 作用域 ID");
  assert.equal(hgScopeSelect.type, "select");
  assert.equal(hgScopeSelect.props.children[1][0].props.value, "org-1");
  hgPage.hgUpdateDraft("draft-1", () => ({ scopeIDs: { org: "forged" } }));
  assert.equal(hgPage.hgGetPendingBindings(), null);
  assert.ok(hgMessages.includes("请从已加载的有效作用域资源中选择 ID"));
  hgPage.hgLoadScopeResources("org", "org-1");
  await hgFlush();
  assert.equal(hgPage.state.hgScopeResources.org.error, "暂时不可用");
  hgPage.hgLoadScopeResources("org", hgPage.state.hgScopeResources.org.nextCursor);
  await hgFlush();
  hgCard = hgFindCollectionView(hgPage.renderRoleAssignment()).props;
  hgScopeSelect = hgFindByAriaLabel(hgCard.renderCell(hgCard.items[0]), "org 作用域 ID");
  assert.equal(hgScopeSelect.props.children[1][1].props.value, "org-2");
  hgScopeSelect.props.onChange({ target: { value: "org-2" } });
  assert.equal(hgPage.hgGetPendingBindings()[0].scopeId, "org-2");
  assert.deepEqual(hgCursors, [["org", ""], ["org", "org-1"], ["org", "org-1"]]);
});

test("作用域候选跨登记店铺与商家分页去重，切换用户后丢弃旧请求", async () => {
  let hgResolveOld; // 旧用户的候选请求延迟完成，以验证切换编辑目标后的隔离。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchScopeResources: (_type, cursor) => cursor === "m:0"
      ? Promise.resolve({ list: [{ id: "shop-1", name: "同一店铺" }, { id: "shop-2", name: "新商家" }], hasMore: false })
      : cursor === "m:1" ? new Promise((resolve) => { hgResolveOld = resolve; })
      : cursor === "" ? Promise.resolve({ list: [{ id: "shop-1", name: "已登记店铺" }], hasMore: true, nextCursor: "m:0" })
      : new Promise((resolve) => { hgResolveOld = resolve; }),
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  hgPage.hgSelectScopeTypes("draft-1", ["shop"]);
  await hgFlush();
  hgPage.hgLoadScopeResources("shop", "m:0");
  await hgFlush();
  assert.deepEqual(Array.from(hgPage.state.hgScopeResources.shop.list, (item) => item.id), ["shop-1", "shop-2"]);
  hgPage.hgLoadScopeResources("shop", "m:1");
  const hgOldProps = hgPage.props; // 更新路由后旧目标不应继承候选或自动填写。
  hgPage.props = { params: { userId: "route-8" }, location: { state: { user: { user_id: "route-8", nickname: "新用户" } } } };
  hgPage.componentDidUpdate(hgOldProps);
  hgResolveOld({ list: [{ id: "shop-old", name: "旧商家" }], hasMore: false });
  await hgFlush();
  assert.equal(Object.keys(hgPage.state.hgScopeResources).length, 0);
  assert.equal(hgPage.state.hgDrafts.length, 0);
});

test("新增角色默认全选当前权限，取消其中一项后仅给该用户绑定提交剩余权限", async () => {
  const hgRequests = []; // 仅记录授权的权限编码，不保留 MFA 验证码。
  const { hgPage } = hgUserEditPage(async () => {}, {
    fetchAllRoles: async () => ({ list: [{ id: "7", name: "商家", code: "merchant" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchRolePermissions: async () => ({
      list: [{ code: "mall:product:create" }, { code: "mall:product:update" }, { code: "iam:role:grant" }],
      selected: ["mall:product:create", "mall:product:update"],
    }),
    grantDirectBatch: async (payload) => { hgRequests.push(payload.bindings); return { granted: true }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-1", "7");
  await hgFlush();
  const hgList = hgFindCollectionView(hgPage.renderRoleAssignment());
  const hgDraftCard = hgList.props.renderCell(hgList.props.items[0]);
  const hgPermissionTree = hgFindByAriaLabel(hgDraftCard, "本次绑定业务权限（可多选）").props.children[0];
  assert.equal(hgPermissionTree.props.treeCheckable, true);
  assert.equal(hgPermissionTree.props.disabled, false);
  assert.deepEqual(Array.from(hgPermissionTree.props.value), ["mall:product:create", "mall:product:update"]);
  hgPermissionTree.props.onChange(["mall:product:create"]);
  hgPage.hgSelectScopeTypes("draft-1", ["global"]);
  await hgPage.handleSubmit();
  hgPage.setState({ hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  assert.equal(JSON.stringify(hgRequests), JSON.stringify([[{
    roleId: "7", scopeType: "global", scopeId: "", permissions: ["mall:product:create"],
  }]]));
});

test("资料已保存而授权失败时保留草稿，重试不重复保存资料", async () => {
  let hgProfileWrites = 0;
  let hgGrants = 0;
  const { hgPage, hgMessages } = hgUserEditPage(async () => { hgProfileWrites += 1; }, {
    fetchAllRoles: async () => ({ list: [{ id: "7", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchRolePermissions: async () => ({ list: [], selected: [] }),
    grantDirectBatch: async () => {
      if (++hgGrants === 1) throw new Error("超时");
      return { granted: true };
    },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-1", "7");
  await hgFlush();
  hgPage.hgSelectScopeTypes("draft-1", ["global"]);
  await hgPage.handleSubmit();
  hgPage.setState({ hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  await hgFlush();
  assert.equal(hgProfileWrites, 1);
  assert.equal(hgPage.state.hgDrafts.length, 1);
  assert.ok(hgMessages.some((text) => text.includes("资料已保存，角色授权失败")));
  await hgPage.handleSubmit();
  hgPage.setState({ hgMFACode: "654321" });
  await hgPage.hgSubmitRole();
  assert.equal(hgProfileWrites, 1);
  assert.equal(hgGrants, 2);
  assert.equal(hgPage.state.hgDrafts.length, 0);
});

test("资料保存失败时不发送授权，且重复草稿绑定在弹窗前被拦截", async () => {
  let hgProfileWrites = 0;
  let hgGrants = 0;
  const { hgPage, hgMessages } = hgUserEditPage(async () => {
    hgProfileWrites += 1;
    throw new Error("资料保存失败");
  }, {
    fetchAllRoles: async () => ({ list: [{ id: "7", code: "reviewer" }], truncated: false }),
    fetchBindings: async () => ({ list: [] }),
    fetchRolePermissions: async () => ({ list: [], selected: [] }),
    grantDirectBatch: async () => { hgGrants += 1; return { granted: true }; },
  });
  await hgPage.hgLoadRolesAndBindings();
  await hgFlush();
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-1", "7");
  await hgFlush();
  hgPage.hgSelectScopeTypes("draft-1", ["global"]);
  hgPage.hgAddDraft();
  hgPage.hgSelectRole("draft-2", "7");
  await hgFlush();
  hgPage.hgSelectScopeTypes("draft-2", ["global"]);
  await hgPage.handleSubmit();
  assert.equal(hgPage.state.hgMFAVisible, false);
  assert.ok(hgMessages.includes("选中的角色与作用域中存在重复或已生效绑定"));
  hgPage.hgRemoveDraft("draft-2");
  await hgPage.handleSubmit();
  assert.equal(hgPage.state.hgMFAVisible, true);
  hgPage.setState({ hgMFACode: "123456" });
  await hgPage.hgSubmitRole();
  assert.equal(hgProfileWrites, 1);
  assert.equal(hgGrants, 0);
  assert.equal(hgPage.state.hgDrafts.length, 1);
  assert.ok(hgMessages.includes("资料保存失败，未提交角色授权"));
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

const HGTestButton = () => null; // 测试按钮的点击行为，不连接 DOM 或真实网络。
const HGTestModal = () => null; // 保留弹窗 children 和关闭回调供行为断言。
const HGTestCheckbox = () => null; // 只记录复选框的勾选状态与只读属性，不渲染 DOM。
const HGTestAuthButton = () => null; // 保留原 IAM 门槛及审批/撤销操作回调供断言。
const HGTestTable = () => null; // 仅管理员主列表使用表格，授权弹窗不渲染表格。

/** 将页面组件转为 Node 可执行代码，并为请求/样式/子组件注入本地替身。 */
function hgPageWithVM(vm) {
  const module = { exports: {} }; // 当前测试加载的页面模块。
  const source = readFileSync(new URL("./hg_admin_list_page.jsx", import.meta.url), "utf8"); // 真实页面源码。
  const code = transformSync(source, {
    filename: "hg_admin_list_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const messages = { errors: [], successes: [] }; // 测试只记录提示文案，绝不记录真实 MFA。
  runInNewContext(code, {
    module, exports: module.exports, React,
    require: (path) => {
      if (path === "react") return React;
      if (path.endsWith("hg_admin_list_vm")) return { __esModule: true, default: vm, ADMIN_LIST_PAGE_SIZE: 20 };
      if (path.endsWith("hg_button_page")) return { __esModule: true, default: HGTestButton };
      if (path.endsWith("hg_checkbox_page")) return { HGCheckbox: HGTestCheckbox };
      if (path.endsWith("hg_permission")) return { HGAuthButton: HGTestAuthButton };
      if (path.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: { IAM_GRANT: "iam:role:grant", IAM_APPROVE: "iam:approval:approve" } };
      if (path.endsWith("hg_table_page")) return { __esModule: true, default: HGTestTable };
      if (path.endsWith("hg_table_contract.js")) return {
        hgTableColumns: (columns) => columns,
        hgTableProps: (props) => props,
      };
      if (path.endsWith("hg_modal_page")) return { __esModule: true, default: HGTestModal };
      if (path.endsWith("hg_message_page")) return { hgMessage: {
        error: (text) => messages.errors.push(text),
        success: (text) => messages.successes.push(text),
        info: () => {},
      } };
      if (path.endsWith(".module.css")) return { __esModule: true, default: {} };
      return { __esModule: true, default: () => null };
    },
  });
  const page = new module.exports.default({}); // 仅测试管理员授权弹窗，不挂载管理员列表请求。
  page.hgMounted = true;
  page.setState = (update, callback) => {
    page.state = { ...page.state, ...(typeof update === "function" ? update(page.state) : update) };
    callback?.();
  };
  page.hgMessages = messages;
  return page;
}

/** 提取 JSX 子树中的文字；不依赖浏览器渲染。 */
function hgText(node) {
  if (Array.isArray(node)) return node.map(hgText).join(" ");
  if (React.isValidElement(node)) return hgText(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

/** 收集弹窗内的所有权限复选框，确认勾选与目录字段逐项对应。 */
function hgCheckboxes(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => hgCheckboxes(item, result));
  else if (React.isValidElement(node)) {
    if (node.type === HGTestCheckbox) result.push(node);
    hgCheckboxes(node.props.children, result);
  }
  return result;
}

/** 收集带 IAM 权限门槛的授权操作，避免把普通关闭/重试按钮当作写接口。 */
function hgAuthButtons(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => hgAuthButtons(item, result));
  else if (React.isValidElement(node)) {
    if (node.type === HGTestAuthButton) result.push(node);
    hgAuthButtons(node.props.children, result);
  }
  return result;
}

/** 收集 JSX 中的表格替身，验证只替换授权弹窗、不影响管理员主列表。 */
function hgTables(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => hgTables(item, result));
  else if (React.isValidElement(node)) {
    if (node.type === HGTestTable) result.push(node);
    hgTables(node.props.children, result);
  }
  return result;
}

/** 查找普通按钮，包含权限弹窗的 Fragment 层，不假设 JSX 的固定层级。 */
function hgButtons(node, result = []) {
  if (Array.isArray(node)) node.forEach((item) => hgButtons(item, result));
  else if (React.isValidElement(node)) {
    if (node.type === HGTestButton) result.push(node);
    hgButtons(node.props.children, result);
  }
  return result;
}

/** 从授权卡片列表取指定业务键，不依赖表格行或组件 CSS 类名。 */
function hgAuthorizationCard(page, rowKey) {
  const cards = page.renderAuthorizationTable().props.children.find(
    (node) => React.isValidElement(node) && node.type === "div" && Array.isArray(node.props.children)
      && node.props.children.some((items) => Array.isArray(items) && items.some((item) => item?.key === rowKey))
  );
  assert.ok(cards);
  return cards.props.children.flat().find((item) => item?.key === rowKey);
}

/** 等待回调中的请求链结算，不使用固定延时。 */
const hgFlush = () => new Promise((resolve) => setImmediate(resolve));

test("查看权限按当前行 ID 加载，角色已选权限打勾、未选不打勾且显示适用范围", async () => {
  const requested = []; // 首次请求的目标 ID 及字符串游标。
  const vm = {
    fetchBindings: async (...args) => {
      requested.push(args);
      return { list: [{ id: "9", roleId: "2", roleCode: "reviewer", scopeType: "shop", scopeId: "store-1" }], hasMore: false };
    },
    fetchRoleNames: async () => ({ "2": "审核员" }),
    fetchRolePermissions: async () => ({
      "2": {
        list: [{ code: "mall:review:read", description: "审核查看" }, { code: "mall:review:write", description: "审核修改" }],
        selected: ["mall:review:read"],
        error: "",
      },
    }),
  };
  const page = hgPageWithVM(vm);
  const column = page.getColumns().find((item) => item.title === "角色权限");
  const button = column.render(null, { id: "hgid_A", name: "甲" }).props.children[0];
  button.props.onClick();
  await hgFlush();
  assert.deepEqual(requested, [["hgid_A", "0"]]);
  assert.match(hgText(page.renderBindingsModal()), /审核员/);
  assert.match(hgText(page.renderBindingsModal()), /审核查看\s*（\s*mall:review:read\s*）/);
  assert.match(hgText(page.renderBindingsModal()), /适用范围：\s*店铺\s*· store-1/);
  const boxes = hgCheckboxes(page.renderBindingsModal()); // 同一角色目录中已选与未选两项均展示。
  assert.deepEqual(boxes.map((box) => [box.props.checked, box.props.readOnly]), [[true, true], [false, true]]);
  assert.match(hgText(boxes[1]), /审核修改/);
  const current = page.state.bindingPermissions["2"]; // 模拟该角色没有配置任何权限，仍展示未勾选目录。
  page.setState({ bindingPermissions: { "2": { ...current, selected: [] } } });
  assert.deepEqual(hgCheckboxes(page.renderBindingsModal()).map((box) => box.props.checked), [false, false]);
});

test("授权查询打开即加载生效角色权限，卡片展示已选与未选且待审批不勾选", async () => {
  const requests = []; // 明确区分已授权和待审批两个 API 的精确目标。
  const vm = {
    countByStatus: () => 0,
    fetchBindings: async (userId, cursor) => {
      requests.push(["binding", userId, cursor]);
      return { list: [{ id: "7", roleId: "11", roleCode: "editor", scopeType: "global" }], hasMore: false };
    },
    fetchPendingGrants: async (userId, cursor) => {
      requests.push(["pending", userId, cursor]);
      return { list: [{
        approvalId: "8", roleId: "12", scopeType: "org", scopeId: "org-1",
        approvalExpiresAt: "2026-12-01T00:00:00Z", status: "pending",
      }], hasMore: false };
    },
    fetchRoleNames: async () => ({ "11": "已授权角色", "12": "待审批角色" }),
    fetchRolePermissions: async (roleIds) => {
      requests.push(["permission", ...roleIds]);
      return { "11": { list: [
        { code: "asset:read", description: "查看资产" },
        { code: "asset:grant", description: "分配资产" },
      ], selected: ["asset:read"], error: "" } };
    },
  };
  const page = hgPageWithVM(vm);
  const buttons = page.getColumns().find((col) => col.title === "角色权限").render(null, { id: "hgid_A" }).props.children;
  assert.equal(hgText(buttons[1]), "授权查询");
  buttons[1].props.onClick();
  await hgFlush();
  assert.equal(page.state.bindingView, "authorization");
  assert.deepEqual(requests.slice(0, 2), [["binding", "hgid_A", "0"], ["pending", "hgid_A", "0"]]);
  assert.deepEqual(requests.find((item) => item[0] === "permission"), ["permission", "11"]);
  assert.equal(hgTables(page.renderBindingsModal()).length, 0);
  assert.equal(hgTables(page.render()).length, 1);
  assert.match(hgText(hgAuthorizationCard(page, "binding-7")), /已授权/);
  assert.match(hgText(hgAuthorizationCard(page, "approval-8")), /待审批/);
  assert.equal(hgCheckboxes(hgAuthorizationCard(page, "approval-8")).length, 0);
  assert.deepEqual(hgCheckboxes(page.renderBindingsModal()).map((box) => box.props.checked), [true, false]);
  assert.match(hgText(page.renderBindingsModal()), /查询角色授权|已授权/);
  assert.match(hgText(page.renderBindingsModal()), /待审批角色/);
  assert.match(hgText(page.renderBindingsModal()), /申请 #\s*8/);
  assert.match(hgText(hgAuthorizationCard(page, "approval-8")), /组织\s*\/ org-1/);
  assert.match(hgText(hgAuthorizationCard(page, "approval-8")), /申请有效期：至/);
  assert.equal(hgAuthButtons(hgAuthorizationCard(page, "approval-8")).length, 2);
  assert.equal(hgAuthButtons(hgAuthorizationCard(page, "binding-7")).length, 1);
  page.setState({ approvalCode: "123456" });
  const refresh = hgButtons(page.renderAuthorizationTable()).find((button) => hgText(button) === "查询角色授权");
  refresh.props.onClick();
  await hgFlush();
  assert.equal(requests.filter((item) => item[0] === "binding").length, 2);
  assert.equal(requests.filter((item) => item[0] === "pending").length, 2);
  assert.equal(requests.filter((item) => item[0] === "permission").length, 2); // 刷新重新读取当前角色选中态。
  assert.equal(page.state.approvalCode, "");
  page.closeBindings();
  assert.equal(page.renderBindingsModal(), null);
});

test("自动查询按页去重角色；失败可重载，关闭和切换管理员丢弃过期权限", async () => {
  const requests = []; // 每页请求去重角色 ID，避免重复作用域触发多次请求。
  const pending = []; // 控制权限接口返回顺序，模拟快速切换管理员。
  const vm = {
    fetchBindings: async () => ({ list: [
      { id: "1", roleId: "11", roleCode: "first", scopeType: "global" },
      { id: "2", roleId: "11", roleCode: "first", scopeType: "shop", scopeId: "shop-1" },
    ], hasMore: false }),
    fetchPendingGrants: async () => ({ list: [], hasMore: false }),
    fetchRoleNames: async () => ({ "11": "甲", "12": "乙" }),
    fetchRolePermissions: (roleIds) => {
      requests.push(Array.from(roleIds));
      return new Promise((resolve) => pending.push(resolve));
    },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  assert.deepEqual(requests, [["11"]]);
  assert.match(hgText(page.renderBindingsModal()), /业务权限加载中/);
  pending[0]({}); // 不完整响应不是“无业务权限”，必须提示并允许重新查询。
  await hgFlush();
  assert.match(hgText(page.renderBindingsModal()), /业务权限加载失败，请重试/);
  const retry = hgButtons(page.renderAuthorizationTable()).find((button) => hgText(button) === "重新加载");
  assert.ok(retry);
  retry.props.onClick();
  await hgFlush();
  pending[1]({ "11": { list: [{ code: "first:read" }, { code: "first:write" }], selected: ["first:read"], error: "" } });
  await hgFlush();
  assert.deepEqual(hgCheckboxes(page.renderBindingsModal()).map((box) => box.props.checked), [true, false, true, false]);
  page.openBindings({ id: "hgid_B" }, "authorization");
  await hgFlush();
  page.openBindings({ id: "hgid_C" }, "authorization");
  await hgFlush();
  pending[2]({ "11": { list: [{ code: "old:read" }], selected: ["old:read"], error: "" } });
  await hgFlush();
  assert.equal(page.state.bindingAdmin.id, "hgid_C");
  assert.equal(hgCheckboxes(page.renderBindingsModal()).length, 0);
  page.closeBindings();
  pending[3]({ "11": { list: [{ code: "old:read" }], selected: ["old:read"], error: "" } });
  await hgFlush();
  assert.equal(page.renderBindingsModal(), null);
  assert.deepEqual(Object.keys(page.state.bindingPermissions), []);
});

test("待审批查询失败不清空已授权结果；查看权限仍只读取已生效绑定", async () => {
  let pendingCalls = 0; // 只在授权查询时读取待审批接口。
  const vm = {
    fetchBindings: async () => ({ list: [{ id: "1", roleId: "11", roleCode: "reader", scopeType: "global", permissionsLimited: true }], hasMore: false }),
    fetchPendingGrants: async () => { pendingCalls += 1; throw new Error("pending unavailable"); },
    fetchRoleNames: async () => ({ "11": "只读角色" }),
    fetchRolePermissions: async () => ({}),
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  assert.equal(pendingCalls, 1);
  assert.match(hgText(page.renderBindingsModal()), /只读角色/);
  assert.match(hgText(page.renderBindingsModal()), /待审批授权加载失败，请重试/);
  assert.doesNotMatch(hgText(page.renderBindingsModal()), /暂无已授权或待审批角色/);
  assert.equal(hgCheckboxes(page.renderBindingsModal()).length, 0); // 响应缺失时提示失败，不推断受限权限。
  page.closeBindings();
  page.openBindings({ id: "hgid_B" });
  await hgFlush();
  assert.equal(pendingCalls, 1);
  assert.doesNotMatch(hgText(page.renderBindingsModal()), /待审批授权加载失败/);
});

test("活动授权失败仍能展示待审批申请，审批游标独立分页且不勾选待生效权限", async () => {
  const cursors = []; // 仅记录待审批游标；不与活动绑定游标混用。
  const vm = {
    fetchBindings: async () => { throw new Error("binding unavailable"); },
    fetchPendingGrants: async (_userId, cursor) => {
      cursors.push(cursor);
      return cursor === "0"
        ? { list: [{ approvalId: "31", roleId: "11", scopeType: "global", approvalExpiresAt: "2026-12-01T00:00:00Z" }], hasMore: true, nextCursor: "9007199254740993" }
        : { list: [{ approvalId: "30", roleId: "12", scopeType: "shop", scopeId: "shop-1", approvalExpiresAt: "2026-12-02T00:00:00Z" }], hasMore: false };
    },
    fetchRoleNames: async () => ({ "11": "待审批甲", "12": "待审批乙" }),
    fetchRolePermissions: async () => { throw new Error("不应请求"); },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  assert.match(hgText(page.renderBindingsModal()), /角色绑定加载失败，请重试/);
  assert.match(hgText(page.renderBindingsModal()), /待审批甲/);
  page.loadPendingGrants(page.state.pendingCursor);
  await hgFlush();
  assert.deepEqual(cursors, ["0", "9007199254740993"]);
  assert.equal(page.state.pendingGrants.length, 2);
  assert.match(hgText(hgAuthorizationCard(page, "approval-30")), /待审批乙/);
  assert.match(hgText(page.renderBindingsModal()), /待审批乙/);
  assert.equal(hgCheckboxes(page.renderBindingsModal()).length, 0);
});

test("目标申请用审批人 MFA 裁决，只有 pending ID 能提交且成功刷新为生效绑定", async () => {
  let approved = false; // 模拟后端审批成功后，待审批申请转为活动绑定。
  const decisions = []; // 只验证固定测试验证码与编号，不使用真实数据。
  const vm = {
    fetchBindings: async () => ({ list: approved ? [{ id: "19", roleId: "11", roleCode: "reader", scopeType: "global", permissionsLimited: true }] : [], hasMore: false }),
    fetchPendingGrants: async () => ({ list: approved ? [] : [{ approvalId: "8", roleId: "11", scopeType: "global", approvalExpiresAt: "2026-12-01T00:00:00Z" }], hasMore: false }),
    fetchRoleNames: async () => ({ "11": "审阅" }),
    fetchRolePermissions: async () => ({}),
    decideApproval: async (...args) => { decisions.push(args); approved = true; },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  const grant = page.state.pendingGrants[0]; // 当前页服务端返回的申请，不能伪造申请 ID。
  await page.decideApproval(grant, true);
  assert.equal(decisions.length, 0);
  assert.match(page.hgMessages.errors.at(-1), /审批人的 6 位 MFA/);
  page.setState({ approvalCode: "123456" });
  const actions = hgAuthButtons(hgAuthorizationCard(page, "approval-8"));
  assert.equal(actions.length, 2);
  assert.deepEqual(Array.from(actions[0].props.allOf), ["iam:role:grant", "iam:approval:approve"]);
  await actions[0].props.onClick();
  await hgFlush();
  assert.deepEqual(decisions, [["8", "123456", true]]);
  assert.equal(page.state.approvalCode, "");
  assert.equal(page.state.pendingGrants.length, 0);
  assert.equal(page.state.bindings[0].id, "19");
});

test("拒绝申请仅提交一次，失败不伪造已授权；切换用户后旧裁决不得刷新新账号", async () => {
  let finish; // 模拟响应尚未返回的审批请求。
  const decisions = []; // 仅记录审批 ID 与方向。
  let fail = false; // 第二次审批模拟服务端拒绝。
  const vm = {
    fetchBindings: async () => ({ list: [], hasMore: false }),
    fetchPendingGrants: async () => ({ list: [{ approvalId: "8", roleId: "11", scopeType: "global", approvalExpiresAt: "2026-12-01T00:00:00Z" }], hasMore: false }),
    fetchRoleNames: async () => ({ "11": "申请角色" }),
    fetchRolePermissions: async () => ({}),
    decideApproval: (id, _code, approve) => {
      decisions.push([id, approve]);
      if (fail) return Promise.reject(new Error("审批权限不足"));
      return new Promise((resolve) => { finish = resolve; });
    },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  page.setState({ approvalCode: "123456" });
  const rejecting = page.decideApproval(page.state.pendingGrants[0], false);
  await page.decideApproval(page.state.pendingGrants[0], true);
  assert.deepEqual(decisions, [["8", false]]);
  assert.equal(page.state.approvalCode, "");
  page.closeBindings();
  page.openBindings({ id: "hgid_B" }, "authorization");
  await hgFlush();
  assert.equal(hgAuthButtons(hgAuthorizationCard(page, "approval-8"))[0].props.disabled, true);
  assert.match(hgText(page.renderBindingsModal()), /上一笔审批正在处理/);
  finish();
  await rejecting;
  await hgFlush();
  assert.equal(page.state.bindingAdmin.id, "hgid_B");
  assert.equal(hgAuthButtons(hgAuthorizationCard(page, "approval-8"))[0].props.disabled, false);
  assert.equal(page.state.pendingGrants.length, 1);
  fail = true;
  page.setState({ approvalCode: "654321" });
  await page.decideApproval(page.state.pendingGrants[0], true);
  assert.equal(page.state.pendingGrants.length, 1);
  assert.equal(page.state.bindings.length, 0);
  assert.match(page.hgMessages.errors.at(-1), /审批权限不足/);
});

test("授权弹窗只能撤销当前管理员活动绑定；超管及待审批申请不可冒充绑定 ID", async () => {
  const revoked = []; // 仅记录目标 ID 和活动绑定 ID，不触达真实 IAM。
  const vm = {
    fetchBindings: async (userId) => ({ list: [{ id: "9", roleId: "11", roleCode: userId === "hgid_A" ? "viewer" : "super_admin", scopeType: "global", permissionsLimited: true }], hasMore: false }),
    fetchPendingGrants: async () => ({ list: [], hasMore: false }),
    fetchRoleNames: async () => ({ "11": "角色" }),
    fetchRolePermissions: async () => ({}),
    revokeBinding: async (...args) => { revoked.push(args); },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  await page.revokeBinding({ id: "申请-9", roleCode: "viewer" });
  assert.equal(revoked.length, 0);
  const revokeButton = hgAuthButtons(hgAuthorizationCard(page, "binding-9"))[0];
  assert.equal(revokeButton.props.permission, "iam:role:grant");
  await revokeButton.props.onClick();
  await hgFlush();
  assert.deepEqual(revoked, [["hgid_A", "9"]]);
  page.openBindings({ id: "hgid_B" }, "authorization");
  await hgFlush();
  assert.equal(hgAuthButtons(hgAuthorizationCard(page, "binding-9"))[0].props.disabled, true);
  await page.revokeBinding({ id: "9", roleCode: "viewer" }); // 不能用伪造的行字段绕过超管限制。
  assert.equal(revoked.length, 1);
});

test("单独限制的绑定不查询角色全部权限，关闭或切换管理员废弃旧响应", async () => {
  let resolveOld; // 首位管理员尚未返回的请求，用于模拟切换后的迟到响应。
  const ids = []; // 实际请求过权限目录的角色 ID；受限角色不得出现。
  const vm = {
    fetchBindings: (userId) => userId === "hgid_A"
      ? new Promise((resolve) => { resolveOld = resolve; })
      : Promise.resolve({ list: [{ id: "10", roleId: "3", roleCode: "limited", scopeType: "global", permissionsLimited: true }], hasMore: false }),
    fetchRoleNames: async () => ({ "3": "有限角色" }),
    fetchRolePermissions: async (roleIds) => { ids.push(...roleIds); return {}; },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" });
  const oldRequest = page.hgBindingRequest; // 首位管理员的旧回调身份。
  page.openBindings({ id: "hgid_B" });
  await page.loadBindings("0", oldRequest, "hgid_A");
  resolveOld({ list: [{ id: "9", roleId: "1", roleCode: "old" }], hasMore: false });
  await hgFlush();
  assert.equal(page.state.bindingAdmin.id, "hgid_B");
  assert.equal(page.state.bindings.length, 1);
  assert.deepEqual(ids, []);
  assert.match(hgText(page.renderBindingsModal()), /无法确认业务权限/);
  assert.equal(hgCheckboxes(page.renderBindingsModal()).length, 0);
  page.closeBindings();
  assert.equal(page.renderBindingsModal(), null);
});

test("受限绑定在授权查询自动展示角色配置，但不宣称它是绑定实际权限", async () => {
  const requests = []; // 区分普通查看与授权查询；前者不查询受限角色目录。
  const vm = {
    fetchBindings: async () => ({ list: [
      { id: "10", roleId: "3", roleCode: "limited", scopeType: "global", permissionsLimited: true },
    ], hasMore: false }),
    fetchPendingGrants: async () => ({ list: [], hasMore: false }),
    fetchRoleNames: async () => ({ "3": "有限角色" }),
    fetchRolePermissions: async (ids) => {
      requests.push(Array.from(ids));
      return { "3": {
        list: [{ code: "item:read" }, { code: "item:write" }],
        selected: ["item:read"], error: "",
      } };
    },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" });
  await hgFlush();
  assert.deepEqual(requests, []);
  assert.equal(hgCheckboxes(page.renderBindingsModal()).length, 0);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  assert.deepEqual(requests, [["3"]]);
  assert.deepEqual(hgCheckboxes(page.renderBindingsModal()).map((box) => [box.props.checked, box.props.readOnly]), [[true, true], [false, true]]);
  assert.match(hgText(page.renderBindingsModal()), /仅为角色配置.*实际权限子集/);
});

test("授权续页自动读取新增角色的选中态，保留首屏卡片和独立字符串游标", async () => {
  const requested = []; // 续页只请求新增角色，不混入待审批或管理员游标。
  const vm = {
    fetchBindings: async (_userId, cursor) => cursor === "0"
      ? { list: [{ id: "1", roleId: "11", scopeType: "global" }], nextCursor: "9007199254740993", hasMore: true }
      : { list: [{ id: "2", roleId: "12", scopeType: "shop", scopeId: "a" }], hasMore: false },
    fetchPendingGrants: async () => ({ list: [], hasMore: false }),
    fetchRoleNames: async () => ({}),
    fetchRolePermissions: async (ids) => {
      requested.push(Array.from(ids));
      return { [ids[0]]: { list: [{ code: `${ids[0]}:read` }], selected: ids[0] === "11" ? ["11:read"] : [], error: "" } };
    },
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" }, "authorization");
  await hgFlush();
  page.loadBindings(page.state.bindingCursor);
  await hgFlush();
  assert.deepEqual(requested, [["11"], ["12"]]);
  assert.deepEqual(hgCheckboxes(page.renderBindingsModal()).map((box) => box.props.checked), [true, false]);
  assert.match(hgText(hgAuthorizationCard(page, "binding-2")), /店铺\s*\/ a/);
});

test("请求失败保留错误提示与重试入口，不显示空权限结论", async () => {
  const vm = { fetchBindings: async () => { throw new Error("无权限"); } };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" });
  await hgFlush();
  const modal = page.renderBindingsModal();
  assert.match(hgText(modal), /角色绑定加载失败，请重试/);
  assert.doesNotMatch(hgText(modal), /暂无已生效的角色绑定/);
  const retry = hgButtons(modal).find((button) => hgText(button) === "重新加载");
  assert.ok(retry);
});

test("更多绑定沿用服务端字符串游标，重开弹窗丢弃旧角色详情", async () => {
  const cursors = []; // 记录首屏和续页游标，确保超过 JS 安全整数仍原样传递。
  let resolveNames; // 首次角色目录返回延迟，测试重新打开后不能污染当前用户。
  let nameCalls = 0; // 只延迟旧弹窗的第一次目录请求。
  const vm = {
    fetchBindings: async (_userId, cursor) => {
      cursors.push(cursor);
      return cursor === "0"
        ? { list: [{ id: "1", roleId: "1", roleCode: "first", scopeType: "global", permissionsLimited: true }], hasMore: true, nextCursor: "9007199254740993" }
        : { list: [{ id: "2", roleId: "2", roleCode: "second", scopeType: "org", scopeId: "org-1", permissionsLimited: true }], hasMore: false };
    },
    fetchRoleNames: (ids) => ids.includes("1") && ++nameCalls === 1
      ? new Promise((resolve) => { resolveNames = resolve; })
      : Promise.resolve({ "2": "组织管理员" }),
    fetchRolePermissions: async () => ({}),
  };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" });
  await hgFlush();
  page.closeBindings();
  page.openBindings({ id: "hgid_B" });
  resolveNames({ "1": "过期角色名称" });
  await hgFlush();
  assert.equal(page.state.bindingRoles["1"], undefined);
  assert.equal(page.state.bindingHasMore, true);
  page.loadBindings(page.state.bindingCursor);
  await hgFlush();
  assert.deepEqual(cursors, ["0", "0", "9007199254740993"]);
  assert.equal(page.state.bindings.length, 2);
  assert.match(hgText(page.renderBindingsModal()), /组织管理员/);
  assert.match(hgText(page.renderBindingsModal()), /组织\s*· org-1/);
});

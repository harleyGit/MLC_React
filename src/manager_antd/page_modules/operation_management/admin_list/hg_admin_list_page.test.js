import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";
import React from "react";

const HGTestButton = () => null; // 测试按钮的点击行为，不连接 DOM 或真实网络。
const HGTestModal = () => null; // 保留弹窗 children 和关闭回调供行为断言。

/** 将页面组件转为 Node 可执行代码，并为请求/样式/子组件注入本地替身。 */
function hgPageWithVM(vm) {
  const module = { exports: {} }; // 当前测试加载的页面模块。
  const source = readFileSync(new URL("./hg_admin_list_page.jsx", import.meta.url), "utf8"); // 真实页面源码。
  const code = transformSync(source, {
    filename: "hg_admin_list_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(code, {
    module, exports: module.exports, React,
    require: (path) => {
      if (path === "react") return React;
      if (path.endsWith("hg_admin_list_vm")) return { __esModule: true, default: vm, ADMIN_LIST_PAGE_SIZE: 20 };
      if (path.endsWith("hg_button_page")) return { __esModule: true, default: HGTestButton };
      if (path.endsWith("hg_modal_page")) return { __esModule: true, default: HGTestModal };
      if (path.endsWith("hg_message_page")) return { hgMessage: { error: () => {}, info: () => {} } };
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
  return page;
}

/** 提取 JSX 子树中的文字；不依赖浏览器渲染。 */
function hgText(node) {
  if (Array.isArray(node)) return node.map(hgText).join(" ");
  if (React.isValidElement(node)) return hgText(node.props.children);
  return typeof node === "string" || typeof node === "number" ? String(node) : "";
}

/** 等待回调中的请求链结算，不使用固定延时。 */
const hgFlush = () => new Promise((resolve) => setImmediate(resolve));

test("查看权限按当前行 ID 加载，显示角色名称、选中业务权限和适用范围", async () => {
  const requested = []; // 首次请求的目标 ID 及字符串游标。
  const vm = {
    fetchBindings: async (...args) => {
      requested.push(args);
      return { list: [{ id: "9", roleId: "2", roleCode: "reviewer", scopeType: "shop", scopeId: "store-1" }], hasMore: false };
    },
    fetchRoleNames: async () => ({ "2": "审核员" }),
    fetchRolePermissions: async () => ({ "2": { list: [{ code: "mall:review:read", description: "审核查看" }], error: "" } }),
  };
  const page = hgPageWithVM(vm);
  const column = page.getColumns().find((item) => item.title === "角色权限");
  const button = column.render(null, { id: "hgid_A", name: "甲" });
  button.props.onClick();
  await hgFlush();
  assert.deepEqual(requested, [["hgid_A", "0"]]);
  assert.match(hgText(page.renderBindingsModal()), /审核员/);
  assert.match(hgText(page.renderBindingsModal()), /审核查看\s*（\s*mall:review:read\s*）/);
  assert.match(hgText(page.renderBindingsModal()), /适用范围：\s*店铺\s*· store-1/);
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
  page.closeBindings();
  assert.equal(page.renderBindingsModal(), null);
});

test("请求失败保留错误提示与重试入口，不显示空权限结论", async () => {
  const vm = { fetchBindings: async () => { throw new Error("无权限"); } };
  const page = hgPageWithVM(vm);
  page.openBindings({ id: "hgid_A" });
  await hgFlush();
  const modal = page.renderBindingsModal();
  assert.match(hgText(modal), /角色绑定加载失败，请重试/);
  assert.doesNotMatch(hgText(modal), /暂无已生效的角色绑定/);
  const retry = modal.props.children.props.children.find((node) => React.isValidElement(node) && node.type === HGTestButton);
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

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
const HGTestTable = () => null; // 检查审批列与游标数据，不访问真实 DOM。

/** 转换当前员工角色页；授权查询/撤销已经迁移，替身只提供申请与独立审批队列。 */
function hgEmployeePage(vm, props = {}, actor = "") {
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
        __esModule: true, HG_APPROVAL_PAGE_SIZE: 20, INITIAL_BINDING_FORM: { userId: "", roleId: "", scopeType: "global", scopeId: "", expiresAt: "", mfaCode: "" },
        default: { fetchRolePermissions: async () => ({ list: [], selected: [] }), ...vm },
      };
      if (path.endsWith("hg_button_page")) return { __esModule: true, default: HGTestButton };
      if (path.endsWith("hg_permission")) return { HGAuthButton: HGTestButton };
      if (path.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: { IAM_GRANT: "iam:role:grant", IAM_APPROVE: "iam:approval:approve" } };
      if (path.endsWith("hg_iam_session")) return { hgCurrentIAMUser: () => actor };
      if (path.endsWith("hg_input_page")) return { __esModule: true, default: HGTestInput };
      if (path.endsWith("hg_modal_page")) return { __esModule: true, default: HGTestModal };
      if (path.endsWith("hg_table_page")) return { __esModule: true, default: HGTestTable };
      if (path.endsWith("hg_table_contract")) return { hgTableColumns: (columns) => columns };
      if (path.endsWith(".module.css")) return { __esModule: true, default: {} };
      if (path.endsWith("hg_message_page")) return {
        hgMessage: { error: (text) => messages.errors.push(text), success: (text) => messages.successes.push(text) },
      };
      return { __esModule: true, default: () => null };
    },
  });
  const page = new module.exports.default(props); // 测试中手动控制挂载/状态更新。
  page.hgMounted = true;
  page.setState = (update, callback) => {
    const previous = page.state; // 用真实生命周期检测切换角色后的权限重新加载。
    page.state = { ...page.state, ...(typeof update === "function" ? update(page.state) : update) };
    page.componentDidUpdate({}, previous);
    callback?.(); // 模拟 React 提交状态后才触发的裁决请求。
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

test("仅授权弹窗提示须先成为管理员，按钮切换到管理员列表菜单", () => {
  const selected = []; // 仅记录菜单 key，不触发真实路由或授权请求。
  const { page } = hgEmployeePage({}, { onMenuSelect: (key) => selected.push(key) });
  const css = readFileSync(new URL("./hg_employee_role.module.css", import.meta.url), "utf8"); // 警示色必须来自主题语义 token。
  assert.match(css, /\.adminPrerequisiteText\s*\{[^}]*color:\s*var\(--color-danger\)/s);
  assert.doesNotMatch(hgText(page.render()), /否则无法提交授权申请|查看管理员列表/);
  page.setState({ grantModalVisible: true });
  const modal = hgFind(page.render(), (node) => node.type === HGTestModal)[0];
  assert.match(hgText(modal), /目标用户必须先添加为启用的管理员.*否则无法提交授权申请/);
  const modalButton = hgFind(modal, (node) => node.type === HGTestButton && hgText(node) === "查看管理员列表")[0];
  assert.ok(modalButton);
  modalButton.props.onClick();
  assert.deepEqual(selected, ["admin_list"]);
  page.setState({ granting: true });
  assert.equal(hgFind(page.render(), (node) => node.type === HGTestButton && hgText(node) === "查看管理员列表")[0].props.disabled, true);
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

test("审批表格按授权与角色权限协议展示独立字段，不显示 JSON", async () => {
  const { page } = hgEmployeePage({
    fetchApprovals: async () => ({
      list: [
        { id: "8", applicantId: "actor", action: "grant", payload: { userId: "target", roleId: 12, scopeType: "shop", scopeId: "shop-1", expiresAt: "2026-12-01T00:00:00Z" }, expiresAt: "2026-11-30T00:00:00Z" },
        { id: "9", applicantId: "actor", action: "role_permissions", payload: { roleId: 13, permissions: ["iam:role:read", "iam:role:grant"], version: 0 }, expiresAt: "2026-11-30T00:00:00Z" },
      ],
    }),
  });
  page.loadApprovals(1);
  await hgFlush();
  const table = hgFind(page.renderApprovals(), (node) => node.type === HGTestTable)[0];
  assert.equal(table.props.rowKey, "id");
  assert.equal(table.props.fillHeight, false);
  assert.equal(table.props.dataSource.length, 2);
  const columns = table.props.columns; // 按表头定位对应协议字段，避免数组位置掩盖列语义。
  assert.deepEqual(Array.from(columns, (column) => column.title), ["申请单", "申请人", "操作", "目标管理员 ID", "角色 ID", "作用域", "作用域 ID", "授权到期", "权限编码", "角色版本", "审批截止", "裁决"]);
  assert.equal(new Set(Array.from(columns, (column) => column.key || column.dataIndex)).size, columns.length);
  const hgCell = (title, row) => {
    const column = columns.find((item) => item.title === title);
    return column.render(row[column.dataIndex], row);
  }; // 读取单元格展示值；无 JSON.stringify 或额外渲染环境。
  assert.equal(hgCell("目标管理员 ID", table.props.dataSource[0]), "target");
  assert.equal(hgCell("角色 ID", table.props.dataSource[0]), 12);
  assert.equal(hgCell("作用域", table.props.dataSource[0]), "shop");
  assert.equal(hgCell("作用域 ID", table.props.dataSource[0]), "shop-1");
  assert.match(hgCell("授权到期", table.props.dataSource[0]), /2026/);
  assert.equal(hgCell("权限编码", table.props.dataSource[0]), "—");
  assert.equal(hgCell("目标管理员 ID", table.props.dataSource[1]), "—");
  assert.equal(hgCell("角色版本", table.props.dataSource[1]), 0);
  assert.match(hgText(hgCell("权限编码", table.props.dataSource[1])), /iam:role:read、iam:role:grant/);
  assert.equal(hgText(hgCell("权限编码", { payload: { permissions: [] } })), "清空权限");
  assert.doesNotMatch(hgText(page.renderApprovals()), /刷新待审批|加载更多|变更内容/);
  const actions = columns.at(-1).render(null, table.props.dataSource[0]);
  const buttons = hgFind(actions, (node) => node.type === HGTestButton);
  assert.deepEqual(buttons.map(hgText), ["批准", "拒绝"]);
  assert.deepEqual(Array.from(buttons[0].props.allOf), ["iam:role:grant", "iam:approval:approve"]);
  assert.equal(buttons[1].props.danger, true);
  buttons[1].props.onClick();
  assert.deepEqual({ ...page.state.queueApprovalTarget }, { id: "8", approve: false });
  assert.ok(hgFind(page.render(), (node) => node.type === HGTestModal)[0]);
});

test("审批表格按游标翻页，返回上一页并在裁决后回到首页", async () => {
  const cursors = []; // 仅记录请求游标，不连接真实审批接口。
  const { page } = hgEmployeePage({
    fetchApprovals: async (cursor) => {
      cursors.push(cursor);
      return cursor === 0
        ? { list: Array.from({ length: 20 }, (_, index) => ({ id: String(index + 1) })), hasMore: true, nextCursor: "20" }
        : { list: [{ id: "21" }], hasMore: false };
    },
    decideApproval: async () => {},
  });
  page.loadApprovals(1);
  await hgFlush();
  let table = hgFind(page.renderApprovals(), (node) => node.type === HGTestTable)[0];
  assert.equal(table.props.pagination.current, 1);
  assert.equal(table.props.pagination.pageSize, 20);
  assert.equal(table.props.pagination.total, 21);
  table.props.onChange({ current: 2, pageSize: 20 });
  await hgFlush();
  table = hgFind(page.renderApprovals(), (node) => node.type === HGTestTable)[0];
  assert.equal(table.props.pagination.current, 2);
  assert.equal(table.props.pagination.total, 21);
  assert.deepEqual(table.props.dataSource.map((item) => item.id), ["21"]);
  table.props.onChange({ current: 1, pageSize: 20 });
  await hgFlush();
  assert.deepEqual(cursors, [0, "20", 0]);
  page.openQueueApproval({ id: "1", applicantId: "OTHER" }, true);
  page.setState({ queueApprovalCode: "123456" });
  page.decideQueueApproval();
  await hgFlush();
  assert.equal(page.state.approvalCurrentPage, 1);
  assert.deepEqual(Object.keys(page.state.approvalCursorByPage), ["1", "2"]);
  assert.deepEqual(cursors, [0, "20", 0, 0]);
});

test("审批弹窗取消或切换申请清除 MFA，校验失败不发请求", () => {
  const decisions = []; // 仅检查取消和无效输入没有发起请求，不保存验证码。
  const { page, messages } = hgEmployeePage({ decideApproval: (...args) => decisions.push(args) });
  page.openQueueApproval({ id: "8", applicantId: "OTHER" }, true);
  let modal = hgFind(page.render(), (node) => node.type === HGTestModal)[0];
  assert.match(modal.props.title, /批准申请单 #8/);
  const input = hgFind(modal, (node) => node.type === "input" && node.props.autoComplete === "one-time-code")[0];
  assert.ok(input);
  input.props.onChange({ target: { value: "123456" } });
  modal.props.onClose();
  assert.equal(page.state.queueApprovalTarget, null);
  assert.equal(page.state.queueApprovalCode, "");
  page.openQueueApproval({ id: "9", applicantId: "OTHER" }, false);
  modal = hgFind(page.render(), (node) => node.type === HGTestModal)[0];
  assert.match(modal.props.title, /拒绝申请单 #9/);
  assert.equal(hgFind(modal, (node) => node.type === "input")[0].props.value, "");
  const form = hgFind(modal, (node) => node.type === "form")[0];
  let prevented = false;
  form.props.onSubmit({ preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(decisions.length, 0);
  assert.match(messages.errors.at(-1), /MFA/);
  assert.ok(hgFind(page.render(), (node) => node.type === HGTestModal)[0]);
});

test("提交时先关闭审批弹窗，阻止重复请求；成功刷新，失败不复用动态码", async () => {
  const decisions = []; // 只记录编号、方向和弹窗显隐，避免测试保存敏感码。
  let resolveDecision; // 控制首个审批请求的完成时机。
  let reads = 0; // 成功后应刷新一次首页，失败时不刷新。
  const { page, messages } = hgEmployeePage({
    fetchApprovals: async () => { reads += 1; return { list: [] }; },
    decideApproval: (id, _code, approve) => {
      decisions.push([id, approve, page.state.queueApprovalTarget === null, page.state.queueApprovalCode === ""]);
      return new Promise((resolve) => { resolveDecision = resolve; });
    },
  });
  page.openQueueApproval({ id: "8", applicantId: "OTHER" }, true);
  page.setState({ queueApprovalCode: "123456" });
  page.decideQueueApproval();
  page.decideQueueApproval();
  page.openQueueApproval({ id: "9", applicantId: "OTHER" }, false);
  assert.deepEqual(decisions, [["8", true, true, true]]);
  assert.equal(page.state.queueApprovalTarget, null);
  assert.equal(page.state.approvalDeciding, true);
  assert.equal(hgFind(page.render(), (node) => node.type === HGTestModal).length, 0);
  resolveDecision();
  await hgFlush();
  assert.equal(page.state.approvalDeciding, false);
  assert.equal(reads, 1);
  assert.match(messages.successes.at(-1), /审批通过/);

  page.openQueueApproval({ id: "9", applicantId: "OTHER" }, false);
  page.setState({ queueApprovalCode: "654321" });
  page.decideQueueApproval();
  assert.deepEqual(decisions.at(-1), ["9", false, true, true]);
  resolveDecision(Promise.reject(new Error("裁决失败")));
  await hgFlush();
  assert.equal(page.state.approvalDeciding, false);
  assert.equal(page.state.queueApprovalCode, "");
  assert.equal(reads, 1);
  assert.match(messages.errors.at(-1), /裁决失败/);
  page.openQueueApproval({ id: "9", applicantId: "OTHER" }, false);
  assert.equal(page.state.queueApprovalCode, "");
});

test("本人申请不打开审批弹窗也不提交 MFA，须换另一名管理员", () => {
  const { page, messages } = hgEmployeePage({}, {}, "CURRENT");
  page.openQueueApproval({ id: "6", applicantId: "CURRENT" }, true);
  assert.equal(page.state.queueApprovalTarget, null);
  assert.equal(hgFind(page.render(), (node) => node.type === HGTestModal).length, 0);
  assert.match(messages.errors.at(-1), /不能审批本人提交的申请/);
  page.openQueueApproval({ id: "6", applicantId: "OTHER" }, true);
  assert.equal(page.state.queueApprovalTarget.id, "6");
});

test("审批冲突不冒充 MFA 错误，重新读取首页", async () => {
  let reads = 0; // 失败后只读刷新首页，不重发裁决。
  const { page, messages } = hgEmployeePage({
    fetchApprovals: async () => { reads += 1; return { list: [] }; },
    decideApproval: async () => { throw { code: 100009, message: "角色或授权状态冲突" }; },
  });
  page.openQueueApproval({ id: "6", applicantId: "OTHER" }, true);
  page.setState({ queueApprovalCode: "123456" });
  page.decideQueueApproval();
  await hgFlush();
  assert.equal(reads, 1);
  assert.match(messages.errors.at(-1), /审批冲突.*申请人.*角色版本/);
  assert.equal(page.state.queueApprovalCode, "");
  assert.equal(page.state.approvalDeciding, false);
});

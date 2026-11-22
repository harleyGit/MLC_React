import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { transformSync } from "@swc/core";
import React from "react";
import { createMemoryRouter, matchPath } from "react-router-dom";

// 仅加载导航与菜单定义的真实实现；网络、业务页和样式被隔离，不启动服务或提交数据。
const root = fileURLToPath(new URL("../../..", import.meta.url));
const realFiles = [
  "src/components/hg_navigation/hg_sub_nav.js",
  "src/components/hg_navigation/hg_route_path.jsx",
  "src/components/hg_navigation/hg_page_registry.jsx",
  "src/components/hg_navigation/hg_page_navigator.jsx",
  "src/components/menu_component/hg_side_menu_vm.jsx",
  "src/components/hg_breadcrumb/hg_breadcrumb_page.jsx",
  "src/components/hg_breadcrumb/hg_menu_breadcrumb.jsx",
  "src/manager_antd/router/hg_router_path.jsx",
  "src/manager_antd/page_modules/home/hg_top_nav_selection.js",
  "src/manager_antd/page_modules/operation_management/hg_operation_management_vm.jsx",
  "src/manager_antd/page_modules/user/user_center/hg_user_center_vm.jsx",
  "src/manager_antd/page_modules/test_module/hg_test_module_vm.jsx",
  "src/manager_antd/page_modules/personal_center/hg_content_center_vm.jsx",
  "src/manager_antd/page_modules/user/edit_user_info/hg_edit_user_page_vm.jsx",
  "src/manager_antd/page_modules/user/edit_user_info/hg_account_security_page_vm.jsx",
  "src/pages/crawler_platform/hg_crawler_platform_vm.jsx",
].map((path) => resolve(root, path));
const HGStub = () => null;

/** JSX 只在内存转换；未允许的依赖只提供展示替身，不执行请求或业务生命周期。 */
function load(path) {
  const filename = resolve(root, path);
  const module = { exports: {} };
  const source = readFileSync(filename, "utf8").replace(/import\.meta\.env\.MODE/g, '"debug"');
  const code = transformSync(source, {
    filename, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code;
  runInNewContext(code, {
    module, exports: module.exports, URL, URLSearchParams,
    require(dependency) {
      if (dependency === "react") return React;
      if (dependency === "react-router-dom") return { matchPath, Link: "a", Outlet: HGStub };
      const target = resolve(dirname(filename), dependency);
      const real = realFiles.find((file) => file === target || file === `${target}.jsx` || file === `${target}.js`);
      if (real) return load(real);
      if (dependency.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
      if (dependency.endsWith("hg_user_profile_storage")) return { __esModule: true, default: { getUserProfile: () => null } };
      if (dependency.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: { IAM_GRANT: "iam:role:grant", IAM_GRANT_DIRECT: "iam:role:grant_direct" } };
      return { __esModule: true, default: HGStub, hgMessage: {}, hgCanOpenOperation: () => true, hgFilterOperationMenu: (items) => items,
        HGLayoutPage: "div", HGLayoutHeader: "header", HGLayoutContent: "main", HGLayoutFooter: "footer" };
    },
  }, { filename });
  return module.exports;
}

/** 手动控制 React 类实例状态；只测试真实路由历史与页面分支，不将结构测试冒充浏览器渲染。 */
function instance(Type, props) {
  const page = new Type(props);
  page.setState = (update, done) => {
    page.state = { ...page.state, ...(typeof update === "function" ? update(page.state) : update) };
    done?.();
  };
  return page;
}

/** 每个用例使用真实 data router；刷新场景由在已有 URL 新建实例模拟。 */
function harness(path, t) {
  const router = createMemoryRouter([{ path: "*", element: null }], { initialEntries: [path] });
  const { HGPageNavigator } = load("src/components/hg_navigation/hg_page_navigator.jsx");
  const navigator = new HGPageNavigator();
  navigator.attach(router);
  t.after(() => { navigator.unsubscribe(); router.dispose(); });
  return { router, navigator, props: () => ({ location: router.state.location, navigate: router.navigate, pageNavigator: navigator }) };
}

test("作用域列表 → 编辑 → 按钮返回/浏览器前进后退保持同一对象与运维 Tab", async (t) => {
  const h = harness("/home", t);
  const Operation = load("src/manager_antd/page_modules/operation_management/hg_operation_management_page.jsx").default;
  const Scope = load("src/manager_antd/page_modules/operation_management/scope_type/hg_scope_type_page.jsx").default;
  const Layout = load("src/manager_antd/page_modules/home/hg_top_nav_layout.jsx").default;
  const operation = instance(Operation, h.props());
  const layout = instance(Layout, h.props());
  layout.updateCurrentPage();
  h.router.subscribe(() => {
    const previous = layout.props;
    operation.props = h.props();
    layout.props = h.props();
    layout.componentDidUpdate(previous);
  });
  await h.router.navigate("/operation?menu=role_scope_type");
  const listKey = h.router.state.location.key;
  const scope = instance(Scope, { selectedKey: operation.getSelectedKey(), pushPage: operation.pushPage });
  // 真实操作列的编辑按钮必须压入历史，而不是 setState 伪装成新页面。
  const table = scope.render().props.children[1].props.children.find((child) => child?.props?.columns);
  await table.props.columns.at(-1).render(null, { code: "shop" }).props.children[0].props.onClick();
  assert.equal(operation.getSelectedKey(), "role_scope_type_edit");
  assert.equal(layout.state.current, "operation");
  const form = instance(Scope, { selectedKey: operation.getSelectedKey(), location: h.router.state.location, onBack: operation.back });
  assert.equal(form.render().props.code, "shop");
  await form.render().props.onBack();
  assert.equal(h.router.state.location.key, listKey);
  assert.equal(layout.state.current, "operation");
  await h.router.navigate(1);
  assert.equal(operation.getSelectedKey(), "role_scope_type_edit");
  assert.equal(layout.state.current, "operation");
  await h.router.navigate(-1);
  assert.equal(h.router.state.location.key, listKey);
  // 创建也必须有独立历史项；非法编辑参数不能被当成创建页。
  await scope.render().props.children[0].props.extra.props.onClick();
  assert.equal(operation.getSelectedKey(), "role_scope_type_create");
  assert.equal(instance(Scope, { selectedKey: "role_scope_type_create" }).render().props.code, "");
  assert.match(JSON.stringify(instance(Scope, { selectedKey: "role_scope_type_edit", location: { search: "?code=" } }).render()), /缺少有效/);
});

test("通知管理的发送与渠道菜单分别打开独立内容页，支持浏览器后退", async (t) => {
  const h = harness("/operation?menu=system_notify_channel", t);
  const { OPERATION_MENU_ITEMS } = load("src/manager_antd/page_modules/operation_management/hg_operation_management_vm.jsx");
  const Operation = load("src/manager_antd/page_modules/operation_management/hg_operation_management_page.jsx").default;
  const children = OPERATION_MENU_ITEMS.find((item) => item.key === "system")
    .children.find((item) => item.key === "system_notify").children;
  assert.equal(children.find((item) => item.key === "system_notify_send")?.label, "发送通知");
  const page = instance(Operation, h.props());
  page.context = { status: "ready", snapshot: {} };
  const channel = page.renderContent("system_notify_channel").props.children.props.children.type;
  const send = page.renderContent("system_notify_send").props.children.props.children.type;
  assert.notEqual(channel, send);
  page.handleMenuSelect("system_notify_send");
  assert.equal(h.router.state.location.search, "?menu=system_notify_send");
  page.props = h.props();
  assert.equal(page.getSelectedKey(), "system_notify_send");
  await h.router.navigate(-1);
  page.props = h.props();
  assert.equal(page.getSelectedKey(), "system_notify_channel");
});

test("本人发送记录使用独立历史页，返回后仍高亮发送通知", async (t) => {
  const h = harness("/operation?menu=system_notify_send", t);
  const Operation = load("src/manager_antd/page_modules/operation_management/hg_operation_management_page.jsx").default;
  const page = instance(Operation, h.props());
  page.context = { status: "ready", snapshot: {} };
  await page.pushPage("system_notify_send_records");
  page.props = h.props();
  assert.equal(page.getSelectedKey(), "system_notify_send_records");
  assert.equal(Operation.HIDDEN_PARENT_KEY.system_notify_send_records, "system_notify_send");
  assert.ok(page.renderContent("system_notify_send_records").props.children.props.children);
  await page.back();
  page.props = h.props();
  assert.equal(page.getSelectedKey(), "system_notify_send");
});

test("共享详情页的 Tab 按历史项恢复，不被最近访问的栏目或头像浮层污染", async (t) => {
  const h = harness("/account/center?menu=review", t);
  const Layout = load("src/manager_antd/page_modules/home/hg_top_nav_layout.jsx").default;
  const layout = instance(Layout, h.props());
  layout.updateCurrentPage();
  h.router.subscribe(() => {
    const previous = layout.props;
    layout.props = h.props();
    layout.componentDidUpdate(previous);
  });
  await h.router.navigate("/mall/orders/ONE");
  assert.equal(layout.state.current, "profile");
  layout.toggleUserDropdown();
  layout.toggleUserDropdown();
  assert.equal(layout.state.current, "profile");
  await h.router.navigate("/products");
  await h.router.navigate("/mall/orders/TWO");
  assert.equal(layout.state.current, "products");
  await h.router.navigate(-2);
  assert.equal(layout.state.current, "profile");
  await h.router.navigate(2);
  assert.equal(layout.state.current, "products");
});

for (const [path, file, first, second, method, selected] of [
  ["/account/center", "user/user_center/hg_user_center_page", "review", "merchant", "handleMenuSelect", "getSelectedKey"],
  ["/test", "test_module/hg_test_module_page", "css_loading", "theme_palette", "handleMenuSelect", "getSelectedKey"],
  ["/personal/center", "personal_center/hg_content_center_page", "course_list", "order_list", "handleMenuClick", "getActiveMenu"],
  ["/account/setting", "user/edit_user_info/hg_edit_user_page", "avatar", "security", "handleMenuClick", "getActiveMenuKey"],
]) {
  test(`${path} 子菜单支持按钮、浏览器前进/后退和直达恢复`, async (t) => {
    const h = harness(path, t);
    const Type = load(`src/manager_antd/page_modules/${file}.jsx`).default;
    const page = instance(Type, h.props());
    h.router.subscribe(() => { page.props = h.props(); });
    page[method](path === "/personal/center" ? { key: first } : first);
    const firstKey = h.router.state.location.key;
    assert.equal(page[selected](), first);
    page[method](path === "/personal/center" ? { key: second } : second);
    assert.equal(page[selected](), second);
    await h.router.navigate(-1);
    assert.equal(h.router.state.location.key, firstKey);
    assert.equal(page[selected](), first);
    await h.router.navigate(1);
    assert.equal(page[selected](), second);
    assert.equal(instance(Type, h.props())[selected](), second);
  });
}

test("面包屑祖先是可导航链接，当前项标记 aria-current，修饰键不会被拦截", () => {
  const MenuBreadcrumb = load("src/components/hg_breadcrumb/hg_menu_breadcrumb.jsx").default;
  const tree = MenuBreadcrumb({
    basePath: "/operation", rootLabel: "运维管理", selectedKey: "edit",
    menuItems: [{ key: "role", label: "角色", children: [{ key: "list", label: "列表" }] }],
    hiddenPath: [{ key: "role", label: "角色" }, { key: "list", label: "列表" }, { key: "edit", label: "编辑" }],
  });
  assert.equal(tree.props.items[1].href, "/operation?menu=list");
  assert.equal(tree.props.items[2].href, "/operation?menu=list");
  const calls = [];
  const breadcrumb = instance(tree.type, { ...tree.props, onNavigate: (href) => calls.push(href) });
  const parent = breadcrumb.renderItem(tree.props.items[2], 2, false).props.children;
  let prevented = false;
  parent.props.onClick({ button: 0, preventDefault: () => { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(calls, ["/operation?menu=list"]);
  parent.props.onClick({ button: 0, ctrlKey: true, preventDefault: () => assert.fail("不拦截新标签页") });
  assert.equal(calls.length, 1);
  assert.equal(breadcrumb.renderItem(tree.props.items[3], 3, true).props["aria-current"], "page");
});

test("采集任务的多个详情历史项不混用上下文，返回和前进恢复原任务", async (t) => {
  const h = harness("/crawler?menu=crawler_tasks", t);
  const Type = load("src/pages/crawler_platform/hg_crawler_platform_page.jsx").default;
  const page = instance(Type, h.props());
  h.router.subscribe(() => { page.props = h.props(); });
  await page.pushPage("crawler_task_detail", { task: { id: 1 } });
  const first = h.router.state.location.key;
  await page.pushPage("crawler_task_detail", { task: { id: 2 } });
  await h.router.navigate(-1);
  assert.equal(h.router.state.location.key, first);
  const detail = page.render().props.children[1].props.children[1].props.children;
  assert.equal(detail.props.pageContext.task.id, 1);
  await page.back();
  assert.equal(page.getSelectedKey(), "crawler_tasks");
  await h.router.navigate(1);
  assert.equal(h.router.state.location.key, first);
});

test("账号安全详情从 URL 恢复页面但不恢复敏感草稿，返回列表使用相同历史", async (t) => {
  const h = harness("/account/setting?menu=security", t);
  const Parent = load("src/manager_antd/page_modules/user/edit_user_info/hg_edit_user_page.jsx").default;
  const Security = load("src/manager_antd/page_modules/user/edit_user_info/hg_account_security_page.jsx").default;
  const parent = instance(Parent, h.props());
  h.router.subscribe(() => { parent.props = h.props(); });
  const key = h.router.state.location.key;
  await parent.navigateSecurity("password");
  const element = parent.renderSecurityContent();
  const security = instance(Security, element.props);
  assert.equal(security.state.activeSecurityKey, "password");
  await security.handleBackSecurityList();
  assert.equal(h.router.state.location.key, key);
  await h.router.navigate(1);
  assert.equal(parent.renderSecurityContent().props.securityKey, "password");
  assert.equal(instance(Security, { securityKey: "unknown", userProfile: {} }).state.activeSecurityKey, "");
  const restored = instance(Security, parent.renderSecurityContent().props);
  for (const field of ["passwordValue", "oldPassword", "confirmPassword", "verificationCode"]) {
    assert.equal(restored.state.securityForm[field], "");
  }
});

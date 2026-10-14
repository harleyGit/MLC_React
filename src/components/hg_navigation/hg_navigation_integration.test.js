import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

/** 编译真实源码；仅允许显式依赖替身，不提供浏览器、网络或任意 require。 */
function hgLoadSource(hgPath, hgDependencies = {}) {
  const hgModule = { exports: {} };
  const hgCode = transformSync(readFileSync(new URL(hgPath, import.meta.url), "utf8"), {
    filename: hgPath,
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (hgRequest) => {
      if (hgRequest === "react") return React;
      assert.ok(Object.hasOwn(hgDependencies, hgRequest), `未声明的依赖: ${hgRequest}`);
      return hgDependencies[hgRequest];
    },
  }, { filename: hgPath });
  return hgModule.exports;
}

/** 每例使用独立 hook 状态和导航记录，真实 HOC 只依赖这些受控边界。 */
function hgCreateHarness() {
  const hgCalls = [];
  const hgLocation = { pathname: "/home", search: "?source=test", key: "home" };
  const hgParams = { uid: "user-1" };
  const hgNavigate = () => assert.fail("迁移后的业务入口不应调用 navigate");
  const hgPageNavigation = { params: { source: "test" } };
  const hgNavigator = {
    open: (hgOptions) => hgCalls.push(hgOptions),
    getPageNavigation: (hgValue) => {
      assert.equal(hgValue, hgLocation);
      return hgPageNavigation;
    },
  };
  const hgHooks = {
    useNavigate: () => hgNavigate,
    useLocation: () => hgLocation,
    useParams: () => hgParams,
  };
  const hgAdapter = hgLoadSource("../../manager_antd/router/hg_naviagion_hook.jsx", {
    "react-router-dom": hgHooks,
    "../../components/hg_navigation/hg_page_navigator": { hgPageNavigator: hgNavigator },
  });
  const hgWithRouter = hgLoadSource("../../utils/WithRouter.jsx", {
    "react-router-dom": hgHooks,
    "../components/hg_navigation/hg_page_navigator": { hgPageNavigator: hgNavigator },
  }).default;
  return { hgCalls, hgLocation, hgParams, hgNavigate, hgPageNavigation, hgNavigator, hgAdapter, hgWithRouter };
}

/** 检查真实 React 元素和注入对象身份，避免通过手工 props 掩盖适配器缺失。 */
function hgAssertInjection(hgElement, hgHarness) {
  assert.ok(React.isValidElement(hgElement));
  assert.equal(hgElement.props.pageNavigator, hgHarness.hgNavigator);
  assert.equal(hgElement.props.pageNavigation, hgHarness.hgPageNavigation);
  assert.equal(hgElement.props.location, hgHarness.hgLocation);
  assert.equal(hgElement.props.navigate, hgHarness.hgNavigate);
}

test("两个真实 HOC 保留业务 props，并注入导航协议及兼容 navigate", () => {
  const hgHarness = hgCreateHarness();
  const HGPage = () => null;
  for (const hgAdapter of [hgHarness.hgAdapter.WithNavigation, hgHarness.hgWithRouter]) {
    const HGWrapped = hgAdapter(HGPage);
    const hgElement = HGWrapped({ marker: "business", pageNavigator: null, pageNavigation: null, location: null, navigate: null });
    hgAssertInjection(hgElement, hgHarness);
    assert.equal(hgElement.type, HGPage);
    assert.equal(hgElement.props.marker, "business");
  }
  const HGWrapped = hgHarness.hgAdapter.WithNavigation(HGPage);
  assert.equal(HGWrapped({}).props.params, hgHarness.hgParams);
  hgHarness.hgLocation.search = "?source=updated";
  hgAssertInjection(HGWrapped({}), hgHarness);
});

test("真实路由为首页、钱包、充值及独立记录页注入导航，并保留鉴权布局", () => {
  const hgHarness = hgCreateHarness();
  const hgPaths = hgLoadSource("./hg_route_path.jsx");
  const hgRegistry = hgLoadSource("./hg_page_registry.jsx", {
    "./hg_route_path": hgPaths,
    "react-router-dom": { matchPath: () => assert.fail("此例不执行 URL 匹配") },
  });
  const hgHome = hgLoadSource("../../manager_antd/page_modules/home/hg_home_page.jsx", {
    "../../../components/hg_button/hg_button_page": "button",
    "../../auth/hg_auth": { logout: () => assert.fail("此例不退出登录") },
    "./hg_home.module.css": {},
    "../../../components/hg_navigation/hg_page_registry": hgRegistry,
  }).default;
  const hgWallet = hgLoadSource("../../manager_antd/page_modules/user/wallet/hg_wallet_page.jsx", {
    "../../../../components/hg_navigation/hg_page_registry": hgRegistry,
    "../../../../components/hg_message/hg_message_page": { hgMessage: {} },
    "../../../storage/hg_user_profile_storage": {},
    "./hg_wallet_page.module.css": {},
    "./hg_wallet_vm.js": {},
    "./hg_wallet_records_page.jsx": () => null,
  }).default;
  const HGLayout = () => null;
  const HGGuard = ({ children }) => children;
  const hgRouter = {};
  let hgRoutes;
  let hgAttached;
  hgHarness.hgNavigator.attach = (hgValue) => { hgAttached = hgValue; };
  const hgExport = hgLoadSource("../../manager_antd/router/hg_router.jsx", {
    "react-router-dom": {
      createBrowserRouter: (hgValue) => {
        assert.equal(hgRoutes, undefined, "只创建一次 router");
        hgRoutes = hgValue;
        return hgRouter;
      },
    },
    "../../components/hg_loading": () => null,
    "../auth/hg_auth_guard": HGGuard,
    "../page_modules/home/hg_home_page": hgHome,
    "../page_modules/home/hg_top_nav_layout": HGLayout,
    "./hg_naviagion_hook": hgHarness.hgAdapter,
    "./hg_router_path": hgLoadSource("../../manager_antd/router/hg_router_path.jsx", {
      "../../components/hg_navigation/hg_route_path": hgPaths,
    }),
    "../../components/hg_navigation/hg_page_registry": hgRegistry,
    "../../components/hg_navigation/hg_page_navigator": { hgPageNavigator: hgHarness.hgNavigator },
  });
  assert.equal(hgExport.default, hgRouter);
  assert.equal(hgAttached, hgRouter);
  const hgMain = hgRoutes.find((hgRoute) => hgRoute.children);
  assert.equal(hgMain.element.type, HGGuard);
  const hgLayoutElement = hgMain.element.props.children;
  const hgLayoutPage = hgLayoutElement.type(hgLayoutElement.props);
  hgAssertInjection(hgLayoutPage, hgHarness);
  assert.equal(hgLayoutPage.type, HGLayout);

  for (const [hgPath, hgExpected] of [
    ["/", hgHome],
    ["/home", hgHome],
    ["/account/wallet", hgRegistry.getHGPageConfig(hgRegistry.PAGE.WALLET).component],
    ["/account/wallet/recharge", hgRegistry.getHGPageConfig(hgRegistry.PAGE.WALLET_RECHARGE).component],
    ["/account/wallet/records", hgRegistry.getHGPageConfig(hgRegistry.PAGE.WALLET_RECORDS).component],
  ]) {
    const hgRoute = hgMain.children.find((hgValue) => hgValue.path === hgPath);
    assert.ok(hgRoute, `缺少路由 ${hgPath}`);
    assert.ok(React.isValidElement(hgRoute.element));
    const hgElement = hgRoute.element.type === React.Suspense
      ? hgRoute.element.props.children : hgRoute.element;
    assert.notEqual(hgElement.type, hgExpected, `${hgPath} 不应直接渲染未包装页面`);
    assert.equal(typeof hgElement.type, "function");
    const hgPage = hgElement.type(hgElement.props);
    hgAssertInjection(hgPage, hgHarness);
    assert.equal(hgPage.type, hgExpected);

    // 首页直接实例化真实类型；钱包复用路由注入 props，不触发 lazy 加载或挂载请求。
    if (hgExpected === hgHome) new hgPage.type(hgPage.props).viewPersonalProfile();
    if (hgPath === "/account/wallet") {
      const hgInstance = new hgWallet(hgPage.props);
      hgInstance.handleBack();
      hgInstance.handleRecharge();
    }
  }
  assert.deepEqual(hgHarness.hgCalls.map((hgCall) => hgCall.page), [
    hgRegistry.PAGE.USER_PROFILE, hgRegistry.PAGE.USER_PROFILE,
    hgRegistry.PAGE.EDIT_USER_INFO, hgRegistry.PAGE.WALLET_RECHARGE,
  ]);
  assert.equal(hgHarness.hgCalls[3].params.source, "wallet");
  assert.equal(typeof hgHarness.hgCalls[3].onSuccess, "function");
});

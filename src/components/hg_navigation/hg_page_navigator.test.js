import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { afterEach } from "node:test";
import { createMemoryRouter, redirect } from "react-router-dom";

// 纯 Node 不直接加载 JSX；按注册表测试的方式把两个源码模块装入 data URL。
const registrySource = await readFile(new URL("./hg_page_registry.jsx", import.meta.url), "utf8");
const routeSource = await readFile(new URL("./hg_route_path.jsx", import.meta.url), "utf8");
const routeModule = `data:text/javascript,${encodeURIComponent(routeSource)}`;
const registryModule = registrySource
  .replace('from "react"', `from "${import.meta.resolve("react")}"`)
  .replace('from "react-router-dom"', `from "${import.meta.resolve("react-router-dom")}"`)
  .replace('from "./hg_route_path"', `from "${routeModule}"`);
const registryURL = `data:text/javascript,${encodeURIComponent(registryModule)}`;
const navigatorSource = await readFile(new URL("./hg_page_navigator.jsx", import.meta.url), "utf8");
const navigatorModule = navigatorSource.replace(
  'from "./hg_page_registry"',
  `from "${registryURL}"`
);
const { PAGE } = await import(registryURL);
const { HGPageNavigator } = await import(`data:text/javascript,${encodeURIComponent(navigatorModule)}`);

const hgRouters = [];
afterEach(() => {
  hgRouters.splice(0).forEach((hgRouter) => hgRouter.dispose());
});

test("同 pathname 子会话 query POP 保留，回到父 entry 取消子会话并恢复父回调", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  const hgCalls = [];
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess: () => hgCalls.push("parent") });
  const hgParentKey = hgRouter.state.location.key;
  await hgNavigator.open({
    page: PAGE.WALLET_RECHARGE,
    onSuccess: () => hgCalls.push("child success"),
    onCancel: () => hgCalls.push("child cancel"),
  });
  const hgChild = hgNavigator.getPageNavigation(hgRouter.state.location);
  await hgRouter.navigate("/account/wallet/recharge?orderId=1");
  await hgRouter.navigate(-1);
  assert.deepEqual(hgCalls, []);
  assert.equal(hgNavigator.sessions.size, 2);
  await hgRouter.navigate(-1);
  assert.equal(hgRouter.state.location.key, hgParentKey);
  assert.deepEqual(hgCalls, ["child cancel"]);
  assert.equal(hgChild.success(), false);
  assert.equal(await hgNavigator.getPageNavigation(hgRouter.state.location).success(), true);
  assert.deepEqual(hgCalls, ["child cancel", "parent"]);
});

test("同 pathname POP 跨过多个子 entry 会从最深后代开始取消", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  const hgCalls = [];
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess: () => hgCalls.push("parent") });
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onCancel: () => hgCalls.push("child") });
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onCancel: () => hgCalls.push("grandchild") });
  await hgRouter.navigate(-2);
  assert.deepEqual(hgCalls, ["grandchild", "child"]);
  assert.equal(hgNavigator.sessions.size, 1);
  assert.equal(await hgNavigator.getPageNavigation(hgRouter.state.location).success(), true);
  assert.deepEqual(hgCalls, ["grandchild", "child", "parent"]);
});

for (const hgMethod of ["success", "cancel"]) {
  for (const hgOutcome of ["resolve", "reject", "throw"]) {
    test(`finish ${hgMethod} 遇到 navigate ${hgOutcome} 仅通知一个终态`, async () => {
      const { hgRouter, hgNavigator } = createHarness();
      const hgCalls = [];
      await hgNavigator.open({
        page: PAGE.WALLET_RECHARGE,
        onSuccess: (hgValue) => hgCalls.push(["success", hgValue]),
        onCancel: (hgValue) => hgCalls.push(["cancel", hgValue]),
        onError: (hgError) => hgCalls.push(["error", hgError]),
      });
      const hgNavigation = hgNavigator.getPageNavigation(hgRouter.state.location);
      const hgError = new Error("返回失败");
      let hgResolve;
      let hgReject;
      const hgPending = new Promise((resolve, reject) => { hgResolve = resolve; hgReject = reject; });
      const hgNavigate = hgRouter.navigate;
      let hgNavigateCalls = 0;
      hgRouter.navigate = () => {
        hgNavigateCalls += 1;
        if (hgOutcome === "throw") throw hgError;
        return hgPending;
      };
      try {
        const hgFinish = hgNavigation[hgMethod]("result");
        assert.equal(hgNavigator.sessions.size, 0);
        assert.equal(hgNavigation.success(), false);
        assert.equal(hgNavigation.cancel(), false);
        assert.equal(hgNavigation.error(hgError), false);
        assert.equal(hgNavigateCalls, 1);
        if (hgOutcome === "throw") {
          assert.equal(hgFinish, false);
        } else {
          assert.ok(hgFinish instanceof Promise);
          assert.deepEqual(hgCalls, []);
          if (hgOutcome === "resolve") hgResolve();
          else hgReject(hgError);
          assert.equal(await hgFinish, hgOutcome === "resolve");
        }
        assert.deepEqual(hgCalls, hgOutcome === "resolve"
          ? [[hgMethod, "result"]] : [["error", hgError]]);
      } finally {
        hgRouter.navigate = hgNavigate;
      }
    });
  }
}

/** 真实 data router 不加载业务页面或发起网络请求，每例结束释放订阅。 */
function createHarness(initialEntries = ["/home"]) {
  const hgRouter = createMemoryRouter([{ path: "*", element: null }], { initialEntries });
  hgRouters.push(hgRouter);
  const hgNavigator = new HGPageNavigator();
  hgNavigator.attach(hgRouter);
  return { hgRouter, hgNavigator };
}

/** 以状态通知等待异步 loader，不使用固定延迟猜测完成时机。 */
async function waitForIdle(hgRouter) {
  if (hgRouter.state.navigation.state === "idle") return;
  await new Promise((resolve, reject) => {
    const hgUnsubscribe = hgRouter.subscribe((hgState) => {
      if (hgState.navigation.state === "idle") {
        hgUnsubscribe();
        resolve();
      }
    });
    setTimeout(() => {
      hgUnsubscribe();
      reject(new Error("router 未回到 idle"));
    }, 1000).unref();
  });
}

test("open 编码原始 pathParams，params 只进 URL，回调留在内存", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  let hgResult;
  const hgState = { source: "state" };
  hgNavigator.open({
    page: PAGE.USER_SPACE,
    pathParams: { uid: "中文/a" },
    params: { tag: ["a", "b"], empty: "" },
    state: hgState,
    onSuccess: (value) => { hgResult = value; },
  });
  await waitForIdle(hgRouter);
  assert.equal(hgRouter.state.location.pathname, "/space/%E4%B8%AD%E6%96%87%2Fa");
  assert.equal(hgRouter.state.location.search, "?tag=a&tag=b&empty=");
  assert.deepEqual(hgRouter.state.location.state, hgState);
  assert.equal(hgRouter.state.location.search.includes("session"), false);
  assert.deepEqual(hgNavigator.getPageNavigation(hgRouter.state.location).params,
    { tag: ["a", "b"], empty: "" });
  assert.equal(await hgNavigator.getPageNavigation(hgRouter.state.location).success("paid"), true);
  await waitForIdle(hgRouter);
  assert.equal(hgResult, "paid");
  assert.equal(hgRouter.state.location.pathname, "/home");
});

test("未知 page、缺失或多余 pathParams、非法 state 会清晰抛错", () => {
  const { hgNavigator } = createHarness();
  assert.throws(() => hgNavigator.open({ page: "UNKNOWN" }), /未知页面/);
  assert.throws(() => hgNavigator.open({ page: PAGE.USER_SPACE }), /缺少路由参数: uid/);
  assert.throws(() => hgNavigator.open({ page: PAGE.USER_SPACE, pathParams: { uid: "1", extra: "2" } }), /多余路由参数/);
  assert.throws(() => hgNavigator.open({ page: PAGE.USER_SPACE, pathParams: { uid: "1" }, state: { callback() {} } }), /结构化克隆/);
  assert.throws(() => hgNavigator.open({ page: PAGE.USER_SPACE, pathParams: { uid: "1" }, params: { bad: {} } }), /params.bad/);
});

test("success/cancel/error 一次性消费，会话和回调异常都不会重复处理", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  let hgSuccessCalls = 0;
  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess: () => { hgSuccessCalls += 1; throw new Error("callback"); } });
  await waitForIdle(hgRouter);
  const hgNavigation = hgNavigator.getPageNavigation(hgRouter.state.location);
  const hgFinish = hgNavigation.success("ok");
  assert.equal(hgNavigation.success("again"), false);
  assert.equal(await hgFinish, true);
  await waitForIdle(hgRouter);
  assert.equal(hgSuccessCalls, 1);
  assert.equal(hgRouter.state.location.pathname, "/home");

  let hgError;
  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onError: (error) => { hgError = error; } });
  await waitForIdle(hgRouter);
  const hgErrorNavigation = hgNavigator.getPageNavigation(hgRouter.state.location);
  const error = new Error("failed");
  assert.equal(hgErrorNavigation.error(error), true);
  assert.equal(hgErrorNavigation.error(error), false);
  assert.equal(hgError, error);
});

test("充值同一路径 query 仍识别内存会话，内部 push 完成后不退到详情", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  let hgResult;
  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess: (value) => { hgResult = value; } });
  await waitForIdle(hgRouter);
  await hgRouter.navigate("/account/wallet/recharge?orderId=order-1");
  await waitForIdle(hgRouter);
  const hgNavigation = hgNavigator.getPageNavigation(hgRouter.state.location);
  assert.deepEqual(hgNavigation.params, { orderId: "order-1" });
  assert.equal(await hgNavigation.success("paid"), true);
  await waitForIdle(hgRouter);
  assert.equal(hgResult, "paid");
  assert.equal(hgRouter.state.location.pathname, "/home");
  assert.equal(hgRouter.state.location.search, "");
});

test("browser back、顶部导航和无会话直达不会误退外站", async () => {
  const { hgRouter, hgNavigator } = createHarness(["/home"]);
  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onCancel: () => { throw new Error("cancel callback"); } });
  await waitForIdle(hgRouter);
  await hgRouter.navigate(-1);
  await waitForIdle(hgRouter);
  assert.equal(hgRouter.state.location.pathname, "/home");
  assert.equal(hgNavigator.getPageNavigation(hgRouter.state.location).cancel(), false);

  await hgRouter.navigate("/account/wallet/recharge?orderId=direct");
  await waitForIdle(hgRouter);
  assert.equal(hgNavigator.getPageNavigation(hgRouter.state.location).success("ignored"), false);
  assert.equal(hgRouter.state.location.pathname, "/account/wallet/recharge");
});

test("嵌套会话按子会话优先，refresh/重新 attach 后会话失效", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  const hgCalls = [];
  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess: () => hgCalls.push("parent") });
  await waitForIdle(hgRouter);
  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess: () => hgCalls.push("child") });
  await waitForIdle(hgRouter);
  assert.equal(await hgNavigator.getPageNavigation(hgRouter.state.location).success(), true);
  await waitForIdle(hgRouter);
  assert.deepEqual(hgCalls, ["child"]);
  assert.equal(await hgNavigator.getPageNavigation(hgRouter.state.location).success(), true);
  await waitForIdle(hgRouter);
  assert.deepEqual(hgCalls, ["child", "parent"]);

  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess: () => hgCalls.push("stale") });
  await waitForIdle(hgRouter);
  hgNavigator.attach(hgRouter);
  assert.equal(hgNavigator.getPageNavigation(hgRouter.state.location).success(), false);
  assert.deepEqual(hgCalls, ["child", "parent"]);
});

test("navigate 同步抛错或 reject 会清理会话并调用 onError", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  let hgError;
  const hgNavigate = hgRouter.navigate;
  hgRouter.navigate = () => { throw new Error("sync navigation failure"); };
  assert.throws(() => hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onError: (error) => { hgError = error; } }), /sync navigation failure/);
  assert.match(hgError.message, /sync navigation failure/);
  hgRouter.navigate = hgNavigate;

  let hgRejected;
  hgRouter.navigate = () => Promise.reject(new Error("async navigation failure"));
  hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onError: (error) => { hgRejected = error; } });
  await Promise.resolve();
  assert.match(hgRejected.message, /async navigation failure/);
  hgRouter.navigate = hgNavigate;
});

test("不同 pathname 嵌套返回父页，顶部导航一次取消整条会话链", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  const hgCalls = [];
  await hgNavigator.open({ page: PAGE.WALLET, onCancel: () => hgCalls.push("parent") });
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onCancel: () => hgCalls.push("child") });
  assert.deepEqual(hgCalls, []);
  assert.equal(await hgNavigator.getPageNavigation(hgRouter.state.location).cancel(), true);
  assert.equal(hgRouter.state.location.pathname, "/account/wallet");
  assert.deepEqual(hgCalls, ["child"]);
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onCancel: () => hgCalls.push("child2") });
  await hgRouter.navigate("/about");
  assert.deepEqual(hgCalls, ["child", "child2", "parent"]);
  assert.equal(hgNavigator.sessions.size, 0);
});

test("replace 打开只替换来源，保留来源 query/hash，不后退到未知历史", async () => {
  const { hgRouter, hgNavigator } = createHarness(["/about", "/home?tab=wallet#balance"]);
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, replace: true, onSuccess() {} });
  assert.equal(await hgNavigator.getPageNavigation(hgRouter.state.location).success(), true);
  assert.equal(hgRouter.state.location.pathname, "/home");
  assert.equal(hgRouter.state.location.search, "?tab=wallet");
  assert.equal(hgRouter.state.location.hash, "#balance");
});

test("新实例模拟 refresh，URL 和 history state 无法恢复回调", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess() {} });
  const hgFresh = new HGPageNavigator();
  hgFresh.attach(hgRouter);
  const hgNavigation = hgFresh.getPageNavigation(hgRouter.state.location);
  assert.equal(hgNavigation.success(), false);
  assert.equal(hgNavigation.cancel(), false);
  assert.equal(hgNavigation.error(new Error("direct")), false);
  assert.equal(hgRouter.state.location.pathname, "/account/wallet/recharge");
});

test("重复 attach 取消旧订阅，旧句柄不得消费新会话", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  const hgSubscribe = hgRouter.subscribe;
  let hgUnsubscribed = 0;
  hgRouter.subscribe = (...args) => {
    const hgUnsubscribe = hgSubscribe(...args);
    return () => { hgUnsubscribed += 1; hgUnsubscribe(); };
  };
  hgNavigator.attach(hgRouter);
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess() {} });
  const hgOld = hgNavigator.getPageNavigation(hgRouter.state.location);
  hgNavigator.attach(hgRouter);
  assert.equal(hgUnsubscribed, 1);
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onSuccess() {} });
  assert.equal(hgOld.success(), false);
  assert.equal(hgNavigator.sessions.size, 1);
});

test("loader 阶段不提前取消，最终离开才清理", async () => {
  let hgRelease;
  const hgGate = new Promise((resolve) => { hgRelease = resolve; });
  const hgRouter = createMemoryRouter([
    { path: "/home", element: null },
    { path: "/account/wallet/recharge", element: null, loader: () => hgGate },
  ], { initialEntries: ["/home"] });
  hgRouters.push(hgRouter);
  const hgNavigator = new HGPageNavigator();
  hgNavigator.attach(hgRouter);
  let hgCancelled = 0;
  const hgPending = hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onCancel: () => { hgCancelled += 1; } });
  assert.equal(hgRouter.state.navigation.state, "loading");
  assert.equal(hgCancelled, 0);
  assert.equal(hgNavigator.sessions.size, 1);
  hgRelease(null);
  await hgPending;
  assert.equal(hgCancelled, 0);
  await hgRouter.navigate("/home");
  assert.equal(hgCancelled, 1);
  assert.equal(hgNavigator.sessions.size, 0);
});

test("loader 重定向到其他 pathname 会取消并释放会话", async () => {
  const hgRouter = createMemoryRouter([
    { path: "/home", element: null },
    { path: "/login", element: null },
    { path: "/account/wallet/recharge", loader: () => redirect("/login") },
  ], { initialEntries: ["/home"] });
  hgRouters.push(hgRouter);
  const hgNavigator = new HGPageNavigator();
  hgNavigator.attach(hgRouter);
  let hgCancelled = 0;
  await hgNavigator.open({ page: PAGE.WALLET_RECHARGE, onCancel: () => { hgCancelled += 1; } });
  assert.equal(hgRouter.state.location.pathname, "/login");
  assert.equal(hgCancelled, 1);
  assert.equal(hgNavigator.sessions.size, 0);
});

test("查询特殊键安全保留，非法值均在 navigate 前拒绝", async () => {
  const { hgRouter, hgNavigator } = createHarness();
  await hgNavigator.open({ page: PAGE.HOME, params: new URLSearchParams("__proto__=safe&a=1&a=2"), hash: "section" });
  const hgParams = hgNavigator.getPageNavigation(hgRouter.state.location).params;
  assert.equal(Object.getPrototypeOf(hgParams), Object.prototype);
  assert.equal(hgParams.__proto__, "safe");
  assert.deepEqual(hgParams.a, ["1", "2"]);
  assert.equal(hgRouter.state.location.hash, "#section");
  for (const uid of ["", ".", "..", NaN, {}, () => {}]) {
    assert.throws(() => hgNavigator.open({ page: PAGE.USER_SPACE, pathParams: { uid } }), /pathParams/);
  }
  assert.throws(() => hgNavigator.open({ page: PAGE.HOME, params: { value: Infinity } }), /params/);
  assert.throws(() => hgNavigator.open({ page: PAGE.HOME, onSuccess: true }), /onSuccess/);
  assert.throws(() => hgNavigator.open({ page: PAGE.HOME, replace: "yes" }), /replace/);
  assert.throws(() => hgNavigator.open({ page: PAGE.HOME, hash: {} }), /hash/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 只隔离退出事件：不挂载 React、不连接本机 API，也不读取浏览器凭据。 */
function hgLogoutFixture() {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_top_nav_layout.jsx", import.meta.url), "utf8")
    .replaceAll("import.meta.env.MODE", '"debug"');
  const hgCode = transformSync(hgSource, {
    filename: "hg_top_nav_layout.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, transform: { react: { runtime: "classic" } }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const hgCalls = []; // 仅记录执行步骤，不存储真实凭据。
  let hgSessionID = "session-original"; // 模拟同用户再次登录后切换 sid。
  let hgDevice = async () => {};
  let hgIAM = async () => {};
  class HGComponent {
    constructor(props) { this.props = props; }
    setState(update) { this.state = { ...this.state, ...update }; }
  }
  const hgReact = { Component: HGComponent, createRef: () => ({ current: null }) };
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    require: (id) => {
      if (id === "react") return { __esModule: true, default: hgReact, Component: HGComponent };
      if (id.endsWith("hg_im_device")) return { hgRevokeIMDevice: (...args) => { hgCalls.push(["device", ...args]); return hgDevice(); } };
      if (id.endsWith("hg_iam_api")) return { hgRevokeIAMLogin: () => { hgCalls.push(["iam"]); return hgIAM(); } };
      if (id.endsWith("hg_auth")) return { logout: () => hgCalls.push(["local"]) };
      if (id.endsWith("hg_im_session")) return { hgIMOwner: () => "fixture-user", hgIMSessionID: () => hgSessionID };
      if (id.endsWith("hg_message_page")) return { hgMessage: { warning: () => hgCalls.push(["warning"]) } };
      if (id.endsWith("hg_user_profile_storage")) return { __esModule: true, default: { getUserProfile: () => null } };
      if (id.endsWith("hg_top_nav_selection")) return { hgTopNavKeyForPath: () => "" };
      if (id.endsWith("hg_page_registry")) return { PAGE: { LOGIN: "login" } };
      return {};
    },
    window: { confirm: () => false },
  });
  const hgPage = new hgModule.exports.default({
    pageNavigator: { open: ({ page }) => hgCalls.push(["navigate", page]) },
  });
  return {
    page: hgPage, calls: hgCalls,
    device: (fn) => { hgDevice = fn; },
    iam: (fn) => { hgIAM = fn; },
    switchSession: () => { hgSessionID = "session-new"; },
  };
}

test("旧设备接口 401 时停止后续请求，仅清除本地凭据并说明远端未确认", async () => {
  const hg = hgLogoutFixture();
  hg.device(async () => { throw { type: "AUTH_ERROR", status: 401 }; });
  await hg.page.gotoLogoutPage();
  assert.deepEqual(hg.calls, [
    ["device", false, true], ["warning"], ["local"], ["navigate", "login"],
  ]);
  assert.equal(hg.page.hgLoggingOut, false);
});

test("有效登录态先撤销设备再撤销会话；其他故障仍需用户确认", async () => {
  const hg = hgLogoutFixture();
  await hg.page.gotoLogoutPage();
  assert.deepEqual(hg.calls, [
    ["device", false, true], ["iam"], ["local"], ["navigate", "login"],
  ]);
  const failed = hgLogoutFixture();
  failed.device(async () => { throw new Error("网络故障"); });
  await failed.page.gotoLogoutPage();
  assert.deepEqual(failed.calls, [["device", false, true], ["warning"]]);
});

test("旧会话接口 401 时仍能本地退出，但不声称远端已撤销", async () => {
  const hg = hgLogoutFixture();
  hg.iam(async () => { throw { type: "AUTH_ERROR", status: 401 }; });
  await hg.page.gotoLogoutPage();
  assert.deepEqual(hg.calls, [
    ["device", false, true], ["iam"], ["warning"], ["local"], ["navigate", "login"],
  ]);
});

test("异步撤销期间同账号重新登录，不清除新会话也不撤销新会话", async () => {
  const hg = hgLogoutFixture();
  let hgFinishDevice;
  hg.device(() => new Promise((resolve) => { hgFinishDevice = resolve; }));
  const pending = hg.page.gotoLogoutPage();
  hg.switchSession();
  hgFinishDevice();
  await pending;
  assert.deepEqual(hg.calls, [["device", false, true]]);
});

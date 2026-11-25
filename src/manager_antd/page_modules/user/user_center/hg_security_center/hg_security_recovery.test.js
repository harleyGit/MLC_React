import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 转换真实 JSX；模拟浏览器会话和网络，不读存储、不连接邮件服务。 */
function hgLoadPage(path, imports, globals = {}) {
  const hgModule = { exports: {} };
  const hgCode = transformSync(readFileSync(new URL(path, import.meta.url), "utf8"), {
    filename: path,
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022", transform: { react: { runtime: "classic" } } },
    module: { type: "commonjs" },
  }).code;
  class HGComponent {
    constructor(props) { this.props = props; }
    setState(update) { this.state = { ...this.state, ...update }; }
  }
  const hgReact = { createElement: (element, props, ...children) => ({ element, props, children }), createRef: () => ({ current: null }) };
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    require: (id) => id === "react" ? { __esModule: true, Component: HGComponent, default: hgReact } : imports[id.split("/").at(-1)] ?? {},
    ...globals,
  });
  return hgModule.exports.default;
}

function hgSecurityFixture() {
  const hgCalls = [];
  const hgTimers = new Set();
  let hgSID = "current-sid";
  let hgConfirm = true;
  const hgVM = {
    recoveryStatus: async () => ({ mfaEnabled: true, emailVerified: true, emailMasked: "***@example.org", resetEnabled: true, availableAt: new Date(Date.now() + 60_000).toISOString() }),
    sendBindCode: async (email) => { hgCalls.push(["send-bind", email]); },
    bindRecovery: async (email, emailCode, mfaCode) => { hgCalls.push(["bind", email, emailCode, mfaCode]); },
    resetMFA: async () => ({ reloginRequired: true }),
  };
  const HGPage = hgLoadPage("./hg_security_center_page.jsx", {
    hg_security_center_vm: hgVM,
    hg_auth: { logout: () => hgCalls.push(["logout"]) },
    hg_im_session: { hgIMOwner: () => "fixture-user", hgIMSessionID: () => hgSID },
    hg_message_page: { hgMessage: { success: () => {}, error: (msg) => hgCalls.push(["error", msg]) } },
  }, {
    window: { confirm: () => hgConfirm, location: { replace: (url) => hgCalls.push(["redirect", url]) } },
    setTimeout: (fn) => { hgTimers.add(fn); return fn; },
    clearTimeout: (fn) => hgTimers.delete(fn),
  });
  const page = new HGPage({});
  page.hgMounted = true;
  page.hgPageSession = page.hgSessionIdentity();
  return { page, hgCalls, hgTimers, hgVM, switchSession: () => { hgSID = "new-sid"; }, rejectConfirm: () => { hgConfirm = false; } };
}

function hgFindButton(tree, label) {
  if (tree?.children?.includes(label)) return tree;
  for (const child of tree?.children || []) {
    const found = hgFindButton(child, label);
    if (found) return found;
  }
}

test("先选择邮箱服务商，同域名才允许发送；切换服务商清除旧地址和验证码", async () => {
  const { page } = hgSecurityFixture();
  await page.hgLoadRecoveryStatus();
  const send = () => hgFindButton(page.renderRecoveryEmail(), "发送邮箱验证码");
  page.hgSetRecoveryAddress({ target: { value: "fixture@icloud.com" } });
  assert.equal(send().props.disabled, true);
  page.hgSetRecoveryProvider({ target: { value: "icloud" } });
  page.hgSetRecoveryAddress({ target: { value: "fixture@gmail.com" } });
  assert.equal(send().props.disabled, true);
  page.hgSetRecoveryAddress({ target: { value: "fixture@ME.COM" } });
  assert.equal(send().props.disabled, false);
  page.setState({ hgRecoveryEmailCode: "000011", hgRecoveryMfaCode: "000022" });
  page.hgSetRecoveryProvider({ target: { value: "qq" } });
  assert.equal(page.state.hgRecoveryEmail, "");
  assert.equal(page.state.hgRecoveryEmailCode, "");
  assert.equal(page.state.hgRecoveryMfaCode, "");
  page.hgSetRecoveryAddress({ target: { value: "fixture@qq.com" } });
  assert.equal(send().props.disabled, false);
  page.hgSetRecoveryProvider({ target: { value: "other" } });
  page.hgSetRecoveryAddress({ target: { value: "fixture@custom.example" } });
  assert.equal(send().props.disabled, false);
});

test("只有发信成功并录入两个验证码后才绑定恢复邮箱；更换输入地址清空旧码", async () => {
  const { page, hgCalls, hgVM } = hgSecurityFixture();
  await page.hgLoadRecoveryStatus();
  page.hgSetRecoveryProvider({ target: { value: "icloud" } });
  page.hgSetRecoveryAddress({ target: { value: "fixture@icloud.com" } });
  const send = () => hgFindButton(page.renderRecoveryEmail(), "发送邮箱验证码");
  const bind = () => hgFindButton(page.renderRecoveryEmail(), "验证邮箱并绑定");
  assert.equal(bind().props.disabled, true);
  const success = hgVM.sendBindCode;
  hgVM.sendBindCode = async () => { throw new Error("发信失败"); };
  await send().props.onClick();
  assert.equal(page.state.hgBindSentTo, "");
  hgVM.sendBindCode = success;
  await send().props.onClick();
  assert.deepEqual(hgCalls.slice(0, 2), [["error", "发信失败"], ["send-bind", "fixture@icloud.com"]]);
  page.setState({ hgRecoveryEmailCode: "000011", hgRecoveryMfaCode: "000022" });
  assert.equal(bind().props.disabled, false);
  await bind().props.onClick();
  assert.deepEqual(hgCalls.at(-1), ["bind", "fixture@icloud.com", "000011", "000022"]);
  assert.equal(page.state.hgRecoveryEmailCode, "");
  page.setState({ hgBindSentTo: "fixture@icloud.com", hgRecoveryEmailCode: "000011" });
  page.hgSetRecoveryAddress({ target: { value: "another@qq.com" } });
  assert.equal(page.state.hgRecoveryEmailCode, "");
  assert.equal(bind().props.disabled, true);
});

test("已验证邮箱到冷却期末才解锁，无需刷新；卸载清理定时器", async () => {
  const { page, hgTimers } = hgSecurityFixture();
  await page.hgLoadRecoveryStatus();
  assert.equal(page.state.hgRecoveryStatus.emailVerified, true);
  assert.equal(hgFindButton(page.renderRecoveryReset(), "发送找回邮件码").props.disabled, true);
  assert.equal(hgTimers.size, 1);
  [...hgTimers][0]();
  assert.equal(hgFindButton(page.renderRecoveryReset(), "发送找回邮件码").props.disabled, false);
  page.componentWillUnmount();
  assert.equal(hgTimers.size, 0);
});

test("重置失败保留会话；成功重新登录，异步旧结果不清理新会话", async () => {
  const prepare = (page) => page.setState({ hgResetSent: true, hgResetPassword: "fixture", hgResetEmailCode: "000012" });
  const failed = hgSecurityFixture();
  failed.hgVM.resetMFA = async () => { throw new Error("邮箱码错误"); };
  prepare(failed.page);
  await failed.page.hgResetMFA();
  assert.deepEqual(failed.hgCalls, [["error", "邮箱码错误"]]);
  assert.equal(failed.page.state.hgResetPassword, "");
  const cancelled = hgSecurityFixture();
  prepare(cancelled.page);
  cancelled.rejectConfirm();
  await cancelled.page.hgResetMFA();
  assert.deepEqual(cancelled.hgCalls, []);
  const success = hgSecurityFixture();
  prepare(success.page);
  await success.page.hgResetMFA();
  assert.deepEqual(success.hgCalls, [["logout"], ["redirect", "/login?mfaReset=1"]]);
  const stale = hgSecurityFixture();
  prepare(stale.page);
  stale.hgVM.resetMFA = async () => {
    stale.switchSession();
    return { reloginRequired: true };
  };
  await stale.page.hgResetMFA();
  assert.deepEqual(stale.hgCalls, []);
});

test("邮箱注册只在发信成功后启动倒计时，不读取响应中的验证码", async () => {
  const hgResults = [];
  let hgSend = async () => ({ verifyCode: "should-not-refill" });
  const HGRegister = hgLoadPage("../../../login_module/hg_ register_page.jsx", {
    hg_naviagion_hook: { WithNavigation: (value) => value },
    hg_login_vm: { __esModule: true, default: { requestSendEmailVerifyCode: () => hgSend() }, HGRegisterType: { EMAIL: "email" } },
    hg_ui_feedback: { showSuccess: () => hgResults.push("sent") },
    HttpManagerV1: { handleError: () => hgResults.push("error") },
  });
  const page = new HGRegister({ location: { state: { registerType: "email" } } });
  page.componentDidMount();
  page.formRef.current = { getFieldValue: () => "fixture@gmail.com", setFieldsValue: ({ code }) => hgResults.push(code) };
  page.startCountdown = () => hgResults.push("countdown");
  page.handleCaptchaSuccess("captcha-fixture");
  assert.deepEqual(hgResults, []);
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(hgResults, ["", "sent", "countdown"]);
  hgSend = async () => { throw new Error("mail server error"); };
  page.handleCaptchaSuccess("new-captcha-fixture");
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  assert.deepEqual(hgResults, ["", "sent", "countdown", "error"]);
});

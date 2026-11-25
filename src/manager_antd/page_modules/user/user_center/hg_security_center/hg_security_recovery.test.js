import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import { hgBuildSubMenuUrl, hgReadSubMenuKey } from "../../../../../components/hg_navigation/hg_sub_nav.js";

/** 转换真实 JSX；模拟浏览器会话和网络，不读存储、不连接邮件服务。 */
function hgLoadModule(path, imports, globals = {}) {
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
  return hgModule.exports;
}

const hgLoadPage = (...args) => hgLoadModule(...args).default;

/** 两个子页复用同一组请求替身；时钟和会话变化由测试显式控制。 */
function hgSecurityFixture(hgSetup = false) {
  const hgCalls = [];
  const hgTimers = new Set();
  let hgSID = "current-sid";
  let hgNow = Date.now();
  const hgStatus = { mfaEnabled: true, emailVerified: true, emailMasked: "***@example.org", resetEnabled: true, availableAt: new Date(hgNow + 60_000).toISOString() };
  const hgVM = {
    recoveryStatus: async () => hgStatus,
    sendBindCode: async (email) => { hgCalls.push(["send-bind", email]); },
    bindRecovery: async (email, emailCode, mfaCode) => { hgCalls.push(["bind", email, emailCode, mfaCode]); },
    sendResetCode: async () => { hgCalls.push(["send-reset"]); },
    resetMFA: async (password, emailCode) => {
      hgCalls.push(["reset", password, emailCode]);
      return { reloginRequired: true };
    },
  };
  const HGPage = hgLoadPage(hgSetup ? "./hg_security_center_page.jsx" : "./hg_mfa_recovery_page.jsx", {
    hg_security_center_vm: hgVM,
    "react-router-dom": { Link: "link-stub" },
    hg_auth: { logout: () => hgCalls.push(["logout"]) },
    hg_im_session: { hgIMOwner: () => "fixture-user", hgIMSessionID: () => hgSID },
    hg_message_page: { hgMessage: { success: () => {}, error: (msg) => hgCalls.push(["error", msg]) } },
  }, {
    window: { location: { replace: (url) => hgCalls.push(["redirect", url]) } },
    Date: class extends Date { static now() { return hgNow; } },
    setTimeout: (fn) => { hgTimers.add(fn); return fn; },
    clearTimeout: (fn) => hgTimers.delete(fn),
  });
  const page = new HGPage({
    hgMfaUrl: "/account/center?menu=security_mfa",
    hgRecoveryUrl: "/account/center?menu=security_mfa_recovery",
  });
  page.hgMounted = true;
  page.hgPageSession = page.hgSessionIdentity();
  return {
    page, hgCalls, hgTimers, hgVM, hgStatus,
    makeReady: () => { hgNow = Date.parse(hgStatus.availableAt); },
    switchSession: () => { hgSID = "new-sid"; },
  };
}

function hgFindButton(tree, label) {
  if (tree?.children?.includes(label)) return tree;
  for (const child of Array.isArray(tree) ? tree : tree?.children || []) {
    const found = hgFindButton(child, label);
    if (found) return found;
  }
}

test("安全中心两个子菜单按 URL 打开独立页面，并互相提供导航地址", () => {
  const hgMenu = hgLoadModule("../hg_user_center_vm.jsx", {});
  const { SECURITY_MFA, SECURITY_MFA_RECOVERY } = hgMenu.USER_CENTER_MENU_KEYS;
  const hgSecurity = hgMenu.USER_CENTER_MENU_ITEMS.find(({ key }) => key === "security_center");
  assert.deepEqual(Array.from(hgSecurity.children, ({ key }) => key), [SECURITY_MFA, SECURITY_MFA_RECOVERY]);

  const HGMfa = () => null; // 内容区根据菜单键只挂载一个子页。
  const HGRecovery = () => null;
  const HGCenter = hgLoadPage("../hg_user_center_page.jsx", {
    hg_user_center_vm: hgMenu,
    hg_sub_nav: { hgBuildSubMenuUrl, hgReadSubMenuKey },
    hg_route_path: { ROUTE_PATH: { USER_CENTER: "/account/center" } },
    hg_security_center_page: HGMfa,
    hg_mfa_recovery_page: HGRecovery,
  });
  let hgNavigated;
  const hgPage = new HGCenter({ location: { search: "?menu=security_mfa" }, navigate: (url) => { hgNavigated = url; } });
  const hgMfaView = hgPage.renderContent();
  assert.equal(hgMfaView.element, HGMfa);
  hgPage.handleMenuSelect(SECURITY_MFA_RECOVERY);
  assert.equal(hgNavigated, hgMfaView.props.hgRecoveryUrl);
  hgPage.props = { ...hgPage.props, location: { search: new URL(hgNavigated, "https://example.test").search } };
  const hgRecoveryView = hgPage.renderContent();
  assert.equal(hgRecoveryView.element, HGRecovery);
  assert.equal(hgRecoveryView.props.hgMfaUrl, "/account/center?menu=security_mfa");
});

test("尚未启用 MFA 的账号看到设置入口，而不是恢复邮箱绑定或重置表单", async () => {
  const { page, hgVM } = hgSecurityFixture();
  hgVM.recoveryStatus = async () => ({ mfaEnabled: false, emailVerified: false });
  await page.hgLoadRecoveryStatus();
  assert.equal(hgFindButton(page.renderRecoveryEmail(), "绑定并启用 MFA 验证器").props.to, page.props.hgMfaUrl);
  assert.equal(hgFindButton(page.renderRecoveryEmail(), "发送邮箱验证码"), undefined);
  assert.equal(page.renderRecoveryHelp(), null);
});

test("未验证恢复邮箱时说明无法自助找回，且不展示发信或重置按钮", async () => {
  const { page, hgVM } = hgSecurityFixture();
  hgVM.recoveryStatus = async () => ({ mfaEnabled: true, emailVerified: false, resetEnabled: true });
  await page.hgLoadRecoveryStatus();
  const hgPanel = page.renderRecoveryHelp();
  assert.match(hgPanel.children[0].children.join(""), /尚未绑定已验证的恢复邮箱/);
  assert.equal(hgFindButton(hgPanel, "发送找回邮件码"), undefined);
});

test("恢复邮箱页把找回操作引导到绑定验证器页，而不是重复展示表单", async () => {
  const { page } = hgSecurityFixture();
  await page.hgLoadRecoveryStatus();
  const hgHelp = page.renderRecoveryHelp();
  assert.equal(hgFindButton(hgHelp, "绑定 MFA 验证器").props.to, page.props.hgMfaUrl);
  assert.equal(hgFindButton(hgHelp, "发送找回邮件码"), undefined);
});

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
  const hgBindSuccess = hgVM.bindRecovery;
  hgVM.bindRecovery = async () => { throw new Error("MFA 动态码无效"); };
  await bind().props.onClick();
  assert.equal(page.state.hgRecoveryEmailCode, "000011");
  assert.equal(page.state.hgBindSentTo, "fixture@icloud.com");
  hgVM.bindRecovery = hgBindSuccess;
  page.setState({ hgRecoveryMfaCode: "000023" });
  await bind().props.onClick();
  assert.deepEqual(hgCalls.at(-1), ["bind", "fixture@icloud.com", "000011", "000023"]);
  assert.equal(page.state.hgRecoveryEmailCode, "");
  page.setState({ hgBindSentTo: "fixture@icloud.com", hgRecoveryEmailCode: "000011" });
  page.hgSetRecoveryAddress({ target: { value: "another@qq.com" } });
  assert.equal(page.state.hgRecoveryEmailCode, "");
  assert.equal(bind().props.disabled, true);
});

/** 从实际卡片标题栏操作打开弹窗，不绕过页面的入口条件。 */
const hgResetEntry = (page) => page.render().children[0].props.extra;
const hgResetButton = (page, label) => hgFindButton(page.renderResetModal()?.props.footer, label);

test("绑定卡片标题右侧打开重置弹窗，底部只有取消和确认，打开与取消均不发送邮件", async () => {
  const { page, hgVM, hgCalls } = hgSecurityFixture(true);
  assert.equal(hgResetEntry(page), undefined);
  await page.hgLoadMfaStatus();
  assert.equal(page.render().children[0].props.title, "绑定 MFA 验证器");
  assert.deepEqual(hgResetEntry(page).children, ["重置 MFA"]);
  await hgResetEntry(page).props.onClick();
  assert.equal(page.renderResetModal().props.title, "通过恢复邮箱重置 MFA");
  assert.deepEqual(page.renderResetModal().props.footer.children.map(({ children }) => children[0]), ["取消", "确认"]);
  assert.equal(hgResetButton(page, "确认").props.disabled, true);
  hgResetButton(page, "取消").props.onClick();
  assert.equal(page.renderResetModal(), null);
  assert.deepEqual(hgCalls, []);
  hgVM.recoveryStatus = async () => ({ mfaEnabled: false });
  await page.hgLoadMfaStatus();
  assert.equal(hgResetEntry(page), undefined);
});

test("弹窗遵守部署限制和邮箱冷却期；到期自动解锁，关闭或卸载清理定时器", async () => {
  const { page, hgTimers, hgVM, hgStatus, makeReady, hgCalls } = hgSecurityFixture(true);
  await page.hgLoadMfaStatus();
  for (const hgBlocked of [{ emailVerified: false }, { resetEnabled: false }]) {
    hgVM.recoveryStatus = async () => ({ ...hgStatus, ...hgBlocked });
    await hgResetEntry(page).props.onClick();
    assert.equal(hgFindButton(page.renderResetModal(), "发送找回邮件码"), undefined);
    assert.equal(hgResetButton(page, "确认").props.disabled, true);
    assert.equal(hgTimers.size, 0);
    await page.hgSendResetCode();
    assert.deepEqual(hgCalls, []);
    hgResetButton(page, "取消").props.onClick();
  }
  hgVM.recoveryStatus = async () => hgStatus;
  await hgResetEntry(page).props.onClick();
  assert.equal(hgFindButton(page.renderResetModal(), "发送找回邮件码"), undefined);
  assert.equal(hgTimers.size, 1);
  hgResetButton(page, "取消").props.onClick();
  assert.equal(hgTimers.size, 0);
  await hgResetEntry(page).props.onClick();
  makeReady();
  [...hgTimers][0]();
  assert.equal(hgFindButton(page.renderResetModal(), "发送找回邮件码").props.disabled, false);
  page.componentWillUnmount();
  assert.equal(hgTimers.size, 0);
});

/** 就绪后的首个操作仍需点击正文的发信按钮，测试使用替身而不投递真实邮件。 */
async function hgOpenReadyReset() {
  const hgFixture = hgSecurityFixture(true);
  hgFixture.makeReady();
  await hgFixture.page.hgLoadMfaStatus();
  await hgResetEntry(hgFixture.page).props.onClick();
  return hgFixture;
}

test("406003 在弹窗内显示且不能确认；重发成功后取消会清除敏感输入", async () => {
  const { page, hgCalls, hgVM } = await hgOpenReadyReset();
  const hgSend = () => hgFindButton(page.renderResetModal(), "发送找回邮件码");
  const hgSendSuccess = hgVM.sendResetCode;
  hgVM.sendResetCode = async () => { throw { code: 406003, message: "邮件服务暂不可用，请稍后重试" }; };
  await hgSend().props.onClick();
  assert.equal(hgFindButton(page.renderResetModal(), "邮件服务暂不可用，请稍后重试").props.role, "alert");
  assert.equal(hgResetButton(page, "确认").props.disabled, true);
  assert.deepEqual(hgCalls, []);
  hgVM.sendResetCode = hgSendSuccess;
  await hgSend().props.onClick();
  page.setState({ hgResetPassword: "fixture", hgResetEmailCode: "000012" });
  assert.equal(hgResetButton(page, "确认").props.disabled, false);
  hgResetButton(page, "取消").props.onClick();
  assert.equal(page.state.hgResetPassword, "");
  assert.equal(page.state.hgResetEmailCode, "");
  assert.deepEqual(hgCalls, [["send-reset"]]);
});

test("重置失败保留会话；成功重新登录，异步旧结果不清理新会话", async () => {
  const prepare = async () => {
    const hgFixture = await hgOpenReadyReset();
    const { page } = hgFixture;
    await hgFindButton(page.renderResetModal(), "发送找回邮件码").props.onClick();
    page.setState({ hgResetPassword: "fixture", hgResetEmailCode: "000012" });
    return hgFixture;
  };
  const failed = await prepare();
  failed.hgVM.resetMFA = async () => { throw new Error("邮箱码错误"); };
  await hgResetButton(failed.page, "确认").props.onClick();
  assert.deepEqual(failed.hgCalls, [["send-reset"]]);
  assert.equal(hgFindButton(failed.page.renderResetModal(), "邮箱码错误").props.role, "alert");
  assert.equal(failed.page.state.hgResetPassword, "");
  const success = await prepare();
  const hgConfirm = hgResetButton(success.page, "确认").props.onClick;
  await Promise.all([hgConfirm(), hgConfirm()]);
  assert.deepEqual(success.hgCalls, [["send-reset"], ["reset", "fixture", "000012"], ["logout"], ["redirect", "/login?mfaReset=1"]]);
  assert.equal(success.page.renderResetModal(), null);
  const stale = await prepare();
  stale.hgVM.resetMFA = async () => {
    stale.switchSession();
    return { reloginRequired: true };
  };
  await hgResetButton(stale.page, "确认").props.onClick();
  assert.deepEqual(stale.hgCalls, [["send-reset"]]);
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

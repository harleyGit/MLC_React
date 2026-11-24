import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { setImmediate } from "node:timers";
import { transformSync } from "@swc/core";

/** 以假令牌与 fetch 模拟续签；不连接后端、也不把凭据写入真实浏览器。 */
function hgFixture() {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./HttpManagerV1.js", import.meta.url), "utf8")
    .replace("const env = import.meta.env;", "const env = { DEV: true };");
  const hgCode = transformSync(hgSource, {
    filename: "HttpManagerV1.js",
    jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const hgStorage = new Map([["manager_token", "access-old"], ["refresh_token", "refresh-old"]]);
  const hgEvents = []; // 只记录刷新通知的名称，禁止记录任何令牌。
  let hgFetch = () => Promise.resolve({ ok: true, json: async () => ({
    code: 200, result: { token: "access-new", refreshToken: "refresh-new" },
  }) });
  let hgRedirects = 0; // 续签失败不主动清除会话；错误提示由路由守卫处理。
  const hgNavigator = { locks: null, language: "zh-CN" };
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    require: (id) => {
      if (id.endsWith("hg_logger")) return { LogError: () => {} };
      if (id.endsWith("hg_auth")) return { REFRESH_TOKEN_KEY: "refresh_token", TOKEN_KEY: "manager_token" };
      if (id.endsWith("hg_api_url")) return { joinApiURL: (_, path) => path };
      if (id.endsWith("hg_sign_path")) return { normalizeSignPath: (path) => path };
      if (id.endsWith("hg_ui_feedback")) return {
        redirectToLogin: () => { hgRedirects++; }, showError: () => {}, showWarning: () => {},
      };
      if (id.endsWith("hg_iam_events")) return { hgNotifyIAMChanged: () => {} };
      throw new Error(`未预期依赖: ${id}`);
    },
    localStorage: {
      getItem: (key) => hgStorage.get(key) ?? null,
      setItem: (key, value) => hgStorage.set(key, value),
    },
    navigator: hgNavigator,
    window: { dispatchEvent: (event) => hgEvents.push(event.type) },
    Event: class { constructor(type) { this.type = type; } },
    fetch: (...args) => hgFetch(...args),
  });
  const hgNet = hgModule.exports.default;
  hgNet.getCommonHeaders = () => ({ "X-Timestamp": "1" });
  hgNet.buildSignature = async () => "sha256=fixture";
  return {
    net: hgNet, storage: hgStorage, events: hgEvents, navigator: hgNavigator,
    redirects: () => hgRedirects,
    setFetch: (handler) => { hgFetch = handler; },
  };
}

test("同标签并发过期请求只消耗一次 refresh token，并通知 IAM 更新到期时间", async () => {
  const hg = hgFixture();
  let hgRequests = 0;
  let hgFinish;
  hg.setFetch(() => {
    hgRequests++;
    return new Promise((resolve) => { hgFinish = resolve; });
  });
  const first = hg.net.ensureFreshToken();
  const second = hg.net.ensureFreshToken();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(hgRequests, 1);
  hgFinish({ ok: true, json: async () => ({
    code: 200, result: { token: "access-new", refreshToken: "refresh-new" },
  }) });
  await Promise.all([first, second]);
  assert.equal(hg.storage.get("manager_token"), "access-new");
  assert.equal(hg.storage.get("refresh_token"), "refresh-new");
  assert.deepEqual(hg.events, ["hg:token-refreshed"]);
});

test("跨标签等待锁期间令牌已轮换时跳过旧 refresh 请求", async () => {
  const hg = hgFixture();
  let hgRequests = 0;
  let hgUnlock;
  hg.navigator.locks = { request: (_name, callback) =>
    new Promise((resolve) => { hgUnlock = () => resolve(callback()); }) };
  hg.setFetch(() => { hgRequests++; throw new Error("不应重放旧 refresh token"); });
  const pending = hg.net.ensureFreshToken();
  await new Promise((resolve) => setImmediate(resolve));
  hg.storage.set("refresh_token", "refresh-other-tab");
  hg.storage.set("manager_token", "access-other-tab");
  hgUnlock();
  await pending;
  assert.equal(hgRequests, 0);
  assert.equal(hg.redirects(), 0);
});

test("续签网络错误及后端 401 均保留会话供重试，不能误判依赖故障为撤销", async () => {
  const hg = hgFixture();
  hg.setFetch(async () => { throw new Error("网络暂不可用"); });
  await assert.rejects(hg.net.ensureFreshToken());
  assert.equal(hg.redirects(), 0);
  assert.equal(hg.storage.get("refresh_token"), "refresh-old");
  hg.setFetch(async () => ({ ok: false, status: 401 }));
  await assert.rejects(hg.net.ensureFreshToken());
  assert.equal(hg.redirects(), 0);
  assert.equal(hg.storage.get("refresh_token"), "refresh-old");
});

test("旧请求迟到的 401 发现当前令牌已更新时直接重试，不二次消耗 refresh token", async () => {
  const hg = hgFixture();
  hg.storage.set("manager_token", "access-other-tab");
  hg.net.ensureFreshToken = () => { throw new Error("不应二次续签"); };
  hg.net.request = async (options) => {
    assert.equal(options._hasRetried, true);
    return "已使用新令牌";
  };
  assert.equal(await hg.net.handle401({ _accessToken: "Bearer access-old" }), "已使用新令牌");
});

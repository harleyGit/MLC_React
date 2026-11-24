import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { setImmediate } from "node:timers";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

const HG_SOURCE = new URL("./hg_security_center_page.jsx", import.meta.url); // 实际页面源码，网络与 toast 在进程内替换。
const HGStub = () => null; // 非交互组件仅作为 JSX 渲染占位。

/** 编译真实页面，注入可控请求与 toast；不访问真实认证器或服务端。 */
function hgSecurityPage(enrollMFA) {
  const hgMessages = []; // toast 事件按类型保留，检查用户实际可见反馈。
  const hgModule = { exports: {} }; // CommonJS 转译结果的局部模块容器。
  const hgCode = transformSync(readFileSync(HG_SOURCE, "utf8"), {
    filename: "hg_security_center_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    React,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency.endsWith("hg_message_page")) {
        return {
          hgMessage: {
            warning: (hgText) => hgMessages.push(["warning", hgText]),
            error: (hgText) => hgMessages.push(["error", hgText]),
            success: (hgText) => hgMessages.push(["success", hgText]),
          },
        };
      }
      if (hgDependency.endsWith("hg_security_center_vm")) {
        return { default: { enrollMFA, hgMfaAlreadyEnabledCode: 404008 }, __esModule: true };
      }
      if (hgDependency.endsWith(".module.css")) return { default: {} };
      return { default: HGStub, __esModule: true };
    },
  });
  const hgPage = new hgModule.exports.default({}); // 不挂载 DOM；手动标记挂载以验证异步状态更新。
  hgPage.setState = (hgUpdate) => {
    hgPage.state = { ...hgPage.state, ...hgUpdate };
  };
  hgPage.componentDidMount();
  return { hgPage, hgMessages };
}

/** 等待当前 enroll Promise 的 then/catch/finally 结束。 */
const hgFlush = () => new Promise((hgResolve) => setImmediate(hgResolve));

test("专用业务码提示已绑定及恢复方式，不展示通用错误并清空敏感输入", async () => {
  const { hgPage, hgMessages } = hgSecurityPage(async () => {
    throw { status: 409, code: 404008, message: "当前账号已绑定 MFA" };
  });
  hgPage.state.hgMfaPassword = "fixture-password";
  hgPage.state.hgMfaSecret = "fixture-secret";
  hgPage.state.hgMfaUri = "fixture-uri";
  hgPage.state.hgMfaConfirmCode = "123456";
  hgPage.state.hgConfirmModalOpen = true;
  hgPage.hgEnrollMFA();
  await hgFlush();
  assert.equal(hgPage.state.hgEnrolling, false);
  assert.equal(hgPage.state.hgMfaPassword, "");
  assert.equal(hgPage.state.hgMfaSecret, "");
  assert.equal(hgPage.state.hgMfaUri, "");
  assert.equal(hgPage.state.hgMfaConfirmCode, "");
  assert.equal(hgPage.state.hgConfirmModalOpen, false);
  assert.equal(hgMessages.length, 1);
  assert.equal(hgMessages[0][0], "warning");
  assert.match(hgMessages[0][1], /已经绑定了 MFA/);
  assert.doesNotMatch(hgMessages[0][1], /角色或授权状态冲突/);
});

test("403、429、503 和普通 409 分别提示，不把其他失败误报为已绑定", async () => {
  for (const hgCase of [
    { status: 403, code: 300004, message: "无权执行此操作", type: "warning", text: /密码校验失败、权限不足/ },
    { status: 429, code: 100008, message: "请求频率过高", type: "warning", text: /操作过于频繁/ },
    { status: 503, code: 500001, message: "MFA 服务暂不可用", type: "error", text: /暂不可用/ },
    { status: 409, code: 100009, message: "角色或授权状态冲突", type: "error", text: /角色或授权状态冲突/ },
  ]) {
    const { hgPage, hgMessages } = hgSecurityPage(async () => { throw hgCase; });
    hgPage.state.hgMfaPassword = "fixture-password";
    hgPage.hgEnrollMFA();
    await hgFlush();
    assert.equal(hgMessages.length, 1);
    assert.equal(hgMessages[0][0], hgCase.type);
    assert.match(hgMessages[0][1], hgCase.text);
    assert.doesNotMatch(hgMessages[0][1], /已经绑定了 MFA/);
  }
});

test("生成中的重复点击只发一次请求，成功后正常展示绑定信息", async () => {
  let hgCalls = 0;
  let hgResolveRequest;
  const { hgPage, hgMessages } = hgSecurityPage(() => {
    hgCalls += 1;
    return new Promise((hgResolve) => { hgResolveRequest = hgResolve; });
  });
  hgPage.state.hgMfaPassword = "fixture-password";
  hgPage.hgEnrollMFA();
  hgPage.hgEnrollMFA();
  assert.equal(hgCalls, 1);
  hgResolveRequest({ secret: "fixture-secret", otpauthUri: "fixture-uri" });
  await hgFlush();
  assert.equal(hgPage.state.hgMfaPassword, "");
  assert.equal(hgPage.state.hgMfaSecret, "fixture-secret");
  assert.deepEqual(hgMessages, []);
});

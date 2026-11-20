import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import { JSDOM } from "jsdom";
import React, { act } from "react";

/** 在真实 DOM 点击链上运行权限按钮；仅替换权限结果和 Toast，绝不连接真实 API。 */
test("无权限按钮鼠标及键盘激活均只提示、不调用删除请求", async () => {
  const dom = new JSDOM("<!doctype html><div id='app'></div>", { url: "http://localhost/" });
  const previousWindow = globalThis.window;
  const previousDocument = globalThis.document;
  const previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const { createRoot } = await import("react-dom/client");
  const source = readFileSync(new URL("./hg_permission.jsx", import.meta.url), "utf8");
  const code = transformSync(source, {
    filename: "hg_permission.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const module = { exports: {} };
  const warnings = [];
  let allowed = false;
  let requests = 0;
  runInNewContext(code, {
    module, exports: module.exports, React,
    require: (id) => {
      if (id === "react") return React;
      if (id === "react-router-dom") return { Navigate: () => null };
      if (id.endsWith("hg_message_page")) return { hgMessage: { warning: (text) => warnings.push(text) } };
      if (id.endsWith("hg_use_permission")) return { useHGPermission: () => ({ allowed, reason: "没有删除权限" }) };
      if (id.endsWith("hg_iam_session")) return { hgCurrentIAMUser: () => "" };
      if (id.endsWith(".module.css")) return { default: { button: "button", blocked: "blocked", link: "link", danger: "danger" } };
      throw new Error(`未预期依赖: ${id}`);
    },
  });
  const root = createRoot(dom.window.document.getElementById("app"));
  try {
    const renderButton = () => React.createElement(module.exports.HGAuthButton,
      { permission: "mall:product:update", onClick: () => { requests += 1; } }, "删除");
    await act(async () => { root.render(renderButton()); });
    const button = dom.window.document.querySelector("button");
    assert.equal(button.getAttribute("aria-disabled"), "true");
    assert.equal(button.hasAttribute("disabled"), false);
    await act(async () => { button.click(); });
    await act(async () => {
      button.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      // jsdom 不自动将 Enter 转换为 click，显式模拟浏览器的激活事件。
      button.click();
    });
    assert.equal(requests, 0);
    assert.deepEqual(warnings, ["没有删除权限", "没有删除权限"]);
    allowed = true;
    await act(async () => { root.render(renderButton()); });
    await act(async () => { button.click(); });
    assert.equal(requests, 1);
  } finally {
    await act(async () => { root.unmount(); });
    dom.window.close();
    globalThis.window = previousWindow;
    globalThis.document = previousDocument;
    globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
  }
});

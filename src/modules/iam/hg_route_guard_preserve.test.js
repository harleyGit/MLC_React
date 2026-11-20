import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import { JSDOM } from "jsdom";
import React, { act, useEffect } from "react";
import { createRoot } from "react-dom/client";

/** 使用真实 React 挂载守卫，仅替换鉴权快照和账号读取；不使用网络或持久化。 */
function hgGuardFixture() {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_permission.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_permission.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code;
  let hgAccess = { status: "ready", allowed: true, loading: false }; // 初始服务端已确认访问许可。
  let hgOwner = "operator-a"; // 模拟当前 JWT 的账号标识，不存储真实令牌。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    require: (id) => {
      if (id === "react") return React;
      if (id === "react-router-dom") return { Navigate: () => null };
      if (id.endsWith("hg_use_permission")) return { useHGPermission: () => hgAccess };
      if (id.endsWith("hg_iam_session")) return { hgCurrentIAMUser: () => hgOwner };
      if (id.endsWith("hg_message_page")) return { hgMessage: { warning: () => {} } };
      return {};
    },
  });
  return {
    Guard: hgModule.exports.HGRouteGuard,
    setAccess: (next) => { hgAccess = next; },
    setOwner: (next) => { hgOwner = next; },
  };
}

test("编辑页权限快照自动复核期间保持草稿挂载，但不允许交互或跨账号保留", async () => {
  const hgDOM = new JSDOM("<!doctype html><div id='root'></div>", { url: "http://localhost:5174" });
  const hgOldWindow = globalThis.window;
  const hgOldDocument = globalThis.document;
  const hgOldAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.window = hgDOM.window;
  globalThis.document = hgDOM.window.document;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const hgRoot = createRoot(hgDOM.window.document.getElementById("root"));
  const fixture = hgGuardFixture();
  let hgMounts = 0; // 页面组件挂载次数；重验权限不能增加此值。
  let hgUnmounts = 0; // 页面组件卸载次数；权限撤销或切换账号时必须增加。
  function HGEditDraft() {
    useEffect(() => {
      hgMounts += 1;
      return () => { hgUnmounts += 1; };
    }, []);
    return React.createElement("input", { defaultValue: "未保存的填写内容" });
  }
  const hgRender = async () => act(async () => {
    hgRoot.render(React.createElement(fixture.Guard, {
      permission: "user:read", preserveOnRefresh: true,
    }, React.createElement(HGEditDraft)));
  });
  try {
    await hgRender();
    assert.equal(hgMounts, 1);
    fixture.setAccess({ status: "loading", allowed: false, loading: true });
    await hgRender();
    assert.equal(hgUnmounts, 0);
    assert.equal(hgDOM.window.document.querySelector("input").value, "未保存的填写内容");
    assert.equal(hgDOM.window.getComputedStyle(hgDOM.window.document.querySelector("input").parentElement).display, "none");
    fixture.setAccess({ status: "ready", allowed: true, loading: false });
    await hgRender();
    assert.equal(hgMounts, 1);
    fixture.setAccess({ status: "error", allowed: false, loading: false, refresh: () => {} });
    await hgRender();
    assert.equal(hgUnmounts, 0);
    assert.match(hgDOM.window.document.querySelector("[role=alert]").textContent, /权限加载失败/);
    assert.equal(hgDOM.window.document.querySelector("input").parentElement.style.display, "none");
    fixture.setAccess({ status: "ready", allowed: true, loading: false });
    await hgRender();
    assert.equal(hgMounts, 1);
    fixture.setAccess({ status: "loading", allowed: false, loading: true });
    fixture.setOwner("operator-b");
    await hgRender();
    assert.equal(hgUnmounts, 1);
    fixture.setAccess({ status: "ready", allowed: false, loading: false });
    await hgRender();
    assert.equal(hgMounts, 1);
    assert.match(hgDOM.window.document.querySelector("[role=alert]").textContent, /403/);
  } finally {
    await act(async () => { hgRoot.unmount(); });
    globalThis.window = hgOldWindow;
    globalThis.document = hgOldDocument;
    globalThis.IS_REACT_ACT_ENVIRONMENT = hgOldAct;
    hgDOM.window.close();
  }
});

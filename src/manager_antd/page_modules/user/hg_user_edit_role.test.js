import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

/** 转换真实编辑页并隔离请求；验证资料提交不再触发任何角色授权请求。 */
function hgUserEditPage(hgUpdate) {
  const hgModule = { exports: {} }; // JSX 模块替身，仅用于取得页面类。
  const hgMessages = []; // 资料保存反馈；不保存个人资料或验证码。
  const hgSource = readFileSync(new URL("./hg_user_edit_role_page.jsx", import.meta.url), "utf8"); // 当前真实页面源码。
  const hgCode = transformSync(hgSource, {
    filename: "hg_user_edit_role_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code; // Node 测试环境下的 JSX 转换产物，仅保存在内存。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    React,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency.endsWith("HttpManagerV1")) return { handleError: (error) => { throw error; } };
      if (hgDependency.endsWith("hg_naviagion_hook")) return { WithNavigation: (hgPage) => hgPage };
      if (hgDependency.endsWith("hg_user_vm")) return { default: { updateUserByUserId: hgUpdate }, __esModule: true };
      if (hgDependency.endsWith("hg_message_page")) return { hgMessage: { success: (text) => hgMessages.push(text) } };
      if (hgDependency.endsWith("hg_employee_role_vm")) throw new Error("用户资料页不应请求角色授权");
      return { default: () => null, __esModule: true };
    },
  });
  const hgPage = new hgModule.exports.default({ params: { userId: "route-7" }, location: { state: { user: { user_id: "stale-9", nickname: "员工" } } } }); // 路由目标优先于列表回填 ID。
  hgPage.hgMounted = true;
  hgPage.setState = (hgUpdateState) => {
    hgPage.state = { ...hgPage.state, ...(typeof hgUpdateState === "function" ? hgUpdateState(hgPage.state) : hgUpdateState) };
  };
  return { hgPage, hgMessages };
}

test("用户编辑页只保存资料，使用路由目标 ID，不渲染角色授权模块", async () => {
  const hgCalls = []; // 仅记录目标与昵称以确认用户资料更新的范围。
  const { hgPage, hgMessages } = hgUserEditPage(async (hgPayload) => {
    hgCalls.push({ userId: hgPayload.userId, nickname: hgPayload.nickname });
  });
  await hgPage.handleSubmit();
  assert.deepEqual(hgCalls, [{ userId: "route-7", nickname: "员工" }]);
  assert.deepEqual(hgMessages, ["用户资料已更新"]);
  assert.equal(hgPage.state.saving, false);
  assert.equal(hgPage.renderUserLookup, undefined);
  assert.equal(hgPage.renderGrantForm, undefined);
});

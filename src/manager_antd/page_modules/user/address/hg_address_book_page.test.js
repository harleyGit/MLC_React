import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

// 只转换真实页面 JSX；网络、路由和样式用可控替身，不连接后端。
function hgAddressPage(vm) {
  const module = { exports: {} };
  const source = readFileSync(new URL("./hg_address_book_page.jsx", import.meta.url), "utf8");
  const code = transformSync(source, { filename: "hg_address_book_page.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" } }).code;
  runInNewContext(code, {
    module, exports: module.exports,
    require: (dependency) => {
      if (dependency === "react") return React;
      if (dependency.includes("HttpManagerV1")) return { handleError: () => {} };
      if (dependency.includes("hg_message_page")) return { hgMessage: { success: () => {} } };
      if (dependency.includes("hg_page_registry")) return { PAGE: { EDIT_USER_INFO: "settings" } };
      if (dependency.includes("hg_address_book_vm")) return { default: vm, ADDRESS_MAX_COUNT: 20, __esModule: true };
      return { default: () => null, __esModule: true };
    },
  });
  const page = new module.exports.default({});
  page.hgMounted = true;
  page.setState = (update) => { page.state = { ...page.state, ...(typeof update === "function" ? update(page.state) : update) }; };
  return page;
}

function hgInitialState() {
  return { addresses: [], loading: false, error: "", resetKey: 0, formVisible: false, editingAddress: null, formSubmitting: false, deletingAddress: null, deleting: false, defaultingId: null };
}

test("连续刷新时旧列表不能覆盖较新的地址", async () => {
  const pending = [];
  const page = hgAddressPage({ createInitialState: hgInitialState, listAddresses: () => new Promise((resolve) => pending.push(resolve)) });
  const first = page.hgLoadAddresses();
  const second = page.hgLoadAddresses();
  pending[1]([{ id: 2, addressId: "ADDR_new" }]);
  await second;
  pending[0]([{ id: 1, addressId: "ADDR_old" }]);
  await first;
  assert.equal(page.state.addresses[0].addressId, "ADDR_new");
  assert.equal(page.state.resetKey, 1);
  page.componentWillUnmount();
});

test("新增已成功但默认设置失败时关闭表单并提示重试，不重复新增", async () => {
  let creates = 0;
  const page = hgAddressPage({
    createInitialState: hgInitialState,
    createAddress: async () => { creates += 1; return { id: 7, addressId: "ADDR_new" }; },
    setDefaultAddress: async () => { throw new Error("默认地址设置失败"); },
    listAddresses: async () => [{ id: 7, addressId: "ADDR_new" }],
  });
  page.state.formVisible = true;
  await page.handleSubmitForm({ receiverName: "测试" }, { setDefault: true });
  assert.equal(creates, 1);
  assert.equal(page.state.formVisible, false);
  assert.equal(page.state.addresses[0].addressId, "ADDR_new");
  assert.match(page.state.error, /地址已保存.*默认地址失败/);
  assert.equal(page.state.formSubmitting, false);
  page.componentWillUnmount();
});

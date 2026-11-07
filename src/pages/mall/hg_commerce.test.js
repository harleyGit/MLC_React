import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { hgYuanToCent } from "./hg_commerce_amount.js";

/** 转换真实 JSX，但用纯本地 VM/存储替身覆盖网络，测试不启动服务。 */
function hgPage(hgCommerce, hgLegacy = {}, hgCrypto = { randomUUID: () => "req-stable" }) {
  const hgModule = { exports: {} }; // SWC 转换后的模块导出。
  const hgSource = readFileSync(new URL("./hg_merchant_commerce_page.jsx", import.meta.url), "utf8"); // 被测商家页面源码。
  const hgCode = transformSync(hgSource, { filename: "hg_merchant_commerce_page.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" } }).code; // JSX 转换不改变业务逻辑。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports, URL: { revokeObjectURL() {} }, window: { confirm: () => true },
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency.endsWith("hg_commerce_vm.js")) return { default: hgCommerce, __esModule: true };
      if (hgDependency.endsWith("hg_mall_vm.js")) return { default: hgLegacy, __esModule: true };
      if (hgDependency.endsWith("hg_commerce_amount.js")) return { hgYuanToCent, hgCentToYuan: (hgCent) => `¥${(hgCent / 100).toFixed(2)}` };
      if (hgDependency.endsWith("hg_mall_security.js")) return { hgSecureRequestId: () => hgCrypto.randomUUID() };
      if (hgDependency.endsWith("hg_bili_media_url.js")) return { normalizeVideoCoverUrl: (hgURL) => hgURL };
      return { default: {}, __esModule: true };
    },
  });
  const hgInstance = new hgModule.exports.default({}); // 不触发真实挂载或浏览器请求。
  hgInstance.setState = (hgUpdate) => { hgInstance.state = { ...hgInstance.state, ...(typeof hgUpdate === "function" ? hgUpdate(hgInstance.state) : hgUpdate) }; };
  hgInstance.hgMounted = true; // 异步响应允许写入内存替身。
  return hgInstance;
}

test("生产 CNY 元转分保持整数精度并拒绝超额", () => {
  assert.equal(hgYuanToCent("0.01"), 1);
  assert.equal(hgYuanToCent("10000000.00"), 1000000000);
  for (const hgInvalid of ["0", "0.001", "1e2", "1.005", "10000000.01", "-1", "01.00"]) {
    assert.throws(() => hgYuanToCent(hgInvalid), Error);
  }
});

test("创建草稿响应丢失时沿用同一正文和幂等键重试", async () => {
  const hgCalls = []; // 两次创建时记录被发送的同一正文及请求标识。
  const hgCommerce = {
    create: async (hgBody, hgRequestId) => { hgCalls.push({ hgBody, hgRequestId }); if (hgCalls.length === 1) throw new Error("网络结果未知"); return { productId: "CPRD_1" }; },
    categories: async () => [{ categoryId: "1", name: "日用品" }], mine: async () => ({ list: [], hasMore: false }), unusedImages: async () => ({ imageURLs: [] }),
  };
  const hgInstance = hgPage(hgCommerce);
  hgInstance.state.hgCategories = [{ categoryId: "1" }];
  hgInstance.state.hgDraft = { categoryId: "1", title: "商品", subtitle: "", description: "", imageURLs: ["/one.jpg"], skus: [{ skuCode: "A", specs: "", price: "0.01", stock: "0" }] };
  await hgInstance.hgSave({ preventDefault() {} });
  assert.match(hgInstance.state.hgError, /结果未知/);
  assert.equal(hgInstance.state.hgPendingCreate.requestId, "req-stable");
  await hgInstance.hgSave({ preventDefault() {} });
  assert.deepEqual(hgCalls[0], hgCalls[1]);
  assert.equal(hgInstance.state.hgPendingCreate, null);
  assert.equal(hgInstance.state.hgError, "");
});

test("已驳回商品不可直接重审，审核前必须先展开完整待审版本", async () => {
  let hgDecisions = 0; // 未展开详情时审核请求次数，须保持零。
  const hgInstance = hgPage({ review: async () => { hgDecisions += 1; } });
  hgInstance.state.hgPending = [{ productId: "CPRD_1", title: "商品", version: 2, imageURLs: [], auditStatus: "PENDING" }];
  hgInstance.state.hgCanReview = true;
  await hgInstance.hgReview(hgInstance.state.hgPending[0], true);
  assert.equal(hgDecisions, 0);
  assert.match(hgInstance.state.hgError, /完整审核资料/);
  const hgRejected = { productId: "CPRD_2", auditStatus: "REJECTED", saleStatus: "OFF_SHELF", imageURLs: [] }; // 驳回版本只允许编辑。
  const hgRendered = hgInstance.renderCard(hgRejected);
  const hgButtons = React.Children.toArray(hgRendered.props.children[1].props.children[3].props.children).filter((hgChild) => React.isValidElement(hgChild) && hgChild.type === "button");
  assert.ok(!hgButtons.some((hgButton) => hgButton.props.children === "提交审核"));
});

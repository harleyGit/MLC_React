import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { HGFormatCoin } from "./hg_mall_amount.js";

/** 加载真实商家组件并替换网络层；不读取浏览器登录态或请求本地服务。 */
function hgMerchantPage(hgVM, hgProps = {}) {
  const hgModule = { exports: {} }; // 接收 SWC 转换后的 JSX 模块。
  const hgSource = readFileSync(new URL("./hg_mall_catalog.jsx", import.meta.url), "utf8"); // 实际页面源码。
  const hgCode = transformSync(hgSource, {
    filename: "hg_mall_catalog.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code; // 只转换 JSX，不修改组件逻辑。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    window: { confirm: () => true }, // 测试归档确认，不触发真实浏览器对话框。
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency === "react-router-dom") return { Link: "a" };
      if (hgDependency.includes("hg_router_path")) return { ROUTE_PATH: { PRODUCTS: "/products", MALL_ORDER_DETAIL: "/mall/orders/:orderId" } };
      if (hgDependency.endsWith("hg_mall_vm.js")) return { default: hgVM, __esModule: true };
      if (hgDependency.endsWith("hg_mall_amount.js")) return { HGFormatCoin };
      if (hgDependency.endsWith("hg_bili_media_url.js")) return { normalizeVideoCoverUrl: (hgURL) => hgURL };
      return { default: {}, __esModule: true };
    },
  });
  const hgInstance = new hgModule.exports.default(hgProps); // 页面实例，不触发实际 React 挂载。
  hgInstance.setState = (hgUpdate) => { hgInstance.state = { ...hgInstance.state, ...(typeof hgUpdate === "function" ? hgUpdate(hgInstance.state) : hgUpdate) }; };
  hgInstance.hgMounted = true; // 模拟已挂载，以接收异步列表结果。
  return hgInstance;
}

function hgText(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgText).join("");
  if (React.isValidElement(hgNode)) return hgText(hgNode.props.children);
  return hgNode == null || typeof hgNode === "boolean" ? "" : String(hgNode);
}

test("商品页能切换到本人商品管理，辅助图片接口失败也保留旧商品列表与补图入口", async () => {
  const hgInstance = hgMerchantPage({
    merchant: async () => ({ status: 1, shopName: "测试店铺" }),
    mine: async () => ({ list: [{ productId: "PRD_OLD", title: "旧商品", summary: "展示", amount: 12, status: 1, lifecycleStatus: 1, imageURLs: [] }], hasMore: false, nextCursor: "" }),
    unusedImages: async () => { throw new Error("辅助接口不可用"); },
    merchantOrders: async () => ({ list: [], hasMore: false, nextCursor: "" }),
  }, { hgInitialView: "catalog", hgShowCatalogTab: true });
  assert.match(hgText(hgInstance.renderTabs()), /我的商品 · 管理/);
  hgInstance.hgSelectView("merchant");
  for (let hgIndex = 0; hgIndex < 10; hgIndex += 1) await Promise.resolve();
  const hgRendered = hgText(hgInstance.renderMerchantProducts());
  assert.match(hgRendered, /PRD_OLD/);
  assert.match(hgRendered, /增添图片/);
  assert.match(hgRendered, /编辑资料/);
  assert.match(hgRendered, /归档商品/);
});

test("按商品编号精确读取旧商品并从列表归档后仍能查询历史", async () => {
  const hgArchived = []; // 捕获真实页面提交的商品编号，初始为空。
  const hgItem = { productId: "PRD_OLD", title: "旧商品", summary: "展示", amount: 12, status: 1, lifecycleStatus: 1, imageURLs: [] }; // 本人商品快照。
  const hgInstance = hgMerchantPage({
    merchant: async () => ({ status: 1, shopName: "测试店铺" }),
    mine: async () => ({ list: [hgItem], hasMore: false, nextCursor: "" }),
    unusedImages: async () => ({ imageURLs: [] }),
    merchantOrders: async () => ({ list: [], hasMore: false, nextCursor: "" }),
    mineDetail: async (hgID) => { assert.equal(hgID, "PRD_OLD"); return hgItem; },
    archive: async (hgID) => { hgArchived.push(hgID); },
  }, { hgInitialView: "merchant" });
  hgInstance.state.hgMerchantQuery = " PRD_OLD ";
  await hgInstance.hgFindMerchantProduct();
  assert.equal(hgInstance.state.hgFoundProduct.productId, "PRD_OLD");
  hgInstance.hgArchiveProduct("PRD_OLD");
  for (let hgIndex = 0; hgIndex < 10; hgIndex += 1) await Promise.resolve();
  assert.deepEqual(hgArchived, ["PRD_OLD"]);
  assert.equal(hgInstance.state.hgFoundProduct.lifecycleStatus, 2);
});

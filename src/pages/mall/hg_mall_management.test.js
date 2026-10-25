import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { HGFormatCoin } from "./hg_mall_amount.js";

/** 加载真实商家组件并替换网络层；不读取浏览器登录态或请求本地服务。 */
function hgMerchantPage(hgVM, hgProps = {}, hgURL = { createObjectURL: () => "blob:test", revokeObjectURL: () => {} }) {
  const hgModule = { exports: {} }; // 接收 SWC 转换后的 JSX 模块。
  const hgSource = readFileSync(new URL("./hg_mall_catalog.jsx", import.meta.url), "utf8"); // 实际页面源码。
  const hgCode = transformSync(hgSource, {
    filename: "hg_mall_catalog.jsx", jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code; // 只转换 JSX，不修改组件逻辑。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    window: { confirm: () => true }, // 测试归档确认，不触发真实浏览器对话框。
    URL: hgURL, // 本地预览能力由测试替身提供，不创建真实 blob。
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

function hgImages(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.flatMap(hgImages);
  if (!React.isValidElement(hgNode)) return [];
  return [...(hgNode.type === "img" ? [{ src: hgNode.props.src, alt: hgNode.props.alt }] : []), ...hgImages(hgNode.props.children)];
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

test("发布与补图可分次多选并预览，移除和卸载会释放 blob URL", () => {
  const hgRevoked = []; // 已释放的本地 blob 地址，初始为空。
  let hgSequence = 0; // 预览编号，确保每张选择生成不同的本地地址。
  const hgInstance = hgMerchantPage({}, { hgInitialView: "merchant" }, {
    createObjectURL: () => `blob:mall-${++hgSequence}`,
    revokeObjectURL: (hgURL) => hgRevoked.push(hgURL),
  });
  const hgFile = (hgName) => ({ name: hgName, type: "image/png", size: 128 }); // 未上传的合法图片选择项。
  hgInstance.hgChooseImages({ target: { files: [hgFile("封面.png"), hgFile("侧面.png")], value: "chosen" } });
  hgInstance.hgChooseImages({ target: { files: [hgFile("细节.png")], value: "chosen" } });
  assert.equal(hgInstance.state.hgSelectedImages.length, 3);
  const hgPreview = hgInstance.renderImagePreviews(hgInstance.state.hgSelectedImages, hgInstance.state.hgSelectedPreviews); // 选择后立即出现的预览节点。
  assert.match(hgText(hgPreview), /封面.png/);
  assert.deepEqual(hgImages(hgPreview).map((hgImage) => hgImage.src), ["blob:mall-1", "blob:mall-2", "blob:mall-3"]);
  hgInstance.hgRemovePreview(1);
  assert.equal(hgInstance.state.hgSelectedImages.length, 2);
  assert.deepEqual(hgRevoked, ["blob:mall-2"]);
  hgInstance.state.hgMediaProductId = "PRD_OLD";
  hgInstance.state.hgFoundProduct = { productId: "PRD_OLD", imageURLs: ["/uploads/one.png", "/uploads/two.png"] };
  hgInstance.hgChooseMedia({ target: { files: [hgFile("补图1.png"), hgFile("补图2.png")], value: "chosen" } });
  hgInstance.hgChooseMedia({ target: { files: [hgFile("补图3.png")], value: "chosen" } });
  assert.equal(hgInstance.state.hgMediaFiles.length, 3);
  hgInstance.hgChooseMedia({ target: { files: [hgFile("超额.png")], value: "chosen" } });
  assert.equal(hgInstance.state.hgMediaFiles.length, 3);
  hgInstance.componentWillUnmount();
  assert.deepEqual(hgRevoked.sort(), ["blob:mall-1", "blob:mall-2", "blob:mall-3", "blob:mall-4", "blob:mall-5", "blob:mall-6"].sort());
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

test("普通商家不请求受限审核列表，且能查看本人旧商品两张待审补图", async () => {
  const hgVM = {
    reviewAccess: async () => ({ canReview: false }),
    pendingMerchants: () => assert.fail("普通商家不应探测审核列表"),
    ownPendingMedia: async (hgProductId) => {
      assert.equal(hgProductId, "PRD_OLD");
      return { productId: hgProductId, imageURLs: ["/uploads/pending-1.png", "/uploads/pending-2.png"] };
    },
  };
  const hgInstance = hgMerchantPage(hgVM, { hgInitialView: "merchant" });
  hgInstance.state.hgMine = [{ productId: "PRD_OLD", title: "旧商品", status: 1, lifecycleStatus: 1, amount: 90, imageURLs: [] }];
  await hgInstance.hgLoadReviewAccess();
  assert.equal(hgInstance.state.hgCanReview, false);
  await hgInstance.hgLoadOwnMedia("PRD_OLD");
  assert.equal(hgInstance.state.hgPendingOwnMedia.length, 2);
  assert.match(hgText(hgInstance.renderMerchantProducts()), /尚未审核公开/);
  assert.deepEqual(hgImages(hgInstance.renderMerchantProducts()).filter((hgImage) => hgImage.alt?.includes("待审核补图")).map((hgImage) => hgImage.src), ["/uploads/pending-1.png", "/uploads/pending-2.png"]);
});

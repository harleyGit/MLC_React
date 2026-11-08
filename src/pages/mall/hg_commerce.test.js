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
    module: hgModule, exports: hgModule.exports, URL: { revokeObjectURL() {}, createObjectURL: () => "blob:preview" }, window: { confirm: () => true },
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
  hgInstance.state.hgCategories = []; // 类目列表重新加载为空时，原创建请求仍须可重试。
  assert.equal(hgInstance.renderDraftActions().props.children[0].props.children[0].props.disabled, false);
  await hgInstance.hgSave({ preventDefault() {} });
  assert.deepEqual(hgCalls[0], hgCalls[1]);
  assert.equal(hgInstance.state.hgPendingCreate, null);
  assert.equal(hgInstance.state.hgError, "");
});

test("无可选类目时保存按钮可操作但不能绕过类目必填校验", async () => {
  let hgCreates = 0; // 未选择经营类目时不得调用创建接口。
  const hgInstance = hgPage({ create: async () => { hgCreates += 1; } });
  const hgButton = hgInstance.renderDraftActions().props.children[0].props.children[0]; // fieldset 外的保存按钮。
  assert.equal(hgButton.props.disabled, false);
  const hgCategoryHint = hgInstance.renderDraftDetails().props.children[1]; // 空类目提示说明恢复操作。
  assert.match(hgCategoryHint.props.children, /暂无可经营的普通叶子类目/);
  await hgInstance.hgSave({ preventDefault() {} });
  assert.match(hgInstance.state.hgError, /请选择类目/);
  assert.equal(hgCreates, 0);
  hgInstance.state.hgBusy = true;
  assert.equal(hgInstance.renderDraftActions().props.children[0].props.children[0].props.disabled, true);
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

// Go 空切片序列化为 null；页面在数据边界兜底，列表为空时渲染不得抛 undefined.map。
test("后端返回空列表(null)时整页渲染不崩溃", async () => {
  const hgCommerce = {
    categories: async () => null, // 新环境尚无类目时 result 为 null。
    mine: async () => null,
    unusedImages: async () => null,
    pending: async () => null,
    mineDetail: async () => ({ productId: "CPRD_1", version: 1, categoryId: "1", title: "t", subtitle: "", description: "" }), // 缺省 imageURLs/skus。
  };
  const hgInstance = hgPage(hgCommerce, { merchant: async () => ({ status: 1 }), reviewAccess: async () => ({ canReview: true }) });
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgCategories.length, 0);
  assert.equal(hgInstance.state.hgProducts.length, 0);
  assert.equal(hgInstance.state.hgPending.length, 0);
  assert.doesNotThrow(() => { hgInstance.render(); }); // 商家视图含草稿表单与图片网格。
  await hgInstance.hgEdit("CPRD_1"); // 详情缺省 SKU 字段也不能崩溃。
  assert.equal(hgInstance.state.hgError, "");
  assert.doesNotThrow(() => { hgInstance.render(); });
});

test("支持选择 AVIF 图片且单次草稿最多绑定20张", () => {
  const hgInstance = hgPage({});
  const hgAVIF = { type: "image/avif", size: 1024 }; // mac06.avif 等本地 AVIF 文件。
  hgInstance.hgChooseImages({ target: { files: [hgAVIF], value: "" } });
  assert.equal(hgInstance.state.hgFiles.length, 1, "AVIF 应被接受");
  assert.equal(hgInstance.state.hgError, "");
  hgInstance.hgChooseImages({ target: { files: Array.from({ length: 19 }, () => hgAVIF), value: "" } }); // 累计 20 张。
  assert.equal(hgInstance.state.hgFiles.length, 20);
  assert.equal(hgInstance.state.hgError, "");
  hgInstance.hgChooseImages({ target: { files: [hgAVIF], value: "" } }); // 第 21 张须被拒绝。
  assert.equal(hgInstance.state.hgFiles.length, 20);
  assert.match(hgInstance.state.hgError, /最多20张/);
  const hgHEIC = { type: "image/heic", size: 1024 }; // 未开放格式仍拒绝。
  hgInstance.hgChooseImages({ target: { files: [hgHEIC], value: "" } });
  assert.match(hgInstance.state.hgError, /最多20张 JPG\/PNG\/WebP\/AVIF/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

/** 真实 JSX/类方法在隔离 VM 中执行；环境标识由测试替代，绝不请求真实 API。 */
function hgPage(hgVM, hgMode = "debug") {
  const hgModule = { exports: {} }; // 仅被测组件的 CJS 载体。
  const hgSource = readFileSync(new URL("./hg_commerce_debug_trade_page.jsx", import.meta.url), "utf8"); // 测试目标源文件。
  const hgCode = transformSync(hgSource.replaceAll("import.meta.env.MODE", JSON.stringify(hgMode)), {
    filename: "hg_commerce_debug_trade_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code; // VM 不能直接执行 Vite 的 import.meta；只替换当前模式，不修改业务代码。
  let hgNextID = 0; // 每次生成不同的模拟幂等键，不复用请求。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports, URLSearchParams,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency === "react-router-dom") return { Link: "a" };
      if (hgDependency.endsWith("hg_route_path.jsx")) return { ROUTE_PATH: { COMMERCE_PRODUCTS: "/mall/commerce" } };
      if (hgDependency.endsWith("hg_commerce_vm.js")) return { default: hgVM, __esModule: true };
      if (hgDependency.endsWith("hg_commerce_amount.js")) return { hgCentToYuan: (hgCent) => `¥${(hgCent / 100).toFixed(2)}` };
      if (hgDependency.endsWith("hg_mall_security.js")) return { hgSecureRequestId: () => `req-${++hgNextID}` };
      return { default: {}, __esModule: true };
    },
  });
  const hgInstance = new hgModule.exports.default({ location: { search: "?productId=CPRD_1" } }); // 不自动挂载，也不请求接口。
  hgInstance.setState = (hgUpdate) => { hgInstance.state = { ...hgInstance.state, ...(typeof hgUpdate === "function" ? hgUpdate(hgInstance.state) : hgUpdate) }; };
  hgInstance.hgMounted = true; // 模拟尚在页面上的组件。
  return hgInstance;
}

test("服务端报价与库存预占使用不同幂等键；结果未知时冻结输入并原样重试", async () => {
  const hgCalls = []; // 记录报价及两次建单请求。
  const hgPageInstance = hgPage({
    quote: async (hgBody) => { hgCalls.push(hgBody); return { productId: "CPRD_1", skuId: "CSKU_1", quantity: 2, totalCent: 499 }; },
    order: async (hgBody) => { hgCalls.push(hgBody); if (hgCalls.length === 2) throw new Error("结果未知"); return { orderId: "CORD_1" }; },
    orders: async () => ({ list: [{ orderId: "CORD_1", status: 1 }] }),
  });
  hgPageInstance.state.hgProduct = { productId: "CPRD_1" };
  hgPageInstance.state.hgSKU = "CSKU_1";
  hgPageInstance.state.hgAddress = "ADDR_1";
  hgPageInstance.state.hgQuantity = "2";
  await hgPageInstance.hgQuoteOrder();
  assert.equal(hgCalls[0].expectedCent, 1, "报价只是协议占位金额，不是浏览器报价");
  assert.equal(hgPageInstance.state.hgQuote.totalCent, 499);
  await hgPageInstance.hgCreateOrder();
  assert.match(hgPageInstance.state.hgError, /结果未知/);
  hgPageInstance.hgSetOrderInput("hgQuantity", "3");
  assert.equal(hgPageInstance.state.hgQuantity, "2", "结果未知时必须冻结原请求正文");
  await hgPageInstance.hgCreateOrder();
  assert.deepEqual(hgCalls[1], hgCalls[2]);
  assert.notEqual(hgCalls[0].requestId, hgCalls[1].requestId);
  assert.equal(hgCalls[1].expectedCent, 499);
  assert.equal(hgPageInstance.hgPendingCreate, null);
  assert.equal(hgPageInstance.state.hgOrders[0].orderId, "CORD_1");
});

test("模拟收款仅提交订单号，显示服务端事件结果；非 debug 模式不展示交易", async () => {
  const hgCalls = []; // 管理员请求正文仅保留订单号。
  const hgPageInstance = hgPage({ settle: async (hgID) => { hgCalls.push(hgID); return { result: "REFUNDED_LATE" }; } });
  hgPageInstance.state.hgOrderID = "CORD_2";
  await hgPageInstance.hgSettle();
  assert.deepEqual(hgCalls, ["CORD_2"]);
  assert.match(hgPageInstance.state.hgNotice, /REFUNDED_LATE/);
  assert.doesNotMatch(hgPageInstance.state.hgNotice, /密钥/);
  const hgProdPage = hgPage({}, "release");
  assert.match(hgProdPage.render().props.children, /仅在 debug 构建中可用/);
});

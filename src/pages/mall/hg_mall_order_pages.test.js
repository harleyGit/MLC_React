import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { HGFormatCoin } from "./hg_mall_amount.js";

/** 执行实际 JSX 页面；网络、路由与样式只用可控替身，不访问本地服务。 */
function hgPage(hgPath, hgVM, hgProps = {}) {
  const hgModule = { exports: {} }; // 接收编译后的页面模块，避免运行浏览器请求链。
  const hgCode = transformSync(readFileSync(new URL(hgPath, import.meta.url), "utf8"), {
    filename: hgPath, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" },
  }).code; // 只将当前真实组件转换成 Node 可执行的 CommonJS，不改写业务实现。
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency === "react-router-dom") return { Link: "a" };
      if (hgDependency.includes("hg_router_path")) return { ROUTE_PATH: { WALLET: "/account/wallet", MALL: "/mall", MALL_ORDER_DETAIL: "/mall/orders/:orderId", EDIT_USER_INFO: "/account/setting" } };
      if (hgDependency.endsWith("hg_mall_vm.js")) return { default: hgVM, __esModule: true };
      if (hgDependency.endsWith("hg_mall_amount.js")) return { HGFormatCoin };
      if (hgDependency.endsWith("hg_mall_security.js")) return { hgSecureRequestId: () => "test-request-id" };
      return { default: {}, __esModule: true };
    },
  });
  const hgInstance = new hgModule.exports.default(hgProps); // 真实类组件实例，手动控制生命周期。
  hgInstance.setState = (hgUpdate) => { hgInstance.state = { ...hgInstance.state, ...(typeof hgUpdate === "function" ? hgUpdate(hgInstance.state) : hgUpdate) }; };
  return hgInstance;
}

function hgText(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgText).join("");
  if (React.isValidElement(hgNode)) return hgText(hgNode.props.children);
  return hgNode == null || typeof hgNode === "boolean" ? "" : String(hgNode);
}

/** 遍历真实 React 元素树，检查列表链接在买家与商家视图的目标路由。 */
function hgLinks(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.flatMap(hgLinks);
  if (!React.isValidElement(hgNode)) return [];
  return [...(hgNode.type === "a" ? [hgNode.props.to] : []), ...hgLinks(hgNode.props.children)];
}

/** 等待 SWC 转换后包含 await/finally 的页面查询完成。 */
async function hgFlush() {
  for (let hgIndex = 0; hgIndex < 8; hgIndex++) await Promise.resolve();
}

/** 订单金额和收件信息只用于测试替身，绝不连接真实资产服务。 */
const hgPending = { orderId: "MORD_1", title: "测试商品", skuTitle: "规格", quantity: 2, unitAmount: 50, amount: 100,
  tradeStatus: 1, shippingStatus: 0, receiverName: "测试收件人", receiverPhone: "13800000000", receiverAddress: "测试地址", expiresAt: "2026-10-24T12:00:00Z" };

test("本店订单行打开商家授权详情，用户中心面板的待付/已付行打开本人详情", () => {
  const hgInstance = hgPage("hg_mall_catalog.jsx", {}, { hgInitialView: "merchant" });
  hgInstance.state.hgSellerOrders = [{ ...hgPending, orderId: "MORD_3", tradeStatus: 2 }];
  assert.deepEqual(hgLinks(hgInstance.renderSellerOrders()), ["/mall/orders/MORD_3?merchant=1"]);

  const hgPanel = hgPage("hg_mall_orders_panel.jsx", {}, {});
  hgPanel.state.hgPendingOrders = [hgPending];
  hgPanel.state.hgOrders = [{ ...hgPending, orderId: "MORD_2", tradeStatus: 2 }];
  assert.deepEqual(hgLinks(hgPanel.render()).sort(), ["/mall/orders/MORD_1", "/mall/orders/MORD_2"]);
});

test("本人详情从待支付快照打开，点击继续支付后重读服务端已支付状态", async () => {
  let hgPaid = false; // 支付结果由替身服务端控制，初始未付款。
  let hgPayCalls = 0; // 检查点击造成的支付请求数，初始零次。
  const hgInstance = hgPage("hg_mall_order_page.jsx", {
    orderDetail: async (hgId) => { assert.equal(hgId, "MORD_1"); return { ...hgPending, tradeStatus: hgPaid ? 2 : 1 }; },
    pay: async (hgId) => { assert.equal(hgId, "MORD_1"); hgPayCalls += 1; hgPaid = true; },
  }, { params: { orderId: "MORD_1" }, location: { search: "" } });
  hgInstance.componentDidMount();
  await hgFlush();
  assert.match(hgText(hgInstance.renderOrder()), /收货地址：测试地址/);
  assert.match(hgText(hgInstance.renderOrder()), /继续支付 M币/);
  await hgInstance.hgPay();
  assert.equal(hgPayCalls, 1);
  assert.equal(hgInstance.state.hgOrder.tradeStatus, 2);
  assert.doesNotMatch(hgText(hgInstance.renderOrder()), /继续支付 M币/);
  assert.equal(hgInstance.render().props.children.props.children[0].props.to, "/account/setting?menu=orders");
  hgInstance.componentWillUnmount();
});

test("商家详情只访问本店已付款接口，未付款详情不得提供支付入口", async () => {
  const hgInstance = hgPage("hg_mall_order_page.jsx", {
    orderDetail: () => assert.fail("商家不应调用买家待支付详情"),
    merchantOrderDetail: async () => ({ ...hgPending, tradeStatus: 3, shippingStatus: 1, carrier: "测试承运商", trackingNumber: "TEST.1" }),
    pay: () => assert.fail("商家不能支付买家订单"),
  }, { params: { orderId: "MORD_1" }, location: { search: "?merchant=1" } });
  hgInstance.componentDidMount();
  await hgFlush();
  assert.match(hgText(hgInstance.renderOrder()), /TEST.1/);
  assert.doesNotMatch(hgText(hgInstance.renderOrder()), /继续支付/);
  assert.equal(hgInstance.render().props.children.props.children[0].props.to, "/mall?view=merchant");
  hgInstance.componentWillUnmount();
});

test("支付响应丢失时以本人详情复核结果，避免把已扣币误报为失败", async () => {
  let hgPaid = false; // 服务端已经提交但支付响应丢失时，点查仍可确认真实状态。
  const hgInstance = hgPage("hg_mall_order_page.jsx", {
    orderDetail: async () => ({ ...hgPending, tradeStatus: hgPaid ? 2 : 1 }),
    pay: async () => { hgPaid = true; throw new Error("网络断开"); },
  }, { params: { orderId: "MORD_1" }, location: { search: "" } });
  hgInstance.componentDidMount();
  await hgFlush();
  await hgInstance.hgPay();
  assert.equal(hgInstance.state.hgError, "");
  assert.equal(hgInstance.state.hgOrder.tradeStatus, 2);
  assert.match(hgInstance.state.hgNotice, /核对消费记录/);
  hgInstance.componentWillUnmount();
});

test("消费记录按游标读取所有已付款商品，显示退款但不查询充值或待支付列表", async () => {
  const hgCalls = []; // 查询参数记录，用来验证服务端原始游标没有被转成 JS 数字。
  const hgInstance = hgPage("../../manager_antd/page_modules/user/wallet/hg_wallet_spending_page.jsx", {
    orders: async (hgCursor) => {
      hgCalls.push(hgCursor);
      return hgCursor ? { list: [{ ...hgPending, orderId: "MORD_2", shippingStatus: 3, tradeStatus: 7 }], hasMore: false, nextCursor: "" }
        : { list: [{ ...hgPending, tradeStatus: 2 }], hasMore: true, nextCursor: "900719925474099312345" };
    },
    pendingOrders: () => assert.fail("待支付预留不能计入消费记录"),
  });
  hgInstance.componentDidMount();
  await hgFlush();
  assert.match(hgText(hgInstance.renderOrders()), /支出 100 M币/);
  hgInstance.hgNextPage();
  await hgFlush();
  assert.deepEqual(hgCalls, ["", "900719925474099312345"]);
  assert.match(hgText(hgInstance.renderOrders()), /已全额退款/);
  hgInstance.hgPreviousPage();
  await hgFlush();
  assert.deepEqual(hgCalls, ["", "900719925474099312345", ""]);
  hgInstance.componentWillUnmount();
});

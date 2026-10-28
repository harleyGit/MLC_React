import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { HGFormatCoin } from "./hg_mall_amount.js";
import {
  HG_MALL_ORDER_PAGE_SIZE,
  hgOrderCursorAt,
  hgOrderPushCursor,
  hgOrderTotalCount,
} from "./hg_mall_order_pagination.js";

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
      if (hgDependency.includes("hg_router_path")) return { ROUTE_PATH: { WALLET: "/account/wallet", MALL: "/mall", MALL_ORDER_DETAIL: "/mall/orders/:orderId", EDIT_USER_INFO: "/account/setting", USER_CENTER: "/account/center" } };
      if (hgDependency.endsWith("hg_mall_vm.js")) return { default: hgVM, __esModule: true };
      if (hgDependency.endsWith("hg_mall_amount.js")) return { HGFormatCoin };
      if (hgDependency.endsWith("hg_mall_security.js")) return { hgSecureRequestId: () => "test-request-id" };
      if (hgDependency.endsWith("hg_mall_order_pagination.js")) return { HG_MALL_ORDER_PAGE_SIZE, hgOrderCursorAt, hgOrderPushCursor, hgOrderTotalCount };
      if (hgDependency.includes("hg_side_menu_page")) return { default: "HGSideMenuPage", __esModule: true };
      if (hgDependency.includes("hg_side_menu_vm")) return { default: { findPathToKey: () => [] }, __esModule: true };
      if (hgDependency.includes("hg_mall_pending_orders_page")) return { default: "HGMallPendingOrdersPage", __esModule: true };
      if (hgDependency.includes("hg_mall_paid_orders_page")) return { default: "HGMallPaidOrdersPage", __esModule: true };
      if (hgDependency.includes("hg_user_center_vm")) return { default: { getDefaultSelectedKey: () => "unpaid" }, USER_CENTER_MENU_ITEMS: [{ key: "orders", label: "我的订单", children: [{ key: "unpaid", label: "待付款" }, { key: "review", label: "评价" }] }], USER_CENTER_MENU_KEYS: { UNPAID: "unpaid", REVIEW: "review" }, __esModule: true };
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

/** 遍历元素树收集组件类型，用于断言页面装配了哪些区块。 */
function hgTypes(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.flatMap(hgTypes);
  if (!React.isValidElement(hgNode)) return [];
  return [hgNode.type, ...hgTypes(hgNode.props.children)];
}

/** 在元素树中查找第一个指定类型的元素。 */
function hgFind(hgNode, hgType) {
  if (Array.isArray(hgNode)) {
    for (const hgChild of hgNode) {
      const hgFound = hgFind(hgChild, hgType);
      if (hgFound) return hgFound;
    }
    return null;
  }
  if (!React.isValidElement(hgNode)) return null;
  if (hgNode.type === hgType) return hgNode;
  return hgFind(hgNode.props.children, hgType);
}

/** 等待 SWC 转换后包含 await/finally 的页面查询完成。 */
async function hgFlush() {
  for (let hgIndex = 0; hgIndex < 8; hgIndex++) await Promise.resolve();
}

/** 订单金额和收件信息只用于测试替身，绝不连接真实资产服务。 */
const hgPending = { orderId: "MORD_1", title: "测试商品", skuTitle: "规格", quantity: 2, unitAmount: 50, amount: 100,
  tradeStatus: 1, shippingStatus: 0, receiverName: "测试收件人", receiverPhone: "13800000000", receiverAddress: "测试地址", expiresAt: "2026-10-24T12:00:00Z" };

test("本店订单行打开商家授权详情，待付款与评价两页操作列打开本人详情", () => {
  const hgInstance = hgPage("hg_mall_catalog.jsx", {}, { hgInitialView: "merchant" });
  hgInstance.state.hgSellerOrders = [{ ...hgPending, orderId: "MORD_3", tradeStatus: 2 }];
  assert.deepEqual(hgLinks(hgInstance.renderSellerOrders()), ["/mall/orders/MORD_3?merchant=1"]);

  const hgPaidPage = hgPage("hg_mall_paid_orders_page.jsx", {}, {});
  hgPaidPage.state.hgOrders = [{ ...hgPending, orderId: "MORD_2", tradeStatus: 2 }];
  const hgPendingPage = hgPage("hg_mall_pending_orders_page.jsx", {}, {});
  hgPendingPage.state.hgOrders = [hgPending];
  // 卡片由业务页面渲染；详情路径仍只携带订单号。
  assert.deepEqual(
    [
      ...hgLinks(hgPaidPage.renderOrderCard(hgPaidPage.state.hgOrders[0])),
      ...hgLinks(hgPendingPage.renderOrderCard(hgPendingPage.state.hgOrders[0])),
    ].sort(),
    ["/mall/orders/MORD_1", "/mall/orders/MORD_2"]
  );
});

test("已支付商品触底追加原始游标；刷新重新从第一页读取并清理旧订单", async () => {
  const hgCalls = []; // 记录服务端收到的原始游标，确认未被本地改写成数字页码。
  const hgInstance = hgPage("hg_mall_paid_orders_page.jsx", {
    orders: async (hgCursor) => {
      hgCalls.push(hgCursor);
      return hgCursor === "CURSOR_2"
        ? { list: [{ ...hgPending, orderId: "MORD_9" }], hasMore: false, nextCursor: "" }
        : { list: [hgPending], hasMore: true, nextCursor: "CURSOR_2" };
    },
  });
  hgInstance.componentDidMount();
  await hgFlush();
  assert.equal(hgInstance.state.hgOrders.length, 1);
  assert.equal(hgInstance.state.hgNextCursor, "CURSOR_2");

  hgInstance.hgLoadMore();
  hgInstance.hgLoadMore(); // 同步门闩防止重复请求同一游标。
  await hgFlush();
  assert.deepEqual(hgCalls, ["", "CURSOR_2"]);
  assert.deepEqual([...hgInstance.state.hgOrders].map((hgOrder) => hgOrder.orderId), ["MORD_1", "MORD_9"]);
  assert.equal(hgInstance.state.hgHasMore, false);

  hgInstance.hgRefreshOrders();
  await hgFlush();
  assert.deepEqual(hgCalls, ["", "CURSOR_2", ""]);
  assert.deepEqual([...hgInstance.state.hgOrders].map((hgOrder) => hgOrder.orderId), ["MORD_1"]);
  assert.equal(hgInstance.state.hgResetKey, 2);
  hgInstance.componentWillUnmount();
});

test("待付款追加空页时保留已有卡片并停止加载", async () => {
  const hgCalls = []; // 游标所指订单已支付或超时后，避免继续请求同一空页。
  const hgInstance = hgPage("hg_mall_pending_orders_page.jsx", {
    pendingOrders: async (hgCursor) => {
      hgCalls.push(hgCursor);
      return hgCursor
        ? { list: [], hasMore: false, nextCursor: "" }
        : { list: [hgPending], hasMore: true, nextCursor: "PENDING_2" };
    },
  });
  hgInstance.componentDidMount();
  await hgFlush();
  hgInstance.hgLoadMore();
  await hgFlush();
  assert.deepEqual(hgCalls, ["", "PENDING_2"]);
  assert.equal(hgInstance.state.hgOrders.length, 1);
  assert.equal(hgInstance.state.hgHasMore, false);
  hgInstance.componentWillUnmount();
});

test("订单追加失败可重试；写操作遇到在途读取时强制刷新并丢弃旧响应", async () => {
  let hgReject; // 模拟过期请求延迟返回，不借助真实网络或定时器。
  const hgCalls = []; // 只检查服务端原始游标，不记录敏感订单字段。
  const hgInstance = hgPage("hg_mall_pending_orders_page.jsx", {
    pendingOrders: (hgCursor) => {
      hgCalls.push(hgCursor);
      if (hgCalls.length === 2) return Promise.reject(new Error("网络暂不可用"));
      if (hgCalls.length === 4) return new Promise((resolve) => { hgReject = resolve; });
      return Promise.resolve({ list: [hgPending], hasMore: true,
        nextCursor: hgCalls.length === 3 ? "PENDING_3" : "PENDING_2" });
    },
    pay: async () => {},
  });
  hgInstance.componentDidMount();
  await hgFlush();
  hgInstance.hgLoadMore();
  await hgFlush();
  assert.match(hgInstance.state.hgError, /网络暂不可用/);
  hgInstance.hgLoadMore();
  await hgFlush();
  assert.equal(hgInstance.state.hgError, "");
  hgInstance.hgLoadMore();
  await hgFlush();
  await hgInstance.hgPay("MORD_1");
  hgReject({ list: [{ ...hgPending, orderId: "STALE" }], hasMore: false, nextCursor: "" });
  await hgFlush();
  assert.deepEqual(hgCalls, ["", "PENDING_2", "PENDING_2", "PENDING_3", ""]);
  assert.deepEqual([...hgInstance.state.hgOrders].map((hgOrder) => hgOrder.orderId), ["MORD_1"]);
  hgInstance.componentWillUnmount();
});

test("严格模式卸载重挂后重新读取首屏，卸载前的慢响应不能覆盖新订单", async () => {
  let hgResolveOld; // 仅暂存测试替身的旧查询回调，避免依赖真实网络。
  let hgCalls = 0; // 首屏请求次数，初始为零。
  const hgInstance = hgPage("hg_mall_paid_orders_page.jsx", {
    orders: () => {
      hgCalls += 1;
      if (hgCalls === 1) return new Promise((resolve) => { hgResolveOld = resolve; });
      return Promise.resolve({ list: [{ ...hgPending, orderId: "NEW" }], hasMore: false, nextCursor: "" });
    },
  });
  hgInstance.componentDidMount();
  hgInstance.componentWillUnmount();
  hgInstance.componentDidMount();
  await hgFlush();
  hgResolveOld({ list: [hgPending], hasMore: false, nextCursor: "" });
  await hgFlush();
  assert.equal(hgCalls, 2);
  assert.equal(hgInstance.state.hgOrders[0].orderId, "NEW");
  hgInstance.componentWillUnmount();
});

test("个人中心「我的订单」下挂待付款与评价，默认展示待付款页面", () => {
  const hgInstance = hgPage("../../manager_antd/page_modules/user/user_center/hg_user_center_page.jsx", {}, {});
  const hgTree = hgInstance.render();
  const hgTypesList = hgTypes(hgTree);
  assert.ok(hgTypesList.includes("HGSideMenuPage"));
  assert.ok(hgTypesList.includes("HGMallPendingOrdersPage")); // 默认选中「待付款」。
  const hgMenu = hgFind(hgTree, "HGSideMenuPage");
  assert.equal(hgMenu.props.selectedKey, "unpaid");
  const hgOrdersMenu = hgMenu.props.menuItems[0];
  assert.equal(hgOrdersMenu.label, "我的订单");
  assert.deepEqual([...hgOrdersMenu.children].map((hgItem) => `${hgItem.key}:${hgItem.label}`), [
    "unpaid:待付款",
    "review:评价",
  ]);

  // 切到「评价」后内容区换成已支付商品页。
  hgInstance.handleMenuSelect("review");
  assert.ok(hgTypes(hgInstance.render()).includes("HGMallPaidOrdersPage"));
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
  assert.equal(hgInstance.render().props.children.props.children[0].props.to, "/account/center");
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

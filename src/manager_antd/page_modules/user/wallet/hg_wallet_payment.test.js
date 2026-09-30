import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import HGWalletVM, * as HGWalletExports from "./hg_wallet_vm.js";

const hgPending = {
  orderId: "order-1", status: "pending", paymentAvailable: true,
  paymentMode: "platform_debug", availableMethods: ["platform_debug"],
  serverTime: "2026-01-01T00:00:00Z", expiresAt: "2026-01-01T00:10:00Z",
};
const hgPaid = { ...hgPending, status: "paid", paymentAvailable: false, availableMethods: [],
  serverTime: "2026-01-02T00:00:00Z", paidAt: "2026-01-01T00:01:00Z", balanceAfter: "90071992547409931234" };

async function hgFlushBalance() {
  await Promise.resolve();
  await Promise.resolve();
}

/** 执行真实 JSX 类组件，只替换浏览器依赖、网络和时钟；不复制业务实现。 */
function hgLoadPage(hgName, hgVM) {
  const hgTimers = new Map();
  const hgEvents = new Map();
  let hgID = 0;
  const hgModule = { exports: {} };
  const hgCode = transformSync(readFileSync(new URL(hgName, import.meta.url), "utf8"), {
    filename: hgName, jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule, exports: hgModule.exports, URLSearchParams, Date,
    setTimeout: (hgFn) => { hgTimers.set(++hgID, hgFn); return hgID; },
    clearTimeout: (hgTimer) => hgTimers.delete(hgTimer),
    setInterval: () => ++hgID, clearInterval: () => {},
    window: { addEventListener: (hgType, hgFn) => hgEvents.set(hgType, hgFn), removeEventListener: (hgType) => hgEvents.delete(hgType) },
    require: (hgPath) => {
      if (hgPath === "react") return React;
      if (hgPath.endsWith("hg_wallet_vm.js")) return { ...HGWalletExports, default: hgVM, __esModule: true };
      if (hgPath === "react-router-dom") return { Link: "a" };
      if (hgPath.includes("hg_router_path")) return { ROUTE_PATH: {} };
      if (hgPath.includes("hg_user_profile_storage")) return { getUserProfile: () => ({}) };
      return {};
    },
  });
  const hgPage = new hgModule.exports.default({ location: { search: "?orderId=order-1" } });
  hgPage.setState = (hgState) => { hgPage.state = { ...hgPage.state, ...hgState }; };
  hgPage.hgGeneration = {};
  hgPage.state.hgOrder = hgPending;
  hgPage.state.hgNow = Date.parse(hgPending.serverTime);
  return { hgPage, hgTimers, hgEvents };
}

/** 展开 React 元素树，断言真实 render 输出而非源码字符串。 */
function hgText(hgNode) {
  if (Array.isArray(hgNode)) return hgNode.map(hgText).join("");
  if (React.isValidElement(hgNode)) return hgText(hgNode.props.children);
  return hgNode == null || typeof hgNode === "boolean" ? "" : String(hgNode);
}

test("VM requires all capabilities and never falls back from third party", async () => {
  class HGTestVM extends HGWalletVM {
    static hgRequest(...hgArgs) { this.hgCalls.push(hgArgs); return Promise.resolve(hgPaid); }
    static hgCalls = [];
  }
  for (const hgOrder of [
    { ...hgPending, paymentAvailable: false }, { ...hgPending, paymentMode: "unavailable" },
    { ...hgPending, availableMethods: [] }, { ...hgPending, availableMethods: undefined },
  ]) await assert.rejects(HGTestVM.payOrderIfAvailable(hgOrder), /暂未配置/);
  for (const hgMethod of ["wechat", "alipay"]) await assert.rejects(HGTestVM.payOrderIfAvailable(hgPending, hgMethod), /不会转为模拟/);
  assert.equal(HGTestVM.hgCalls.length, 0);
  assert.equal(await HGTestVM.payOrderIfAvailable(hgPending), hgPaid);
  assert.equal(await HGTestVM.payOrderIfAvailable(hgPending), hgPaid);
  assert.deepEqual(HGTestVM.hgCalls, Array(2).fill(["post", "WALLET_RECHARGE_PAY", { orderId: "order-1", paymentMethod: "platform_debug" }]));
});

test("mobile paid/replay refreshes live string balance and remains successful after expiry", async () => {
  let hgPays = 0;
  let hgBalances = 0;
  const { hgPage, hgTimers } = hgLoadPage("hg_wallet_recharge_page.jsx", {
    payOrderIfAvailable: async () => { hgPays++; return hgPaid; },
    refreshBalanceAfterConfirmedPayment: async () => { hgBalances++; return { balance: "90071992547409939999" }; },
  });
  hgPage.hgApplyOrder(hgPending);
  assert.equal(hgTimers.size, 1);
  await hgPage.hgPay();
  await hgFlushBalance();
  assert.equal(hgPage.state.hgOrder.status, "paid");
  assert.equal(hgPage.state.hgBalance, "90071992547409939999");
  assert.equal(hgBalances, 1);
  assert.equal(hgTimers.size, 0);
  await hgPage.hgPay();
  assert.equal(hgPays, 1);
  assert.match(hgText(hgPage.renderOrder()), /模拟充值成功/);
  assert.doesNotMatch(hgText(hgPage.renderOrder()), /已过期/);
});

test("desktop polling paid stops timers and refreshes balance", async () => {
  const { hgPage, hgTimers } = hgLoadPage("hg_wallet_recharge_page.jsx", {
    getRechargeOrderDetail: async () => hgPaid,
    refreshBalanceAfterConfirmedPayment: async () => ({ balance: "12345678901234567890" }),
  });
  hgPage.hgApplyOrder(hgPending);
  await hgPage.hgLoadDetail("order-1", hgPage.hgGeneration);
  await hgFlushBalance();
  assert.equal(hgTimers.size, 0);
  assert.equal(hgPage.state.hgBalance, "12345678901234567890");
});

test("timeout/500 confirms original order without new order or automatic repay", async () => {
  for (const hgStatus of [undefined, 500]) {
    const hgCalls = [];
    const { hgPage, hgTimers } = hgLoadPage("hg_wallet_recharge_page.jsx", {
      errorMessage: HGWalletVM.errorMessage,
      payOrderIfAvailable: async (hgOrder) => { hgCalls.push(["pay", hgOrder.orderId]); throw { status: hgStatus, message: "timeout" }; },
      getRechargeOrderDetail: async (hgID) => { hgCalls.push(["detail", hgID]); return hgPaid; },
      refreshBalanceAfterConfirmedPayment: async () => ({ balance: "42" }),
    });
    await hgPage.hgPay();
    await hgFlushBalance();
    assert.deepEqual(hgCalls, [["pay", "order-1"], ["detail", "order-1"]]);
    assert.equal(hgPage.state.hgOrder.status, "paid");
    assert.equal(hgPage.state.hgBalance, "42");
    assert.equal(hgTimers.size, 0);
  }
});

test("stale polling cannot replace paid and duplicate query remains single flight", async () => {
  let hgResolve;
  let hgDetails = 0;
  const { hgPage, hgTimers } = hgLoadPage("hg_wallet_recharge_page.jsx", {
    getRechargeOrderDetail: () => { hgDetails++; return new Promise((hgDone) => { hgResolve = hgDone; }); },
    payOrderIfAvailable: async () => hgPaid,
    refreshBalanceAfterConfirmedPayment: async () => ({ balance: "42" }),
  });
  const hgQuery = hgPage.hgLoadDetail("order-1", hgPage.hgGeneration);
  await hgPage.hgLoadDetail("order-1", hgPage.hgGeneration);
  assert.equal(hgDetails, 1);
  await hgPage.hgPay();
  hgResolve(hgPending);
  await hgQuery;
  assert.equal(hgPage.state.hgOrder.status, "paid");
  assert.equal(hgTimers.size, 0);
});

test("disabled order does not pay; third party UI remains disabled", async () => {
  const { hgPage } = hgLoadPage("hg_wallet_recharge_page.jsx", {});
  hgPage.state.hgOrder = { ...hgPending, availableMethods: [] };
  await hgPage.hgPay();
  const hgModal = hgPage.renderPaymentModal();
  const hgButtons = [];
  const hgVisit = (hgNode) => {
    if (Array.isArray(hgNode)) return hgNode.forEach(hgVisit);
    if (!React.isValidElement(hgNode)) return;
    if (hgNode.type === "button") hgButtons.push(hgNode);
    hgVisit(hgNode.props.children);
  };
  hgVisit(hgModal);
  for (const hgLabel of ["微信支付（未接入）", "支付宝（未接入）", "模拟充值（仅debug）"]) {
    assert.equal(hgButtons.find((hgButton) => hgText(hgButton) === hgLabel)?.props.disabled, true);
  }
  assert.match(hgText(hgModal), /当前后端未开启模拟充值/);
});

test("wallet return refreshes string balance and removes browser listeners", async () => {
  let hgCalls = 0;
  const { hgPage, hgEvents } = hgLoadPage("hg_wallet_page.jsx", {
    getBalance: async () => ({ balance: String(++hgCalls) + "0071992547409931234" }),
  });
  hgPage.componentDidMount();
  await Promise.resolve();
  const hgFirst = hgPage.state.hgBalance;
  hgEvents.get("pageshow")();
  await Promise.resolve();
  assert.notEqual(hgPage.state.hgBalance, hgFirst);
  assert.equal(typeof hgPage.state.hgBalance, "string");
  hgPage.componentWillUnmount();
  assert.equal(hgEvents.size, 0);
});

test("unavailable old order explains recreation while debug order offers requery", () => {
  const { hgPage } = hgLoadPage("hg_wallet_recharge_page.jsx", {});
  hgPage.state.hgOrder = { ...hgPending, paymentMode: "unavailable", paymentAvailable: false, availableMethods: [] };
  assert.match(hgText(hgPage.renderPaymentModal()), /该订单创建时未开启模拟充值/);
  assert.match(hgText(hgPage.renderPaymentModal()), /返回充值中心创建新订单/);
  hgPage.state.hgOrder = { ...hgPending, paymentAvailable: false, availableMethods: [] };
  assert.match(hgText(hgPage.renderPaymentModal()), /当前后端未开启模拟充值/);
  assert.match(hgText(hgPage.renderPaymentModal()), /重新查询原订单/);
});

test("payment button shows a short Chinese reason for each non-payable order state", () => {
  const { hgPage } = hgLoadPage("hg_wallet_recharge_page.jsx", {});
  const hgCases = [
    [{ ...hgPending, status: "paid" }, /订单已入账，不能重复充值/],
    [{ ...hgPending, expiresAt: "2025-12-31T23:59:59Z" }, /订单已过期，请返回充值中心创建新订单/],
    [{ ...hgPending, paymentAvailable: false, availableMethods: [] }, /当前后端未开启模拟充值/],
    [{ ...hgPending, paymentMode: "unavailable", paymentAvailable: false, availableMethods: [] }, /该订单创建时未开启模拟充值/],
  ];
  for (const [hgOrder, hgReason] of hgCases) {
    hgPage.state.hgOrder = hgOrder;
    const hgModal = hgPage.renderPaymentModal();
    assert.match(hgText(hgModal), hgReason);
    const hgButton = [];
    const hgVisit = (hgNode) => {
      if (Array.isArray(hgNode)) return hgNode.forEach(hgVisit);
      if (!React.isValidElement(hgNode)) return;
      if (hgNode.type === "button" && hgText(hgNode) === "模拟充值（仅debug）") hgButton.push(hgNode);
      hgVisit(hgNode.props.children);
    };
    hgVisit(hgModal);
    assert.equal(hgButton[0]?.props.disabled, true);
  }
});

test("capability requery enables only the original capable pending order", async () => {
  let hgResult = { ...hgPending, paymentAvailable: false, availableMethods: [] };
  let hgPays = 0;
  const { hgPage } = hgLoadPage("hg_wallet_recharge_page.jsx", {
    getRechargeOrderDetail: async () => hgResult,
    payOrderIfAvailable: async () => { hgPays++; return hgPaid; },
    refreshBalanceAfterConfirmedPayment: async () => ({ balance: "42" }),
  });
  hgPage.state.hgOrder = hgResult;
  await hgPage.hgLoadDetail("order-1", hgPage.hgGeneration);
  await hgPage.hgPay();
  assert.equal(hgPays, 0);
  hgResult = hgPending;
  await hgPage.hgLoadDetail("order-1", hgPage.hgGeneration);
  assert.equal(hgPage.state.hgOrder.orderId, "order-1");
  await hgPage.hgPay();
  assert.equal(hgPays, 1);
});

test("failed detail remains blocked during retry then recovers on original order", async () => {
  let hgResolve;
  let hgPays = 0;
  const { hgPage } = hgLoadPage("hg_wallet_recharge_page.jsx", {
    getRechargeOrderDetail: () => new Promise((hgDone) => { hgResolve = hgDone; }),
    payOrderIfAvailable: async () => { hgPays++; return hgPaid; },
    refreshBalanceAfterConfirmedPayment: async () => ({ balance: "42" }),
  });
  hgPage.state.hgError = "timeout";
  hgPage.hgRetry();
  assert.equal(hgPage.state.hgError, "timeout");
  assert.match(hgText(hgPage.renderPaymentModal()), /先重新查询原订单/);
  await hgPage.hgPay();
  assert.equal(hgPays, 0);
  hgResolve(hgPending);
  await hgFlushBalance();
  assert.equal(hgPage.state.hgError, "");
  assert.equal(hgPage.state.hgOrder.orderId, "order-1");
  const hgRecoveredModal = hgPage.renderPaymentModal();
  const hgRecoveredButton = [];
  const hgVisit = (hgNode) => {
    if (Array.isArray(hgNode)) return hgNode.forEach(hgVisit);
    if (!React.isValidElement(hgNode)) return;
    if (hgNode.type === "button" && hgText(hgNode) === "模拟充值（仅debug）") hgRecoveredButton.push(hgNode);
    hgVisit(hgNode.props.children);
  };
  hgVisit(hgRecoveredModal);
  assert.equal(hgRecoveredButton[0]?.props.disabled, false);
  await hgPage.hgPay();
  assert.equal(hgPays, 1);
});

test("QR and balance errors do not block a capable pending order", async () => {
  let hgPays = 0;
  const { hgPage } = hgLoadPage("hg_wallet_recharge_page.jsx", {
    payOrderIfAvailable: async () => { hgPays++; return hgPaid; },
    refreshBalanceAfterConfirmedPayment: async () => ({ balance: "42" }),
  });
  hgPage.state.hgQRError = "QR failed";
  hgPage.state.hgBalanceError = "balance failed";
  await hgPage.hgPay();
  assert.equal(hgPays, 1);
});

import assert from "node:assert/strict";
import test from "node:test";
import { Buffer } from "node:buffer";
import { getHGLoginReturn } from "../../../auth/hg_login_return.js";
import {
  buildHGRechargeDetailURL,
  formatHGYuanFromFen,
  getHGRemainingSeconds,
  isHGLocalOnlyOrigin,
  encodeHGRechargeQR,
  normalizeHGRechargeSKUs,
} from "./hg_wallet_vm.js";
import HGWalletVM from "./hg_wallet_vm.js";

test("formatHGYuanFromFen formats fen as yuan", () => {
  assert.equal(formatHGYuanFromFen(600), "6.00");
  assert.equal(formatHGYuanFromFen("1234"), "12.34");
  assert.equal(formatHGYuanFromFen(0), "0.00");
  assert.equal(formatHGYuanFromFen("900719925474099312345"), "9007199254740993123.45");
  assert.equal(formatHGYuanFromFen(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(formatHGYuanFromFen(Number.MAX_SAFE_INTEGER + 1), "--");
  assert.equal(formatHGYuanFromFen("000001"), "0.01");
  assert.equal(formatHGYuanFromFen("99"), "0.99");
  assert.equal(formatHGYuanFromFen("1e3"), "--");
  assert.equal(formatHGYuanFromFen(null), "--");
  assert.equal(formatHGYuanFromFen(-1), "--");
  assert.equal(formatHGYuanFromFen(1.2), "--");
});

test("getHGRemainingSeconds clamps and rounds up", () => {
  assert.equal(getHGRemainingSeconds("2026-01-01T00:00:10Z", Date.parse("2026-01-01T00:00:00.001Z")), 10);
  assert.equal(getHGRemainingSeconds("2026-01-01T00:00:00Z", Date.parse("2026-01-01T00:00:01Z")), 0);
  assert.equal(getHGRemainingSeconds("invalid", 0), 0);
});

test("normalizeHGRechargeSKUs reads wallet pagination result", () => {
  const list = [{ skuId: "sku-6", totalCoin: 6, payAmount: 600, paymentAvailable: false }];
  assert.deepEqual(normalizeHGRechargeSKUs({ list }), list);
  assert.deepEqual(normalizeHGRechargeSKUs({ list: [...list, null, { skuId: "bad" }] }), list);
  assert.deepEqual(normalizeHGRechargeSKUs(null), []);
});

test("payment unavailable rejects without invoking pay and preserves HTTP 503 meaning", async () => {
  await assert.rejects(HGWalletVM.payOrderIfAvailable({ orderId: "order-1", paymentAvailable: false }), /支付渠道暂未配置/);
  assert.equal(HGWalletVM.errorMessage({ status: 503, message: "payment channel is not configured" }), "支付渠道暂未配置");
});

test("buildHGRechargeDetailURL creates same-origin order URL", () => {
  assert.equal(
    buildHGRechargeDetailURL("order/1", "https://mlc.example"),
    "https://mlc.example/account/wallet/recharge?orderId=order%2F1"
  );
});

test("isHGLocalOnlyOrigin identifies non-shareable local origins", () => {
  assert.equal(isHGLocalOnlyOrigin("http://localhost:5174"), true);
  assert.equal(isHGLocalOnlyOrigin("http://127.0.0.1:5174"), true);
  assert.equal(isHGLocalOnlyOrigin("http://[::1]:5174"), true);
  assert.equal(isHGLocalOnlyOrigin("http://192.168.1.10:5174"), false);
  assert.equal(isHGLocalOnlyOrigin("https://mlc.example"), false);
});

test("qrcode encodes the order detail URL as a PNG data URL", async () => {
  const hgURL = buildHGRechargeDetailURL("order-1", "https://mlc.example");
  const hgDataURL = await encodeHGRechargeQR(hgURL);
  assert.match(hgDataURL, /^data:image\/png;base64,/);
  const hgPNG = Buffer.from(hgDataURL.split(",")[1], "base64");
  assert.equal(hgPNG.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(hgPNG.readUInt32BE(16) >= 240);
  assert.equal(hgPNG.readUInt32BE(16), hgPNG.readUInt32BE(20));
  await assert.rejects(encodeHGRechargeQR(""));
});

test("login returns to order query from both guard and expired session redirects", () => {
  const hgPath = "/account/wallet/recharge?orderId=order-1";
  assert.equal(getHGLoginReturn(hgPath, ""), hgPath);
  assert.equal(getHGLoginReturn(null, `?redirect=${encodeURIComponent(hgPath)}`), hgPath);
  for (const hgUnsafe of ["//evil.example", "/\\evil.example", "https://evil.example", "/\nevil"]) {
    assert.equal(getHGLoginReturn(hgUnsafe, ""), "/home");
  }
});

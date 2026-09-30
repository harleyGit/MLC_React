import assert from "node:assert/strict";
import test from "node:test";
import { normalizeSignPath } from "./hg_sign_path.js";

test("normalizeSignPath strips the video interaction module prefix", () => {
  assert.equal(
    normalizeSignPath("/api/v1/video_interactions/favorite"),
    "/favorite",
  );
});

test("normalizeSignPath strips the video comment module prefix", () => {
  assert.equal(
    normalizeSignPath("/api/v1/video_comments/create"),
    "/create",
  );
});

test("normalizeSignPath strips the video danmaku module prefix", () => {
  assert.equal(normalizeSignPath("/api/v1/video_danmaku/ticket"), "/ticket");
});

test("normalizeSignPath strips the bilibili module prefix", () => {
  assert.equal(
    normalizeSignPath("/api/v1/bilibili/author/homepage"),
    "/author/homepage",
  );
});

test("normalizeSignPath strips the wallet module prefix", () => {
  for (const hgPath of ["/balance", "/recharge/skus", "/recharge/orders", "/recharge/orders/detail", "/recharge/orders/pay"]) {
    assert.equal(normalizeSignPath(`/api/v1/wallet${hgPath}`), hgPath);
  }
  assert.equal(normalizeSignPath("/api/v1/wallet"), "/");
  assert.equal(normalizeSignPath("/api/v1/wallet_extra/recharge/skus"), "/api/v1/wallet_extra/recharge/skus");
});

// 请求层先取 pathname，查询参数及其顺序不参与现有签名协议。
test("wallet GET query produces the same module sign path as existing modules", () => {
  for (const hgQuery of ["?pageSize=20&cursor=0", "?cursor=0&pageSize=20", ""]) {
    const hgURL = new URL(`/api/v1/wallet/recharge/skus${hgQuery}`, "https://mlc.example");
    assert.equal(normalizeSignPath(hgURL.pathname), "/recharge/skus");
  }
  assert.equal(normalizeSignPath("/api/v1/ops/payment/recharge/skus/list"), "/payment/recharge/skus/list");
  assert.equal(normalizeSignPath("/api/v1/profile/info"), "/info");
});

test("normalizeSignPath preserves paths outside registered module prefixes", () => {
  assert.equal(normalizeSignPath("/health"), "/health");
});

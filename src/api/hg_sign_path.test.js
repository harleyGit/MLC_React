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

test("IAM 角色与权限请求使用模块内路径签名", () => {
  for (const [hgURL, hgPath] of [
    ["/api/v1/iam/roles/list?cursor=0&pageSize=100", "/roles/list"],
    ["/api/v1/iam/permissions/list?roleId=1", "/permissions/list"],
    ["/api/v1/iam/roles/permissions", "/roles/permissions"],
  ]) {
    assert.equal(normalizeSignPath(new URL(hgURL, "http://localhost:5174").pathname), hgPath);
  }
  assert.equal(normalizeSignPath("/api/v1/iam"), "/");
  assert.equal(normalizeSignPath("/api/v1/iam_extra/roles/list"), "/api/v1/iam_extra/roles/list");
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

// 充值记录属于独立 recharge 模块，只有完整模块边界才允许剥离。
test("充值记录使用模块内签名路径并保留相似前缀", () => {
  assert.equal(normalizeSignPath("/api/v1/recharge/records"), "/records");
  assert.equal(normalizeSignPath("/api/v1/recharge"), "/");
  assert.equal(normalizeSignPath("/api/v1/recharge_extra/records"), "/api/v1/recharge_extra/records");
  for (const hgQuery of ["?pageSize=50", "?pageSize=50&cursor=fixture", "?cursor=fixture&pageSize=50"]) {
    const hgURL = new URL(`/api/v1/recharge/records${hgQuery}`, "http://localhost:5174");
    assert.equal(normalizeSignPath(hgURL.pathname), "/records");
  }
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

test("商城接口签名使用模块内路径，查询参数不参与签名", () => {
  for (const [hgURL, hgPath] of [
    ["/api/v1/mall/products?category=&cursor=", "/products"],
    ["/api/v1/mall/merchant", "/merchant"],
    ["/api/v1/mall/merchant/orders?cursor=", "/merchant/orders"],
    ["/api/v1/mall/products/mine?cursor=", "/products/mine"],
    ["/api/v1/mall/merchant/apply", "/merchant/apply"],
    ["/api/v1/mall/orders/buy", "/orders/buy"],
  ]) {
    assert.equal(normalizeSignPath(new URL(hgURL, "http://localhost:5174").pathname), hgPath);
  }
  assert.equal(normalizeSignPath("/api/v1/mall"), "/");
  assert.equal(normalizeSignPath("/api/v1/mall_extra/products"), "/api/v1/mall_extra/products");
});

test("normalizeSignPath preserves paths outside registered module prefixes", () => {
  assert.equal(normalizeSignPath("/health"), "/health");
});

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

test("IM 请求只按已注册的模块路径签名，设备凭据不进入 URL", () => {
  assert.equal(normalizeSignPath("/api/v1/im/messages"), "/messages");
  assert.equal(normalizeSignPath("/api/v1/im/device/pending"), "/device/pending");
  assert.equal(normalizeSignPath("/api/v1/im_other/messages"), "/api/v1/im_other/messages");
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

// 生产 CNY 商品为独立 commerce 模块；若遗漏剥离，商家发布链路所有请求会签名失败。
test("commerce 接口签名使用模块内路径，查询参数不参与签名", () => {
  for (const [hgURL, hgPath] of [
    ["/api/v1/commerce/merchant/categories", "/merchant/categories"],
    ["/api/v1/commerce/merchant/products", "/merchant/products"],
    ["/api/v1/commerce/merchant/products?cursor=", "/merchant/products"],
    ["/api/v1/commerce/merchant/products/detail?productId=CPRD_1", "/merchant/products/detail"],
    ["/api/v1/commerce/merchant/products/edit?productId=CPRD_1", "/merchant/products/edit"],
    ["/api/v1/commerce/merchant/products/submit", "/merchant/products/submit"],
    ["/api/v1/commerce/merchant/products/publish", "/merchant/products/publish"],
    ["/api/v1/commerce/merchant/images?ext=png", "/merchant/images"],
    ["/api/v1/commerce/admin/products/pending", "/admin/products/pending"],
    ["/api/v1/commerce/admin/products/decision", "/admin/products/decision"],
    ["/api/v1/commerce/products", "/products"],
  ]) {
    assert.equal(normalizeSignPath(new URL(hgURL, "http://localhost:5174").pathname), hgPath);
  }
  assert.equal(normalizeSignPath("/api/v1/commerce"), "/");
  assert.equal(normalizeSignPath("/api/v1/commerce_extra/products"), "/api/v1/commerce_extra/products");
});

test("normalizeSignPath preserves paths outside registered module prefixes", () => {
  assert.equal(normalizeSignPath("/health"), "/health");
});

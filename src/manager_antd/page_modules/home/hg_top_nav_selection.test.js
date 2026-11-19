import assert from "node:assert/strict";
import test from "node:test";
import { hgTopNavKeyForPath } from "./hg_top_nav_selection.js";

// 仅提供导航规则使用的路由常量；页面实际常量仍由布局传入。
const routes = {
  DEFAULT: "/", HOME: "/home", ADD_CONTACT: "/im/contacts/add",
  PRODUCTS: "/products", MESSAGE_CENTER: "/message", CRAWLER_PLATFORM: "/crawler",
  OPERATION_MANAGEMENT: "/operation", TEST_MODULE: "/test",
  PERSONAL_CENTER: "/personal/center", USER_PROFILE: "/profile",
  UPDATE_USER_PROIFE: "/profile/edit", USER_CENTER: "/account/center",
};

test("商品详情与商城子页保留商品 Tab，不回退到 Chat", () => {
  for (const path of ["/products", "/products/PRD_123", "/mall/cny/products/PRD_123", "/mall/commerce/PRD_123"]) {
    assert.equal(hgTopNavKeyForPath(path, routes), "products");
  }
});

test("关联子页归属当前栏目；未知或有歧义的路径不强制指定 Tab", () => {
  for (const [path, expected] of [
    ["/home", "home"], ["/im/contacts/add", "home"],
    ["/profile/user/USR_123/edit-role", "operation"], ["/crawler", "crawler"],
    ["/bilibili/content/video/123", "bili_douga"],
    ["/account/wallet/records", "avatar"],
    ["/platform/upload/video/frame", "personal_center"],
    ["/mall/orders/ORD_123", null], ["/mall/commerce/category/create", null],
    ["/space/123", null], ["/about", null], ["/products-other", null],
  ]) {
    assert.equal(hgTopNavKeyForPath(path, routes), expected, path);
  }
});

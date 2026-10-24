import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

// 注册表没有 JSX；用内存模块解析 .jsx 后缀，不启动 Vite 或执行业务页导入。
const routeSource = await readFile(new URL("./hg_route_path.jsx", import.meta.url), "utf8");
const routeModule = `data:text/javascript,${encodeURIComponent(routeSource)}`;
const registrySource = await readFile(new URL("./hg_page_registry.jsx", import.meta.url), "utf8");
const registryModule = registrySource
  .replace('from "react"', `from "${import.meta.resolve("react")}"`)
  .replace('from "react-router-dom"', `from "${import.meta.resolve("react-router-dom")}"`)
  .replace('from "./hg_route_path"', `from "${routeModule}"`);
const { ROUTE_PATH } = await import(routeModule);
const { PAGE, getHGPageConfig, getHGPageTarget } = await import(
  `data:text/javascript,${encodeURIComponent(registryModule)}`
);

test("页面键和路径完整对应，组件保持稳定且不提前加载", () => {
  assert.deepEqual(Object.keys(PAGE), Object.keys(ROUTE_PATH));
  for (const page of Object.keys(PAGE)) {
    assert.equal(PAGE[page], page);
    const config = getHGPageConfig(page);
    assert.equal(config.route, ROUTE_PATH[page]);
    assert.equal(config, getHGPageConfig(page));
    assert.equal(config.component.$$typeof, Symbol.for("react.lazy"));
    const target = getHGPageTarget(config.route.replace(/:[^/]+/g, "value"));
    assert.equal(target.page, page);
  }
  assert.equal(getHGPageConfig("toString"), null);
  assert.equal(getHGPageConfig("UNKNOWN"), null);
  assert.equal(getHGPageConfig(null), null);
});

test("具体内容路由优先，路径解码一次并保留重复查询和 hash", () => {
  const target = getHGPageTarget("/bilibili/content/video/a%2Fb%252Fc%25?tag=a&tag=b&empty=#section");
  assert.equal(target.page, PAGE.BILI_VIDEO_CONTENT);
  assert.deepEqual(target.pathParams, { contentKey: "a/b%2Fc%" });
  assert.ok(target.params instanceof URLSearchParams);
  assert.deepEqual(target.params.getAll("tag"), ["a", "b"]);
  assert.equal(target.params.get("empty"), "");
  assert.equal(target.hash, "#section");
  assert.equal(getHGPageTarget("/bilibili/content/channel/123").page, PAGE.BILI_CHANNEL_CONTENT);
  assert.deepEqual(getHGPageTarget("/bilibili/content/other/123").pathParams,
    { contentType: "other", contentKey: "123" });
  assert.deepEqual(getHGPageTarget("/space/%E4%B8%AD%E6%96%87").pathParams, { uid: "中文" });
  assert.deepEqual(getHGPageTarget("/home").pathParams, {});
  assert.equal(getHGPageTarget("/home").hash, "");
});

test("商品详情和钱包消费记录可通过独立 URL 解析并保留订单号", () => {
  const hgDetail = getHGPageTarget("/mall/orders/MORD_1?merchant=1");
  assert.equal(hgDetail.page, PAGE.MALL_ORDER_DETAIL);
  assert.equal(hgDetail.pathParams.orderId, "MORD_1");
  assert.equal(hgDetail.params.get("merchant"), "1");
  assert.equal(getHGPageTarget("/account/wallet/spending").page, PAGE.WALLET_SPENDING);
});

test("拒绝外部、非法、缺少参数及未知路由", () => {
  for (const url of [null, {}, "", "home", "https://example.com/home", "//example.com/home",
    "/\\example.com/home", "/\nhome", "/unknown", "/home/extra", "/space",
    "/space/%", "/space/%FF", "javascript:alert(1)"]) {
    assert.equal(getHGPageTarget(url), null, String(url));
  }
});

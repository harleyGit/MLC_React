import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { HG_MALL_CATEGORIES } from "./hg_mall_categories.js";

/** 用真实 JSX 和本地请求替身核对目录类目，不启动服务或读取登录态。 */
function hgCatalog(hgCategories, hgAccess = { canReview: true }) {
  const hgModule = { exports: {} }; // 转换后的页面模块，仅用于当前测试实例。
  const hgSource = readFileSync(new URL("./hg_mall_catalog.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_mall_catalog.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  let hgCategoryCalls = 0; // 管理类目接口调用次数；无权限时必须为零。
  const hgProductFilters = []; // 目录请求传给 M币商品接口的筛选编码。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency === "react-router-dom") return { Link: "a" };
      if (hgDependency.endsWith("hg_router_path"))
        return { ROUTE_PATH: { COMMERCE_PRODUCTS: "/commerce/products", MALL_CNY: "/mall/cny" } };
      if (hgDependency.endsWith("hg_mall_categories.js"))
        return { HG_MALL_CATEGORIES, __esModule: true };
      if (hgDependency.endsWith("hg_commerce_vm.js"))
        return { default: { adminCategories: async () => { hgCategoryCalls += 1; return hgCategories; } }, __esModule: true };
      if (hgDependency.endsWith("hg_mall_vm.js"))
        return {
          default: {
            reviewAccess: async () => hgAccess,
            products: async (hgCategory) => {
              hgProductFilters.push(hgCategory);
              return { list: [], hasMore: false, nextCursor: "" };
            },
          },
          __esModule: true,
        };
      return { default: {}, __esModule: true };
    },
  });
  const hgInstance = new hgModule.exports.default({ hgInitialView: "catalog" });
  hgInstance.setState = (hgUpdate) => {
    hgInstance.state = {
      ...hgInstance.state,
      ...(typeof hgUpdate === "function" ? hgUpdate(hgInstance.state) : hgUpdate),
    };
  };
  hgInstance.hgMounted = true; // 模拟目录已挂载，允许异步接口更新状态。
  return { hgInstance, hgProductFilters, hgCategoryCalls: () => hgCategoryCalls };
}

/** 从目录真实渲染树读取类目按钮，断言用户实际能看到的文案。 */
function hgCategoryButtons(hgInstance, hgLabel) {
  const hgChildren = React.Children.toArray(hgInstance.renderProductList().props.children);
  const hgNav = hgChildren.find(
    (hgChild) => hgChild.type === "nav" && hgChild.props["aria-label"] === hgLabel
  );
  return hgNav ? React.Children.toArray(hgNav.props.children) : [];
}

test("审核员加载平台类目后展示一级、二级文案并按白名单编码筛选商品", async () => {
  const { hgInstance, hgProductFilters, hgCategoryCalls } = hgCatalog([
    { categoryId: "digital-root", name: "数码影音", depth: 1 },
    { categoryId: "phones", parentId: "digital-root", name: "手机", depth: 2 },
    { categoryId: "custom-root", name: "新类目", depth: 1 },
  ]);
  await hgInstance.hgLoadPlatformCategories();
  assert.equal(hgCategoryCalls(), 1);
  const hgTopButtons = hgCategoryButtons(hgInstance, "商品类目");
  assert.deepEqual(hgTopButtons.map((hgButton) => hgButton.props.children), [
    "全部商品", "数码影音", "新类目",
  ]);
  hgTopButtons[1].props.onClick();
  await Promise.resolve();
  assert.equal(hgProductFilters.at(-1), "digital");
  assert.deepEqual(
    hgCategoryButtons(hgInstance, "二级类目").map((hgButton) => hgButton.props.children),
    ["全部", "手机"]
  );
  hgTopButtons[2].props.onClick();
  await Promise.resolve();
  assert.equal(hgProductFilters.at(-1), "", "未映射的动态类目不能作为 M币商品筛选编码");
});

test("无审核权或接口无一级类目时保留可见的静态类目", async () => {
  const hgDenied = hgCatalog([], { canReview: false });
  await hgDenied.hgInstance.hgLoadPlatformCategories();
  assert.equal(hgDenied.hgCategoryCalls(), 0);
  assert.equal(hgCategoryButtons(hgDenied.hgInstance, "商品类目")[0].props.children, "全部商品");
  const hgNoRoots = hgCatalog([{ categoryId: "child", name: "手机", depth: 2 }]);
  await hgNoRoots.hgInstance.hgLoadPlatformCategories();
  assert.equal(hgCategoryButtons(hgNoRoots.hgInstance, "商品类目")[1].props.children, "数码影音");
});

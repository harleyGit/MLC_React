import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { HG_MALL_CATEGORIES } from "./hg_mall_categories.js";

/** 用真实 JSX 和本地请求替身核对 M币目录只接受白名单编码，不访问 CNY 类目。 */
function hgCatalog() {
  const hgModule = { exports: {} }; // 转换后的页面模块，仅用于当前测试实例。
  const hgSource = readFileSync(new URL("./hg_mall_catalog.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_mall_catalog.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
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
      if (hgDependency.endsWith("hg_mall_vm.js"))
        return {
          default: {
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
  return { hgInstance, hgProductFilters };
}

/** 从目录真实渲染树读取类目按钮，断言用户实际能看到的文案。 */
function hgCategoryButtons(hgInstance, hgLabel) {
  const hgChildren = React.Children.toArray(hgInstance.renderProductList().props.children);
  const hgNav = hgChildren.find(
    (hgChild) => hgChild.type === "nav" && hgChild.props["aria-label"] === hgLabel
  );
  return hgNav ? React.Children.toArray(hgNav.props.children) : [];
}

test("M币目录仅提供自身白名单类目，不混用人民币的二级类目 ID", async () => {
  const { hgInstance, hgProductFilters } = hgCatalog();
  const hgTopButtons = hgCategoryButtons(hgInstance, "商品类目");
  assert.deepEqual(Array.from(hgTopButtons, (hgButton) => hgButton.props.children),
    HG_MALL_CATEGORIES.map(([, hgName], hgIndex) => hgIndex === 0 ? "全部商品" : hgName));
  hgTopButtons[1].props.onClick();
  await Promise.resolve();
  assert.equal(hgProductFilters.at(-1), "digital");
  assert.equal(React.Children.toArray(hgInstance.renderProductList().props.children).some(
    (hgChild) => hgChild.props?.ariaLabel === "二级类目"
  ), false);
});

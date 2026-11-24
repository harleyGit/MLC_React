import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

/** 转换实际 JSX 后替换网络层：仅观察类目下钻与商品查询参数，不访问服务端。 */
function hgPage(hgCategories) {
  const hgModule = { exports: {} }; // 当前测试专用 CommonJS 容器。
  const hgSource = readFileSync(new URL("./hg_commerce_catalog_page.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_commerce_catalog_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code.replaceAll("import.meta.env.MODE", JSON.stringify("test")); // VM 执行 CJS，保留页面原有的 Vite 条件但不进入 debug 链路。
  const hgRequests = []; // 记录已传给公开类目 API 的 parentId，空字符串表示根节点。
  const hgProducts = []; // 记录目录游标及类目 ID。
  const hgCoinProducts = []; // M币商品接口调用；与人民币目录分别断言。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency === "react-router-dom") return { Link: "a" };
      if (hgDependency.endsWith("hg_commerce_vm.js")) return {
        default: {
          publicCategories: async (hgParent = "") => {
            hgRequests.push(hgParent);
            const hgResult = hgCategories[hgParent];
            if (hgResult instanceof Error) throw hgResult;
            return typeof hgResult === "function" ? hgResult() : (hgResult || []);
          },
          products: async (hgCursor, hgCategory) => {
            hgProducts.push([hgCursor, hgCategory]);
            return { list: [], nextCursor: "", hasMore: false };
          },
        },
        __esModule: true,
      };
      if (hgDependency.endsWith("hg_mall_vm.js")) return {
        default: {
          products: async (hgCategory, hgCursor) => {
            hgCoinProducts.push([hgCategory, hgCursor]);
            return { list: [], nextCursor: "", hasMore: false };
          },
        },
        __esModule: true,
      };
      if (hgDependency.endsWith("hg_commerce_amount.js")) return { hgCentToYuan: () => "¥1" };
      if (hgDependency.endsWith("hg_mall_amount.js")) return { HGFormatCoin: () => "123" };
      if (hgDependency.endsWith("hg_route_path.jsx")) return { ROUTE_PATH: { COMMERCE_DETAIL: "/mall/commerce/:productId", PRODUCT_DETAIL: "/products/:productId" } };
      return { default: {}, __esModule: true };
    },
  });
  const hgInstance = new hgModule.exports.default({}); // 无路由参数时展示目录。
  hgInstance.setState = (hgChange) => {
    hgInstance.state = { ...hgInstance.state, ...hgChange };
  };
  hgInstance.hgMounted = true; // 模拟已挂载；页面本身通过代数取消过期请求。
  return { hgInstance, hgRequests, hgProducts, hgCoinProducts };
}

test("一级/二级/三级筛选请求直属子类目，商品游标沿用当前 categoryId", async () => {
  const { hgInstance, hgRequests, hgProducts } = hgPage({
    "": [{ categoryId: "root", depth: 1, name: "数码" }],
    root: [{ categoryId: "sub", parentId: "root", depth: 2, name: "手机" }],
    sub: [{ categoryId: "leaf", parentId: "sub", depth: 3, name: "折叠屏" }],
  });
  await hgInstance.hgLoadRoots();
  assert.equal(hgInstance.state.hgRoots[0].name, "数码");
  await hgInstance.hgSelectTop("root");
  await hgInstance.hgSelectSub("sub");
  hgInstance.hgSelectLeaf("leaf");
  await hgInstance.hgLoad("100");
  assert.deepEqual(hgRequests, ["", "root", "sub"]);
  assert.deepEqual(hgProducts.map((hgArgs) => Array.from(hgArgs)), [
    ["", "root"], ["", "sub"], ["", "leaf"], ["100", "leaf"],
  ]);
  const hgTabs = React.Children.toArray(hgInstance.renderFilters().props.children);
  assert.ok(hgTabs.some((hgTab) => hgTab.props?.ariaLabel === "三级类目"));
  hgInstance.hgSelectLeaf("");
  await Promise.resolve();
  assert.equal(hgProducts.at(-1)[1], "sub", "三级「全部」回退二级及后代");
});

test("下钻失败保留选中的二级商品过滤；切换一级不接纳过期三级结果", async () => {
  let hgResolve; // 测试内暂缓第一次三级响应，模拟用户快速切换父类目。
  const { hgInstance, hgProducts } = hgPage({
    root: [{ categoryId: "sub", parentId: "root", depth: 2 }],
    sub: () => new Promise((hgDone) => { hgResolve = hgDone; }),
    other: new Error("网络失败"),
  });
  await hgInstance.hgSelectTop("root");
  const hgPending = hgInstance.hgSelectSub("sub");
  await hgInstance.hgSelectTop("other");
  hgResolve([{ categoryId: "old", parentId: "sub", depth: 3 }]);
  await hgPending;
  assert.equal(hgInstance.state.hgTopId, "other");
  assert.equal(hgInstance.state.hgLeaves.length, 0);
  assert.equal(hgInstance.state.hgCategoryError, "细分类目暂不可用，仍显示当前层级");
  assert.equal(hgProducts.at(-1)[1], "other");
});

test("VIRT-0013 下的 M币虚拟二级类目只使用 M币目录，返回全部切回人民币", async () => {
  const { hgInstance, hgProducts, hgCoinProducts, hgRequests } = hgPage({
    "VIRT-0013": [{ categoryId: "MALL-COIN-ALL", parentId: "VIRT-0013", depth: 2, name: "M币商品", catalogType: "MLC_COIN" }],
  });
  await hgInstance.hgSelectTop("VIRT-0013");
  await hgInstance.hgSelectSub("MALL-COIN-ALL");
  await hgInstance.hgLoad("42");
  assert.deepEqual(hgCoinProducts.map((hgArgs) => Array.from(hgArgs)), [["", ""], ["", "42"]]);
  assert.deepEqual(hgProducts.map((hgArgs) => Array.from(hgArgs)), [["", "VIRT-0013"]]);
  assert.deepEqual(hgRequests, ["VIRT-0013"], "虚拟类目不再次请求 commerce/categories");
  assert.equal(hgInstance.state.hgCatalogSource, "MLC_COIN");
  assert.equal(hgInstance.renderCoinCard({ productId: "PRD-1", title: "商品", amount: 123 }).props.to, "/products/PRD-1");
  await hgInstance.hgSelectSub("");
  assert.equal(hgInstance.state.hgCatalogSource, "CNY");
  assert.equal(hgProducts.at(-1)[1], "VIRT-0013");
});

test("VIRT-0013 位于二级时在三级展示 M币入口，并在切换父节点时丢弃旧请求", async () => {
  const { hgInstance, hgProducts, hgCoinProducts } = hgPage({
    root: [{ categoryId: "VIRT-0013", parentId: "root", depth: 2, name: "虚拟商品" }],
    "VIRT-0013": [{ categoryId: "MALL-COIN-ALL", parentId: "VIRT-0013", depth: 3, name: "M币商品", catalogType: "MLC_COIN" }],
  });
  await hgInstance.hgSelectTop("root");
  await hgInstance.hgSelectSub("VIRT-0013");
  hgInstance.hgSelectLeaf("MALL-COIN-ALL");
  assert.equal(hgInstance.state.hgCatalogSource, "MLC_COIN");
  assert.deepEqual(hgCoinProducts.map((hgArgs) => Array.from(hgArgs)), [["", ""]]);
  hgInstance.hgSelectLeaf("");
  assert.equal(hgInstance.state.hgCatalogSource, "CNY");
  assert.equal(hgProducts.at(-1)[1], "VIRT-0013");
});

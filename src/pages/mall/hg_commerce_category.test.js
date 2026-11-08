import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

// Link 与 HGTable 的测试替身：只承载 props 断言，不渲染真实 DOM。
const HGTestLink = () => null;
const HGTestTable = () => null;

// Node 测试无法直接 import .jsx；路由常量模块无外部依赖，同链转换加载。
const { ROUTE_PATH } = (() => {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(
    new URL("../../components/hg_navigation/hg_route_path.jsx", import.meta.url),
    "utf8"
  );
  const hgCode = transformSync(hgSource, {
    filename: "hg_route_path.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, { module: hgModule, exports: hgModule.exports, require: () => ({}) });
  return hgModule.exports;
})();

/** 转换真实 JSX 并用本地替身覆盖网络与路由依赖；测试不启动服务。 */
function hgPage(hgSourceName, hgCommerce, hgLegacy = {}) {
  const hgModule = { exports: {} };
  // Node VM 不支持 import.meta；页面中的 Vite 环境判断以 debug 常量替换，仅影响测试转换。
  const hgSource = readFileSync(new URL(`./${hgSourceName}`, import.meta.url), "utf8")
    .replace(/import\.meta\.env\.MODE/g, '"debug"');
  const hgCode = transformSync(hgSource, {
    filename: hgSourceName,
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    URL: { revokeObjectURL() {}, createObjectURL: () => "blob:preview" },
    window: { confirm: () => true },
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency === "react-router-dom")
        return { Link: HGTestLink, __esModule: true };
      if (hgDependency.endsWith("hg_route_path.jsx"))
        return { ROUTE_PATH, __esModule: true };
      if (hgDependency.endsWith("hg_table_page"))
        return { default: HGTestTable, __esModule: true };
      if (hgDependency.endsWith("hg_commerce_vm.js"))
        return { default: hgCommerce, __esModule: true };
      if (hgDependency.endsWith("hg_mall_vm.js"))
        return { default: hgLegacy, __esModule: true };
      if (hgDependency.endsWith("hg_commerce_amount.js"))
        return {
          hgYuanToCent: (hgText) => Number(hgText) * 100,
          hgCentToYuan: (hgCent) => `¥${(hgCent / 100).toFixed(2)}`,
        };
      if (hgDependency.endsWith("hg_mall_security.js"))
        return { hgSecureRequestId: () => "req-stable" };
      if (hgDependency.endsWith("hg_bili_media_url.js"))
        return { normalizeVideoCoverUrl: (hgURL) => hgURL };
      return { default: {}, __esModule: true };
    },
  });
  const hgInstance = new hgModule.exports.default({});
  hgInstance.setState = (hgUpdate) => {
    hgInstance.state = {
      ...hgInstance.state,
      ...(typeof hgUpdate === "function" ? hgUpdate(hgInstance.state) : hgUpdate),
    };
  };
  hgInstance.hgMounted = true;
  return hgInstance;
}

/** 深度查找元素树中首个指定类型的元素。 */
function hgFindElement(hgNode, hgType) {
  if (!hgNode || typeof hgNode !== "object") return null;
  if (React.isValidElement(hgNode)) {
    if (hgNode.type === hgType) return hgNode;
    return hgFindElement(hgNode.props?.children, hgType);
  }
  if (Array.isArray(hgNode)) {
    for (const hgChild of hgNode) {
      const hgFound = hgFindElement(hgChild, hgType);
      if (hgFound) return hgFound;
    }
  }
  return null;
}

/** 收集元素树中的全部 Link 目标与纯文本。 */
function hgCollectLinks(hgNode, hgOut = []) {
  if (!hgNode || typeof hgNode !== "object") return hgOut;
  if (React.isValidElement(hgNode)) {
    if (hgNode.type === HGTestLink) hgOut.push({ to: hgNode.props.to, text: String(hgNode.props.children) });
    hgCollectLinks(hgNode.props?.children, hgOut);
    return hgOut;
  }
  if (Array.isArray(hgNode)) hgNode.forEach((hgChild) => hgCollectLinks(hgChild, hgOut));
  return hgOut;
}

function hgCollectText(hgNode, hgOut = []) {
  if (hgNode == null || typeof hgNode === "boolean") return hgOut;
  if (typeof hgNode === "string" || typeof hgNode === "number") {
    hgOut.push(String(hgNode));
    return hgOut;
  }
  if (Array.isArray(hgNode)) {
    hgNode.forEach((hgChild) => hgCollectText(hgChild, hgOut));
    return hgOut;
  }
  if (React.isValidElement(hgNode)) {
    hgCollectText(hgNode.props?.children, hgOut);
    return hgOut;
  }
  return hgOut;
}

const HG_CATEGORIES = [
  { categoryId: "11", name: "数码", depth: 1 },
  { categoryId: "12", name: "手机", depth: 2 },
];

test("类目列表加载服务端数据并按审核权渲染管理入口", async () => {
  const hgCommerce = { categories: async () => HG_CATEGORIES };
  const hgInstance = hgPage("hg_commerce_category_page.jsx", hgCommerce, {
    reviewAccess: async () => ({ canReview: true }),
  });
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgError, "");
  assert.equal(hgInstance.state.hgCategories.length, 2);
  assert.equal(hgInstance.state.hgCanReview, true);

  const hgRendered = hgInstance.render();
  const hgTable = hgFindElement(hgRendered, HGTestTable);
  assert.ok(hgTable, "列表页必须渲染 HGTable 组件");
  assert.deepEqual(
    hgTable.props.dataSource.map((hgItem) => hgItem.categoryId),
    ["11", "12"]
  );

  const hgToolbarLinks = hgCollectLinks(hgInstance.renderToolbar());
  assert.equal(hgToolbarLinks.length, 1);
  assert.equal(hgToolbarLinks[0].text, "新建普通类目");
  assert.equal(hgToolbarLinks[0].to, ROUTE_PATH.COMMERCE_CATEGORY_CREATE);

  const hgActionLinks = hgCollectLinks(hgInstance.renderActions(HG_CATEGORIES[0]));
  assert.equal(hgActionLinks.length, 2);
  assert.equal(hgActionLinks[0].text, "编辑");
  assert.equal(
    hgActionLinks[0].to,
    ROUTE_PATH.COMMERCE_CATEGORY_EDIT.replace(":categoryId", "11")
  );
  assert.equal(hgActionLinks[1].text, "删除");
  assert.equal(
    hgActionLinks[1].to,
    ROUTE_PATH.COMMERCE_CATEGORY_DELETE.replace(":categoryId", "11")
  );
});

test("无审核权时列表仍展示但不渲染任何管理入口", async () => {
  const hgCommerce = { categories: async () => HG_CATEGORIES };
  const hgInstance = hgPage("hg_commerce_category_page.jsx", hgCommerce, {
    reviewAccess: async () => ({ canReview: false }),
  });
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgCanReview, false);
  assert.equal(hgInstance.renderToolbar(), null);
  assert.deepEqual(hgCollectLinks(hgInstance.renderActions(HG_CATEGORIES[0])), []);
  // 权限接口失败同样降级为只读展示，不阻断类目加载。
  const hgFallback = hgPage("hg_commerce_category_page.jsx", hgCommerce, {
    reviewAccess: async () => {
      throw new Error("无权限");
    },
  });
  await hgFallback.hgLoad();
  assert.equal(hgFallback.state.hgCanReview, false);
  assert.equal(hgFallback.state.hgError, "");
});

test("新建类目页提交名称与上级并以普通类目创建", async () => {
  const hgCalls = [];
  const hgCommerce = {
    createCategory: async (hgBody) => {
      hgCalls.push(hgBody);
      return { categoryId: "20", name: hgBody.name, depth: 1 };
    },
  };
  const hgInstance = hgPage("hg_commerce_category_create_page.jsx", hgCommerce);
  hgInstance.setState({ hgName: " 零食 ", hgParentId: "" });
  await hgInstance.hgSubmit({ preventDefault() {} });
  // 跨 VM 上下文数组原型不同，deepEqual 会误报；逐字段断言。
  assert.equal(hgCalls.length, 1);
  assert.equal(hgCalls[0].name, "零食");
  assert.equal(hgCalls[0].parentId, "");
  assert.equal(hgCalls[0].regulated, false);
  assert.equal(hgInstance.state.hgNotice, "类目已创建");
  assert.equal(hgInstance.state.hgError, "");
});

test("编辑类目页从列表解析当前名称并提交到预留接口", async () => {
  const hgCalls = [];
  const hgCommerce = {
    categories: async () => HG_CATEGORIES,
    editCategory: async (hgID, hgBody) => {
      hgCalls.push({ hgID, hgBody });
      return { categoryId: hgID, name: hgBody.name, depth: 2 };
    },
  };
  const hgPageModule = hgPage("hg_commerce_category_edit_page.jsx", hgCommerce);
  hgPageModule.props = { params: { categoryId: "12" } };
  await hgPageModule.hgLoad();
  assert.equal(hgPageModule.state.hgName, "手机");
  assert.equal(hgPageModule.state.hgLoaded, true);
  hgPageModule.setState({ hgName: "手机配件" });
  await hgPageModule.hgSubmit({ preventDefault() {} });
  assert.equal(hgCalls.length, 1);
  assert.equal(hgCalls[0].hgID, "12");
  assert.equal(hgCalls[0].hgBody.name, "手机配件");
  assert.equal(hgPageModule.state.hgNotice, "类目已更新");

  // 目标不在可经营列表中时不允许提交编辑。
  const hgMissing = hgPage("hg_commerce_category_edit_page.jsx", hgCommerce);
  hgMissing.props = { params: { categoryId: "999" } };
  await hgMissing.hgLoad();
  assert.match(hgMissing.state.hgError, /未找到该类目/);
  assert.equal(hgMissing.state.hgLoaded, false);
});

test("删除类目页展示目标信息并确认提交到预留接口", async () => {
  const hgCalls = [];
  const hgCommerce = {
    categories: async () => HG_CATEGORIES,
    deleteCategory: async (hgID) => {
      hgCalls.push(hgID);
      return {};
    },
  };
  const hgInstance = hgPage("hg_commerce_category_delete_page.jsx", hgCommerce);
  hgInstance.props = { params: { categoryId: "12" } };
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgTarget.name, "手机");
  await hgInstance.hgConfirm();
  assert.deepEqual(hgCalls, ["12"]);
  assert.equal(hgInstance.state.hgNotice, "类目已删除");
});

test("商家人民币页管理区不再包含添加普通类目表单", () => {
  const hgInstance = hgPage("hg_merchant_commerce_page.jsx", {
    categories: async () => [],
    mine: async () => ({ list: [] }),
    unusedImages: async () => ({ imageURLs: [] }),
  });
  assert.ok(!("hgCategoryName" in hgInstance.state), "类目表单 state 应已移除");
  hgInstance.setState({ hgCanReview: true });
  const hgAdminTree = hgInstance.renderAdmin();
  const hgText = hgCollectText(hgAdminTree).join("");
  assert.ok(!hgText.includes("添加普通类目"), "renderAdmin 不应再渲染类目表单");
  assert.ok(!hgText.includes("新普通类目名称"));
});

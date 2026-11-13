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

/** 加载真实商城 VM，并替换网络层以核对原始二进制上传协议。 */
function hgCommerceVM(hgPost) {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_commerce_vm.js", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_commerce_vm.js",
    jsc: { parser: { syntax: "ecmascript" }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (hgDependency) => {
      if (hgDependency.endsWith("hg_mall_vm.js"))
        return { default: class {}, __esModule: true };
      if (hgDependency.endsWith("hg_net_manager_vm.jsx"))
        return { default: { post: hgPost }, __esModule: true };
      if (hgDependency.endsWith("hg_api_constants.jsx"))
        return {
          HGMANAGER_API: { COMMERCE_CATEGORY_IMAGE: "/api/v1/commerce/admin/categories/images" },
          __esModule: true,
        };
      return {};
    },
  });
  return hgModule.exports.default;
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
  { categoryId: "12", parentId: "11", name: "手机", depth: 2, imageURL: "/old.png" },
];

test("类目图片以 API Guard 约定的原始二进制类型上传", async () => {
  const hgCalls = [];
  const HGCommerceVM = hgCommerceVM(async (...hgArgs) => {
    hgCalls.push(hgArgs);
    return { imageURL: "/category.png" };
  });
  const hgFile = { type: "image/png", size: 1024 };
  await HGCommerceVM.uploadCategoryImage(hgFile);
  assert.equal(hgCalls.length, 1);
  assert.equal(hgCalls[0][0], "/api/v1/commerce/admin/categories/images?ext=png");
  assert.equal(hgCalls[0][1], hgFile);
  assert.equal(hgCalls[0][2].headers["Content-Type"], "application/octet-stream");
});

test("类目列表加载服务端数据并按审核权渲染管理入口", async () => {
  const hgCommerce = { adminCategories: async () => HG_CATEGORIES, categories: async () => { throw new Error("不应调用商家接口"); } };
  const hgInstance = hgPage("hg_commerce_category_page.jsx", hgCommerce, {
    reviewAccess: async () => ({ canReview: true }),
  });
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgError, "");
  assert.equal(hgInstance.state.hgCategories.length, 2);
  assert.equal(hgInstance.state.hgCanReview, true);

  const hgRendered = hgInstance.render();
  let hgTable = hgFindElement(hgRendered, HGTestTable);
  assert.ok(hgTable, "列表页必须渲染 HGTable 组件");
  assert.deepEqual(
    Array.from(hgTable.props.dataSource, (hgItem) => hgItem.categoryId),
    ["11", "12"]
  );
  assert.equal(hgTable.props.pagination.total, 1, "父子类目共占一个分页名额");
  assert.equal(hgTable.props.dataSource[1].hgTreeLevel, 1);
  assert.equal(hgTable.props.dataSource[0].hgHasChildren, true);
  const hgToggle = hgFindElement(hgTable.props.columns[0].render("11", hgTable.props.dataSource[0]), "button");
  assert.equal(hgToggle.props["aria-expanded"], true);
  hgToggle.props.onClick();
  hgTable = hgFindElement(hgInstance.render(), HGTestTable);
  assert.deepEqual(Array.from(hgTable.props.dataSource, (hgItem) => hgItem.categoryId), ["11"]);
  assert.equal(hgFindElement(hgTable.props.columns[0].render("11", hgTable.props.dataSource[0]), "button").props["aria-expanded"], false);
  hgInstance.hgToggleCategory("11");
  assert.deepEqual(Array.from(hgFindElement(hgInstance.render(), HGTestTable).props.dataSource, (hgItem) => hgItem.categoryId), ["11", "12"]);

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

test("类目树支持三级、孤儿根节点且翻页不拆散父子类目", async () => {
  const hgList = [
    { categoryId: "child", parentId: "root", name: "二级", depth: 2 },
    { categoryId: "grandchild", parentId: "child", name: "三级", depth: 3 },
    { categoryId: "root", parentId: "", name: "一级", depth: 1 },
    { categoryId: "orphan", parentId: "disabled", name: "父类目未返回", depth: 2 },
  ];
  const hgInstance = hgPage("hg_commerce_category_page.jsx", { adminCategories: async () => hgList }, {
    reviewAccess: async () => ({ canReview: true }),
  });
  await hgInstance.hgLoad();
  hgInstance.hgHandleTableChange({ current: 1, pageSize: 1 });
  let hgTable = hgFindElement(hgInstance.render(), HGTestTable);
  assert.equal(hgTable.props.pagination.total, 2);
  assert.deepEqual(Array.from(hgTable.props.dataSource, (hgItem) => hgItem.categoryId), ["root", "child", "grandchild"]);
  assert.equal(hgTable.props.dataSource[2].hgTreeLevel, 2);
  hgInstance.hgHandleTableChange({ current: 2, pageSize: 1 });
  hgTable = hgFindElement(hgInstance.render(), HGTestTable);
  assert.deepEqual(Array.from(hgTable.props.dataSource, (hgItem) => hgItem.categoryId), ["orphan"]);
  const hgOrphanLinks = hgCollectLinks(hgInstance.renderActions(hgTable.props.dataSource[0]));
  assert.equal(hgOrphanLinks[0].to, ROUTE_PATH.COMMERCE_CATEGORY_EDIT.replace(":categoryId", "orphan"));
});

test("类目列表前端分页：按页切片、回传页码并收敛越界页", async () => {
  const hgList = Array.from({ length: 25 }, (_, hgIndex) => ({
    categoryId: String(hgIndex + 1),
    name: `类目${hgIndex + 1}`,
    depth: 1,
  }));
  const hgCommerce = { adminCategories: async () => hgList, categories: async () => { throw new Error("不应调用商家接口"); } };
  const hgInstance = hgPage("hg_commerce_category_page.jsx", hgCommerce, {
    reviewAccess: async () => ({ canReview: true }),
  });
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgPageCurrent, 1);

  // 默认每页 10 条；分页器把全量 25 条交给 total，切片只发生在 dataSource。
  // 分页对象在 VM realm 中创建，与测试环境原型不同，需逐字段断言而非 deepEqual。
  let hgTable = hgFindElement(hgInstance.render(), HGTestTable);
  assert.equal(hgTable.props.dataSource.length, 10);
  assert.equal(hgTable.props.pagination.current, 1);
  assert.equal(hgTable.props.pagination.pageSize, 10);
  assert.equal(hgTable.props.pagination.total, 25);
  assert.equal(hgTable.props.pagination.showSizeChanger, true);

  // 翻页回传页码后，切片对应当页数据。
  hgInstance.hgHandleTableChange({ current: 3, pageSize: 10 });
  hgTable = hgFindElement(hgInstance.render(), HGTestTable);
  assert.deepEqual(
    Array.from(hgTable.props.dataSource, (hgItem) => hgItem.categoryId),
    ["21", "22", "23", "24", "25"]
  );

  // 页码越界（如数据刷新后旧页码超出范围）收敛到最后一页，不出现空页。
  hgInstance.setState({ hgPageCurrent: 99 });
  const hgOverflow = hgInstance.hgCurrentPageCategories();
  assert.equal(hgOverflow.length, 5);
  assert.equal(hgOverflow[0].categoryId, "21");
});

test("无审核权时不读取平台类目并给出缺失权限说明", async () => {
  const hgCommerce = { adminCategories: async () => { throw new Error("不应调用管理接口"); } };
  const hgInstance = hgPage("hg_commerce_category_page.jsx", hgCommerce, {
    reviewAccess: async () => ({ canReview: false }),
  });
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgCanReview, false);
  assert.match(hgInstance.state.hgError, /mall:merchant:review/);
  assert.equal(hgInstance.renderToolbar(), null);
  assert.deepEqual(hgCollectLinks(hgInstance.renderActions(HG_CATEGORIES[0])), []);
  // 权限接口失败不能退化为商家接口读取平台数据。
  const hgFallback = hgPage("hg_commerce_category_page.jsx", hgCommerce, {
    reviewAccess: async () => {
      throw new Error("无权限");
    },
  });
  await hgFallback.hgLoad();
  assert.equal(hgFallback.state.hgCanReview, false);
  assert.match(hgFallback.state.hgError, /无权限/);
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
  hgInstance.setState({ hgCategoryId: "FOOD-0001", hgName: " 零食 ", hgParentId: "" });
  await hgInstance.hgSubmit({ preventDefault() {} });
  // 跨 VM 上下文数组原型不同，deepEqual 会误报；逐字段断言。
  assert.equal(hgCalls.length, 1);
  assert.equal(hgCalls[0].categoryId, "FOOD-0001");
  assert.equal(hgCalls[0].name, "零食");
  assert.equal(hgCalls[0].parentId, "");
  assert.equal(hgCalls[0].regulated, false);
  assert.equal(hgCalls[0].imageURL, "");
  assert.equal(hgInstance.state.hgNotice, "类目已创建");
  assert.equal(hgInstance.state.hgError, "");
});

test("选择类目图片后创建失败复用已上传 URL，不重复上传", async () => {
  let hgUploads = 0; // 同一次草稿在写失败后只上传一次图片。
  const hgBodies = []; // 创建重试提交相同图片 URL。
  const hgInstance = hgPage("hg_commerce_category_create_page.jsx", {
    uploadCategoryImage: async () => { hgUploads += 1; return { imageURL: "/category.png" }; },
    createCategory: async (hgBody) => {
      hgBodies.push(hgBody);
      if (hgBodies.length === 1) throw new Error("服务失败");
      return { categoryId: "1" };
    },
  });
  hgInstance.hgChooseImage({ target: { files: [{ type: "image/png", size: 1024 }], value: "" } });
  hgInstance.setState({ hgCategoryId: "CAT-0001", hgName: "类目" });
  await hgInstance.hgSubmit({ preventDefault() {} });
  assert.match(hgInstance.state.hgError, /服务失败/);
  assert.equal(hgInstance.state.hgImageURL, "/category.png");
  await hgInstance.hgSubmit({ preventDefault() {} });
  assert.equal(hgUploads, 1);
  assert.equal(hgBodies.length, 2);
  assert.equal(hgBodies[0].imageURL, "/category.png");
  assert.equal(hgBodies[1].imageURL, "/category.png");
  assert.equal(hgInstance.state.hgNotice, "类目已创建");
});

test("无效类目名称或 ID 在上传前拒绝，不占用对象存储", async () => {
  let hgUploads = 0; // 无效输入不能导致上传副作用。
  const hgInstance = hgPage("hg_commerce_category_create_page.jsx", {
    uploadCategoryImage: async () => { hgUploads += 1; },
  });
  hgInstance.hgChooseImage({ target: { files: [{ type: "image/png", size: 1024 }], value: "" } });
  await hgInstance.hgSubmit({ preventDefault() {} });
  assert.equal(hgUploads, 0);
  assert.match(hgInstance.state.hgError, /类目名称/);
  hgInstance.setState({ hgName: "数码影音", hgCategoryId: "非法 ID" });
  await hgInstance.hgSubmit({ preventDefault() {} });
  assert.equal(hgUploads, 0);
  assert.match(hgInstance.state.hgError, /类目 ID/);
});

test("DIG-0001 可作为新类目 ID，上级类目从管理端列表下拉选择", async () => {
  const hgCalls = [];
  const hgCommerce = {
    adminCategories: async () => HG_CATEGORIES,
    createCategory: async (hgBody) => { hgCalls.push(hgBody); return { categoryId: "30" }; },
  };
  const hgInstance = hgPage("hg_commerce_category_create_page.jsx", hgCommerce);
  await hgInstance.hgLoadCategories();
  assert.equal(hgInstance.state.hgAdminCategories.length, 2);

  // 渲染出下拉选项：一级 + 两个已有业务 ID，杜绝手输不存在的上级。
  hgInstance.setState({ hgCategoryId: "DIG-0001", hgName: "数码影音" });
  const hgSelect = hgFindElement(hgInstance.render(), "select");
  assert.ok(hgSelect, "上级类目必须是下拉选择");
  assert.equal(hgSelect.props.value, "");
  const hgOptions = React.Children.toArray(hgSelect.props.children);
  assert.equal(hgOptions.length, 3);
  assert.equal(hgOptions[1].props.value, "11");

  // 选择上级后同时提交自定义类目 ID 与已有上级 ID。
  hgInstance.setState({ hgParentId: "11" });
  await hgInstance.hgSubmit({ preventDefault() {} });
  assert.equal(hgCalls.length, 1);
  assert.equal(hgCalls[0].categoryId, "DIG-0001");
  assert.equal(hgCalls[0].parentId, "11");

  // 兜底校验：下拉状态被篡改为包含空格的非法 ID 时仍拒绝。
  hgInstance.setState({ hgCategoryId: "DIG-0002", hgName: "数码影音", hgParentId: "BAD ID" });
  await hgInstance.hgSubmit({ preventDefault() {} });
  assert.equal(hgCalls.length, 1, "校验失败不得发起创建请求");
  assert.match(hgInstance.state.hgError, /下拉列表/);
});

test("编辑类目页可修改 ID、名称、上级和图片", async () => {
  const hgCalls = [];
  let hgUploads = 0;
  const hgCommerce = {
    adminCategories: async () => HG_CATEGORIES,
    unusedCategoryImages: async () => ({ imageURLs: [] }),
    uploadCategoryImage: async () => {
      hgUploads += 1;
      return { imageURL: "/new.png" };
    },
    editCategory: async (hgID, hgBody) => {
      hgCalls.push({ hgID, hgBody });
      return { ...hgBody, depth: 1 };
    },
  };
  const hgPageModule = hgPage("hg_commerce_category_edit_page.jsx", hgCommerce);
  hgPageModule.props = { params: { categoryId: "12" } };
  await hgPageModule.hgLoad();
  assert.equal(hgPageModule.state.hgCategoryId, "12");
  assert.equal(hgPageModule.state.hgName, "手机");
  assert.equal(hgPageModule.state.hgParentId, "11");
  assert.equal(hgPageModule.state.hgImageURL, "/old.png");
  assert.equal(hgPageModule.state.hgLoaded, true);
  hgPageModule.setState({
    hgCategoryId: "PHONE-0001",
    hgName: "手机配件",
    hgParentId: "",
    hgFile: { type: "image/png", size: 1024, name: "new.png" },
    hgImageURL: "",
  });
  await hgPageModule.hgSubmit({ preventDefault() {} });
  assert.equal(hgCalls.length, 1);
  assert.equal(hgCalls[0].hgID, "12");
  assert.equal(hgCalls[0].hgBody.categoryId, "PHONE-0001");
  assert.equal(hgCalls[0].hgBody.name, "手机配件");
  assert.equal(hgCalls[0].hgBody.parentId, "");
  assert.equal(hgCalls[0].hgBody.imageURL, "/new.png");
  assert.equal(hgUploads, 1);
  assert.equal(hgPageModule.state.hgOriginalId, "PHONE-0001");
  assert.equal(hgPageModule.state.hgNotice, "类目已更新");

  // 目标不在可经营列表中时不允许提交编辑。
  const hgMissing = hgPage("hg_commerce_category_edit_page.jsx", hgCommerce);
  hgMissing.props = { params: { categoryId: "999" } };
  await hgMissing.hgLoad();
  assert.match(hgMissing.state.hgError, /未找到该类目/);
  assert.equal(hgMissing.state.hgLoaded, false);
});

test("父类目可进入编辑页并只开放名称与图片", async () => {
  const hgCalls = [];
  const hgInstance = hgPage("hg_commerce_category_edit_page.jsx", {
    adminCategories: async () => HG_CATEGORIES,
    editCategory: async (hgID, hgBody) => { hgCalls.push({ hgID, hgBody }); return { ...hgBody }; },
  });
  hgInstance.props = { params: { categoryId: "11" } };
  await hgInstance.hgLoad();
  assert.equal(hgInstance.state.hgLoaded, true);
  assert.equal(hgFindElement(hgInstance.render(), "input").props.disabled, true);
  assert.equal(hgFindElement(hgInstance.render(), "select").props.disabled, true);
  hgInstance.setState({ hgName: "数码影音" });
  await hgInstance.hgSubmit({ preventDefault() {} });
  assert.equal(hgCalls.length, 1);
  assert.equal(hgCalls[0].hgID, "11");
  assert.equal(hgCalls[0].hgBody.categoryId, "11");
  assert.equal(hgCalls[0].hgBody.name, "数码影音");
});

test("删除类目页展示目标信息并确认提交到预留接口", async () => {
  const hgCalls = [];
  const hgCommerce = {
    adminCategories: async () => HG_CATEGORIES,
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

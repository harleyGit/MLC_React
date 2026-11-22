import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

const HG_TEST_SOURCE = new URL("./hg_scope_type_page.jsx", import.meta.url); // 真实页面源码路径。
const HGTestHeader = () => null; // 页头替身：只承接结构与 props，不操作 DOM。
const HGTestCard = () => null; // 卡片替身：只承接结构与 props。
const HGTestTable = () => null; // 表格替身：不启动虚拟滚动。
const HGTestButton = () => null; // 按钮替身：不触发写请求。
const HGTestSwitch = () => null; // 开关替身：读取受控状态并调用真实页面的切换处理。

/** hgProps 来自测试路由，默认列表态；hgVM/hgMessage 默认无副作用，按用例注入响应与反馈记录。 */
function hgScopeTypePage(hgProps = {}, hgVM = {}, hgMessage = { success() {}, error() {} }) {
  const hgModule = { exports: {} }; // JSX 模块替身，仅用于取得页面类。
  const hgCode = transformSync(readFileSync(HG_TEST_SOURCE, "utf8"), {
    filename: "hg_scope_type_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code; // Node 测试环境下的 JSX 转换产物，仅保存在内存。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    React,
    URLSearchParams,
    require: (hgDependency) => {
      if (hgDependency === "react") return React;
      if (hgDependency.endsWith("hg_page_header_page")) return { default: HGTestHeader, __esModule: true };
      if (hgDependency.endsWith("hg_card_page")) return { default: HGTestCard, __esModule: true };
      if (hgDependency.endsWith("hg_table_page")) return { default: HGTestTable, __esModule: true };
      if (hgDependency.endsWith("hg_button_page")) return { default: HGTestButton, __esModule: true };
      if (hgDependency.endsWith("hg_permission")) return { HGAuthButton: HGTestButton };
       if (hgDependency.endsWith("hg_permission_codes")) return { HG_PERMISSIONS: { IAM_GRANT: "iam:role:grant", IAM_GRANT_DIRECT: "iam:role:grant_direct" } };
      if (hgDependency.endsWith("hg_switch_page")) return { default: HGTestSwitch, __esModule: true };
      if (hgDependency.endsWith("hg_message_page")) return { hgMessage };
      if (hgDependency.endsWith("hg_scope_type.module.css")) return { scopeTypePage: "scopeTypePage" };
      if (hgDependency.endsWith("hg_scope_type_vm")) return { default: { list: async () => [], detail: async () => ({}), ...hgVM }, __esModule: true };
      return { default: () => null, __esModule: true };
    },
  });
  return new hgModule.exports.default(hgProps);
}

test("列表页由单个容器包裹页头与卡片，避免页头被 flex 拉伸产生留白", () => {
  const hgTree = hgScopeTypePage().render(); // 不触发 componentDidMount，读取初始列表态。
  assert.equal(hgTree.type, "div"); // 必须是单个 div；若为 Fragment，页头与卡片会成为 .contentBody 的 flex 兄弟被拉伸。
  assert.equal(hgTree.props.className, "scopeTypePage"); // 容器需带样式类，作为父级唯一的弹性子项。
  const hgChildren = React.Children.toArray(hgTree.props.children);
  assert.equal(hgChildren[0].type, HGTestHeader); // 首个子元素为页头（含「创建作用域类型」按钮）。
  assert.equal(hgChildren[0].props.title, "作用域类型");
  assert.equal(hgChildren[1].type, HGTestCard); // 次个子元素为列表卡片，与页头同处普通文档流。
  assert.equal(hgChildren[1].props.title, "作用域类型列表");
});

test("仅对已启用的新作用域创建实体，所有者经服务端验证，ID 只来自服务端", async () => {
  const hgCalls = []; // 只核对业务创建载荷，不访问真实 IAM 接口。
  const hgMessages = []; // 接口结果文案，不保存个人资料。
  const hgPage = hgScopeTypePage({}, {
    registerResource: async (payload) => { hgCalls.push(payload); return { id: "server-id", name: payload.name }; },
  }, { success: (text) => hgMessages.push(text), error: (text) => hgMessages.push(text) });
  hgPage.hgMounted = true;
  hgPage.setState = (patch) => { hgPage.state = { ...hgPage.state, ...(typeof patch === "function" ? patch(hgPage.state) : patch) }; };
  hgPage.setState({ items: [{ code: "creator", name: "创作者", status: 1 }, { code: "region", name: "区域", status: 0 }],
    hgResourceType: "region", hgResourceName: "测试区域" });
  await hgPage.hgRegisterResource();
  assert.equal(hgCalls.length, 0);
  hgPage.setState({ hgResourceType: "creator", hgResourceName: " 创作者空间 " });
  await hgPage.hgRegisterResource();
  assert.equal(hgCalls.length, 0); // 缺少所有者不能制造无归属空间。
  hgPage.setState({ hgOwnerUserID: "CREATOR" });
  await hgPage.hgRegisterResource();
  assert.deepEqual(JSON.parse(JSON.stringify(hgCalls)), [{
    scopeType: "creator", name: "创作者空间", ownerUserId: "CREATOR", code: "", organizationId: "",
  }]);
  assert.equal(hgPage.state.hgLastResource.id, "server-id");
  assert.equal(hgPage.state.hgResourceName, "");
  assert.ok(hgMessages.some((text) => text.includes("现有业务接口仍按原有鉴权")));
});

test("表单页与列表页两处根节点都使用单容器，防止留白问题在编辑页复现", () => {
  const hgSource = readFileSync(HG_TEST_SOURCE, "utf8"); // 当前真实源码。
  const hgContainerRoots = hgSource.match(/<div className=\{styles\.scopeTypePage\}>/g) || []; // 两处 render 的根容器标记。
  assert.equal(hgContainerRoots.length, 2); // 表单页与列表页各一处，均未回退为 Fragment。
});

/** hgCode 空串表示创建，其他值表示编辑；通过真实 URL 分支取得共用表单，避免额外导出组件。 */
function hgScopeTypeForm(hgCode, hgVM, hgMessages) {
  const hgPage = hgScopeTypePage({
    selectedKey: hgCode ? "role_scope_type_edit" : "role_scope_type_create",
    location: { search: hgCode ? `?code=${hgCode}` : "" },
    onBack: () => { hgMessages.push("返回列表"); },
  }, hgVM, {
    success: (hgText) => { hgMessages.push(hgText); },
    error: (hgText) => { hgMessages.push(hgText); },
  }); // 页面与返回行为均来自当前路由协议。
  const hgElement = hgPage.render(); // 真正的共用表单 React 元素。
  const hgForm = new hgElement.type(hgElement.props); // 测试实例不挂载 DOM，状态更新同步执行。
  hgForm.setState = (hgPatch) => {
    hgForm.state = { ...hgForm.state, ...(typeof hgPatch === "function" ? hgPatch(hgForm.state) : hgPatch) };
  };
  hgForm.hgMounted = true;
  return hgForm;
}

/** 遍历页面生成的元素，不渲染 UI 替身；用于定位真实受控开关。 */
function hgFindScopeSwitch(hgTree) {
  if (!React.isValidElement(hgTree)) return null;
  if (hgTree.type === HGTestSwitch) return hgTree;
  for (const hgChild of React.Children.toArray(hgTree.props.children)) {
    const hgFound = hgFindScopeSwitch(hgChild); // 当前子树的开关，null 表示继续搜索。
    if (hgFound) return hgFound;
  }
  return null;
}

for (const hgStatus of [0, 1]) {
  test(`创建页可选择状态 ${hgStatus} 并提交整数 status`, async () => {
    const hgCalls = []; // 记录请求快照。
    const hgMessages = []; // 成功反馈和返回动作。
    const hgForm = hgScopeTypeForm("", { create: async (hgPayload) => { hgCalls.push(hgPayload); } }, hgMessages);
    hgForm.hgField("code", " new_scope ");
    hgForm.hgField("name", " 新类型 ");
    const hgSwitch = hgFindScopeSwitch(hgForm.render()); // 新建默认关闭的受控开关。
    assert.equal(hgSwitch.props.checked, false);
    assert.equal(hgSwitch.props.disabled, false);
    hgSwitch.props.onChange(hgStatus === 1);
    assert.equal(hgFindScopeSwitch(hgForm.render()).props.checked, hgStatus === 1);
    await hgForm.hgSave();
    assert.deepEqual(JSON.parse(JSON.stringify(hgCalls)), [{ code: "new_scope", name: "新类型", description: "", status: hgStatus }]);
    assert.deepEqual(hgMessages, [`已创建（${hgStatus === 1 ? "已启用" : "已停用"}）`, "返回列表"]);
  });

  test(`编辑页回填状态 ${hgStatus} 后可切换并保存`, async () => {
    const hgCalls = []; // 详情与更新请求的先后顺序。
    const hgMessages = []; // 页面反馈。
    const hgForm = hgScopeTypeForm("region", {
      detail: async (hgCode) => {
        hgCalls.push(["detail", hgCode]);
        return { code: "region", name: "区域", description: "用途", status: hgStatus };
      },
      update: async (hgPayload) => { hgCalls.push(["update", hgPayload]); },
    }, hgMessages);
    assert.equal(hgFindScopeSwitch(hgForm.render()).props.disabled, true);
    await hgForm.hgLoadDetail();
    const hgSwitch = hgFindScopeSwitch(hgForm.render()); // 详情回填后的开关。
    assert.equal(hgSwitch.props.checked, hgStatus === 1);
    assert.equal(hgSwitch.props.disabled, false);
    hgSwitch.props.onChange(hgStatus === 0);
    await hgForm.hgSave();
    assert.deepEqual(JSON.parse(JSON.stringify(hgCalls)), [["detail", "region"], ["update", { code: "region", name: "区域", description: "用途", status: 1 - hgStatus }]]);
    assert.deepEqual(hgMessages, [`已更新（${hgStatus === 0 ? "已启用" : "已停用"}）`, "返回列表"]);
  });
}

test("核心类型开关禁止停用，仍可修改名称保存启用状态", async () => {
  for (const hgCode of ["global", "shop", "org"]) {
    const hgCalls = []; // 每个核心类型的更新请求。
    const hgForm = hgScopeTypeForm(hgCode, {
      detail: async () => ({ code: hgCode, name: "核心类型", status: 1 }),
      update: async (hgPayload) => { hgCalls.push(hgPayload); },
    }, []);
    await hgForm.hgLoadDetail();
    assert.equal(hgFindScopeSwitch(hgForm.render()).props.disabled, true);
    hgForm.hgField("name", "新名称");
    await hgForm.hgSave();
    assert.equal(hgCalls[0].status, 1);
    assert.equal(hgCalls[0].name, "新名称");
  }
});

test("停用被后端拒绝时保留草稿并显示错误，保存期间禁用开关", async () => {
  const hgMessages = []; // 冲突反馈，不应返回列表。
  const hgForm = hgScopeTypeForm("region", {
    detail: async () => ({ code: "region", name: "区域", status: 1 }),
    update: async () => {
      assert.equal(hgFindScopeSwitch(hgForm.render()).props.disabled, true);
      throw new Error("角色或授权状态冲突");
    },
  }, hgMessages);
  await hgForm.hgLoadDetail();
  hgFindScopeSwitch(hgForm.render()).props.onChange(false);
  await hgForm.hgSave();
  assert.equal(hgForm.state.form.status, 0);
  assert.equal(hgForm.state.saving, false);
  assert.deepEqual(hgMessages, ["角色或授权状态冲突"]);
});

test("详情状态缺失时禁止保存，避免以默认值覆盖数据库状态", async () => {
  const hgCalls = []; // 不允许出现更新调用。
  const hgForm = hgScopeTypeForm("region", {
    detail: async () => ({ code: "region", name: "区域" }),
    update: async (hgPayload) => { hgCalls.push(hgPayload); },
  }, []);
  await hgForm.hgLoadDetail();
  assert.equal(hgForm.state.error, "作用域类型状态无效，请重试");
  assert.equal(hgFindScopeSwitch(hgForm.render()).props.disabled, true);
  await hgForm.hgSave();
  assert.equal(hgCalls.length, 0);
});

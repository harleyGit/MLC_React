import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

/** 隔离 DOM 和 CSS，仅执行真实 TreeSelect 的选择与渲染逻辑。 */
function hgTreeSelect(props) {
  const hgModule = { exports: {} }; // 转换后的组件出口，不加载浏览器环境。
  const hgSource = readFileSync(new URL("./hg_tree_select_page.jsx", import.meta.url), "utf8"); // 真实组件源码。
  const hgCode = transformSync(hgSource, {
    filename: "hg_tree_select_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code; // JSX 转换只存在于内存中。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (name) => {
      if (name === "react") return React;
      if (name === "react-dom") return { createPortal: (child) => child };
      return { default: new Proxy({}, { get: (_, key) => key }), __esModule: true };
    },
  });
  const hgComponent = new hgModule.exports.default({ ...hgModule.exports.default.defaultProps, ...props }); // 与 React defaultProps 合并规则一致。
  hgComponent.setState = (update) => {
    hgComponent.state = { ...hgComponent.state, ...(typeof update === "function" ? update(hgComponent.state) : update) };
  };
  return hgComponent;
}

/** 从 JSX 树中寻找实际可操作的 radio/checkbox 输入。 */
function hgFindInput(node) {
  if (Array.isArray(node)) return node.map(hgFindInput).find(Boolean);
  if (!React.isValidElement(node)) return null;
  if (node.type === "input") return node;
  return hgFindInput(node.props.children);
}

test("单选以圆形 radio 呈现并返回单值，切换角色替换原有选项", () => {
  const hgChanges = []; // 仅记录选中值，不包含业务数据。
  const hgTree = hgTreeSelect({
    treeData: [{ value: "7", title: "审核员" }, { value: "8", title: "运营员" }],
    onChange: (value) => hgChanges.push(value),
  });
  const hgFirst = hgTree.renderTreeNode(hgTree.props.treeData[0], 0);
  assert.equal(hgFindInput(hgFirst).props.type, "radio");
  assert.equal(hgFindInput(hgFirst).props.name, hgFindInput(hgTree.renderTreeNode(hgTree.props.treeData[1], 0)).props.name);
  hgTree.handleCheck(hgTree.props.treeData[0], true);
  assert.equal(hgChanges[0], "7");
  assert.equal(hgTree.getSelectedTitles(), "审核员");
  hgTree.handleCheck(hgTree.props.treeData[1], true);
  assert.equal(hgChanges[1], "8");
  assert.equal(hgTree.getSelectedTitles(), "运营员");
});

test("单选受控标量及清空，多选仍返回数组并使用方形 checkbox", () => {
  const hgSingle = hgTreeSelect({ treeData: [{ value: "7", title: "审核员" }], value: "7", allowClear: true, onChange: () => {} });
  assert.equal(hgSingle.getSelectedTitles(), "审核员");
  hgSingle.props = { ...hgSingle.props, value: null, onChange: (value) => assert.equal(value, null) };
  hgSingle.handleClear({ stopPropagation() {} });
  assert.equal(hgSingle.getSelectedTitles(), "");
  const hgChanges = []; // 多选仍使用既有数组协议。
  const hgMulti = hgTreeSelect({ treeData: [{ value: "7", title: "审核员" }], treeCheckable: true, onChange: (value) => hgChanges.push(value) });
  const hgNode = hgMulti.renderTreeNode(hgMulti.props.treeData[0], 0);
  assert.equal(hgFindInput(hgNode).props.type, "checkbox");
  hgMulti.handleCheck(hgMulti.props.treeData[0], true);
  assert.deepEqual(Array.from(hgChanges[0]), ["7"]);
});

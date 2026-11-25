import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

/** 本地转换真实复选框，只替换 CSS；核对只读模式不会触发授权编辑。 */
const hgModule = { exports: {} }; // 测试用组件模块容器。
const hgSource = readFileSync(new URL("./hg_checkbox_page.jsx", import.meta.url), "utf8"); // 复选框源码。
const hgCode = transformSync(hgSource, {
  filename: "hg_checkbox_page.jsx",
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
  module: { type: "commonjs" },
}).code;
runInNewContext(hgCode, {
  module: hgModule, exports: hgModule.exports, React,
  require: (path) => path === "react" ? React : { __esModule: true, default: {
    checkbox: "checkbox", checked: "checked", readOnly: "readOnly",
    checkboxInput: "checkboxInput", checkboxInner: "checkboxInner", checkIcon: "checkIcon", checkboxLabel: "checkboxLabel",
  } },
});

test("只读复选框保持选中和未选中状态，禁止交互但不显示禁用淡化样式", () => {
  const updates = []; // 收集交互回调；只读模式必须保持空数组。
  const Checkbox = hgModule.exports.HGCheckbox; // 使用真实组件实现验证输入属性。
  for (const checked of [true, false]) {
    const checkbox = new Checkbox({ checked, readOnly: true, disabled: false, onChange: (value) => updates.push(value), children: "权限" });
    const label = checkbox.render();
    const input = label.props.children[0];
    assert.equal(input.type, "input");
    assert.equal(input.props.checked, checked);
    assert.equal(input.props.disabled, true);
    assert.match(label.props.className, /readOnly/);
    assert.doesNotMatch(label.props.className, /disabled/);
    checkbox.handleChange({ target: { checked: !checked } });
  }
  assert.deepEqual(updates, []);
});

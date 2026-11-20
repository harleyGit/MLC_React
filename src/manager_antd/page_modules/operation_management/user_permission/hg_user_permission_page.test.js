import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

const HG_TEST_SOURCE = new URL("./hg_user_permission_page.jsx", import.meta.url); // 用户权限页面真实源码。
const HGTestTable = () => null; // 表格替身用于读取页面最终传入的公开 props。
const HGTestComponent = () => null; // 其他 UI 替身不创建 DOM。

/** 编译真实页面，网络 VM 只提供 render 阶段需要的纯函数。 */
function hgUserPermissionPage() {
  const module = { exports: {} };
  const code = transformSync(readFileSync(HG_TEST_SOURCE, "utf8"), {
    filename: "hg_user_permission_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(code, {
    module,
    exports: module.exports,
    React,
    require: (dependency) => {
      if (dependency === "react") return React;
      if (dependency.endsWith("hg_table_page")) {
        return { default: HGTestTable, __esModule: true };
      }
      if (dependency.endsWith("hg_table_contract.js")) {
        return { hgTableColumns: (columns) => columns };
      }
      if (dependency.endsWith("hg_stat_card_contract.js")) {
        return { hgStatCardItems: (items) => items };
      }
      if (dependency.endsWith("hg_detail_grid_contract.js")) {
        return { hgDetailGridItems: (items) => items };
      }
      if (dependency.endsWith("hg_user_permission_vm")) {
        return {
          default: {
            countByStatus: (rows, status) =>
              rows.filter((row) => row.status === status).length,
            getStatusTone: () => "default",
            getStatusText: (status) => String(status),
          },
          USER_PERMISSION_PAGE_SIZE: 20,
          __esModule: true,
        };
      }
      if (dependency.endsWith("hg_message_page")) {
        return {
          hgMessage: { info() {}, warning() {}, error() {}, success() {} },
        };
      }
      if (dependency.endsWith(".module.css")) {
        return {
          default: new Proxy(
            {},
            { get: (_, property) => String(property) }
          ),
          __esModule: true,
        };
      }
      if (dependency.endsWith("hg_input_page")) {
        return {
          default: HGTestComponent,
          HGInputSearch: HGTestComponent,
          __esModule: true,
        };
      }
      return { default: HGTestComponent, __esModule: true };
    },
  });
  return new module.exports.default({});
}

/** 深度查找指定 React 组件，不执行 UI 替身。 */
function hgFindElement(tree, type) {
  if (!React.isValidElement(tree)) return null;
  if (tree.type === type) return tree;
  for (const child of React.Children.toArray(tree.props.children)) {
    const found = hgFindElement(child, type);
    if (found) return found;
  }
  return null;
}

test("用户权限表格组件级和全部列配置均明确左对齐", () => {
  const page = hgUserPermissionPage();
  const columns = page.getColumns();
  assert.equal(columns.length, 6);
  assert.deepEqual(
    Array.from(columns, (column) => column.align),
    ["left", "left", "left", "left", "left", "left"]
  );

  const table = hgFindElement(page.render(), HGTestTable);
  assert.ok(table);
  assert.equal(table.props.align, "left");
  assert.deepEqual(
    Array.from(table.props.columns, (column) => column.align),
    Array.from(columns, (column) => column.align)
  );
});

test("用户信息自定义 cell 显式左对齐，不依赖内部文本继承", () => {
  const css = readFileSync(
    new URL("./hg_user_permission.module.css", import.meta.url),
    "utf8"
  );
  assert.match(css, /\.userCell\s*\{[^}]*justify-content:\s*flex-start;/s);
  assert.match(css, /\.userMeta\s*\{[^}]*align-items:\s*flex-start;/s);
  assert.match(css, /\.cellText\s*\{[^}]*text-align:\s*left;/s);
});

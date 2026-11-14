import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transformSync } from "@swc/core";
import { syncHorizontalScroll } from "./hg_table_scroll.js";
import { hgStartDrag, hgMoveDrag } from "../hg_drag_scroll/hg_drag_scroll.js";

// 用项目自带 SWC 加载真实 JSX 组件；仅替换没有 Node 运行时的 CSS Modules。
const hgRequire = createRequire(import.meta.url);
const hgModule = { exports: {} };
const { code } = transformSync(readFileSync(new URL("./hg_table_page.jsx", import.meta.url), "utf8"), {
  jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
  module: { type: "commonjs" },
});
new Function("require", "module", "exports", code)((name) => {
  if (name.endsWith(".css")) return new Proxy({}, { get: (_, key) => key });
  if (name === "./hg_table_scroll.js") return { syncHorizontalScroll };
  if (name === "../hg_drag_scroll/hg_drag_scroll.js") return { hgStartDrag, hgMoveDrag };
  return hgRequire(name);
}, hgModule, hgModule.exports);
const HGTablePage = hgModule.exports.default;

test("未配置选择时保持原列和行交互", () => {
  const columns = [{ title: "ID", dataIndex: "id" }];
  const table = new HGTablePage({ columns, dataSource: [{ id: "1" }] });
  assert.equal(table.getColumns(), columns);
  assert.equal(table.renderAutoRowHeightBody().props.children.props.children[0].props.onSelect, undefined);
});

test("单选提交当前用户，受控 key 驱动行高亮及选择控件", () => {
  const rows = [{ id: "1" }, { id: "2" }];
  let change;
  const table = new HGTablePage({
    rowKey: "id", columns: [], dataSource: rows,
    rowSelection: { type: "radio", selectedRowKeys: ["1"], onChange: (keys, selected) => { change = [keys, selected]; } },
  });
  const column = table.getColumns()[0];
  assert.equal(column.render(null, rows[0]).props.checked, true);
  assert.equal(column.render(null, rows[1]).props.type, "radio");
  table.handleSelectRow(rows[1]);
  assert.deepEqual(change, [["2"], [rows[1]]]);
  assert.equal(table.renderAutoRowHeightBody().props.children.props.children[0].props.selected, true);
});

test("多选切换、全选及清空均保留受控边界", () => {
  const rows = [{ id: "1" }, { id: "2" }];
  let change;
  const table = new HGTablePage({
    rowKey: "id", columns: [], dataSource: rows,
    rowSelection: { type: "checkbox", selectedRowKeys: ["1"], onChange: (keys, selected) => { change = [keys, selected]; } },
  });
  assert.equal(table.getColumns()[0].title.props.type, "checkbox");
  table.handleSelectRow(rows[0]);
  assert.deepEqual(change, [[], []]);
  table.handleSelectRow(rows[1]);
  assert.deepEqual(change, [["1", "2"], rows]);
  table.handleSelectAll(true);
  assert.deepEqual(change, [["1", "2"], rows]);
  table.handleSelectAll(false);
  assert.deepEqual(change, [[], []]);
});

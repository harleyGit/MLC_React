import test from "node:test";
import assert from "node:assert/strict";
import { syncHorizontalScroll } from "./hg_table_scroll.js";
import {
  HG_TABLE_COLUMN_DEFAULTS,
  HG_TABLE_PAGINATION_DEFAULTS,
  hgTableColumns,
  hgNormalizeTableAlign,
} from "./hg_table_contract.js";
import { hgStartDrag, hgMoveDrag } from "../hg_drag_scroll/hg_drag_scroll.js";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { transformSync } from "@swc/core";

/** 模拟浏览器可读写的滚动尺寸，测试不依赖网络或真实服务。 */
function createScrollElement({ scrollLeft = 0, scrollWidth, clientWidth }) {
  return { scrollLeft, scrollTop: 0, scrollWidth, clientWidth, style: {} };
}

// 使用项目已有 SWC 转换真实组件；CSS Modules 在无布局环境下只保留类名。
const hgRequire = createRequire(import.meta.url);
const hgModule = { exports: {} };
const { code: hgCode } = transformSync(
  readFileSync(new URL("./hg_table_page.jsx", import.meta.url), "utf8"),
  { jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" }, module: { type: "commonjs" } },
);
new Function("require", "module", "exports", hgCode)((name) => {
  if (name.endsWith(".css")) return { __esModule: true, default: new Proxy({}, { get: (_, key) => key }) };
  if (name === "./hg_table_scroll.js") return { syncHorizontalScroll };
  if (name === "../hg_drag_scroll/hg_drag_scroll.js") return { hgStartDrag, hgMoveDrag };
  if (name === "./hg_table_contract.js") return {
    HG_TABLE_COLUMN_DEFAULTS,
    HG_TABLE_PAGINATION_DEFAULTS,
    hgTableColumns,
    hgNormalizeTableAlign,
  };
  return hgRequire(name);
}, hgModule, hgModule.exports);
const HGTablePage = hgModule.exports.default;

test("显式关闭填充时由内容撑高，scroll.y 优先于填充模式约束高度", () => {
  const table = new HGTablePage({ dataSource: [{ id: 1 }] });
  assert.equal(table.renderAutoRowHeightBody().props.style, undefined);
  table.props = { ...table.props, scroll: { x: 1020 } };
  assert.equal(table.renderAutoRowHeightBody().props.style, undefined);
  table.props = { ...table.props, dataSource: [], scroll: { y: 360 } };
  assert.deepEqual(table.renderAutoRowHeightBody().props.style, { maxHeight: 360 });
  table.props = { ...table.props, fillHeight: true };
  assert.deepEqual(table.renderAutoRowHeightBody().props.style, { maxHeight: 360 });
});

test("默认属性启用铺满模式，调用方可显式关闭恢复内容高度", () => {
  const filled = new HGTablePage({
    ...HGTablePage.defaultProps,
    dataSource: [{ id: 1 }],
  });
  assert.equal(filled.props.fillHeight, true);
  assert.deepEqual(filled.renderAutoRowHeightBody().props.style, {
    flex: "1 1 500px",
    minHeight: 0,
  });
  filled.props = { ...filled.props, fillHeight: false };
  assert.equal(filled.renderAutoRowHeightBody().props.style, undefined);
});

test("显式宽高约束表格整体尺寸，表体只在内容溢出后滚动", () => {
  const table = new HGTablePage({
    ...HGTablePage.defaultProps,
    width: 720,
    height: "24rem",
    dataSource: [{ id: 1 }],
  });
  const rendered = table.render();
  assert.deepEqual(rendered.props.style, { width: 720, height: "24rem" });
  assert.equal(rendered.props.className.includes("explicitHeightContainer"), true);
  assert.equal(table.hgFillsParent(), false);
  assert.equal(table.hgUsesContainerHeight(), true);
  assert.deepEqual(table.renderAutoRowHeightBody().props.style, {
    flex: "1 1 500px",
    minHeight: 0,
  });
  const css = readFileSync(new URL("./hg_table.module.css", import.meta.url), "utf8");
  assert.match(css, /\.bodyWrap\s*\{[^}]*overflow:\s*auto;/s);
  assert.match(css, /\.tableContainer\s*\{[^}]*overflow:\s*hidden;/s);
});

test("固定行及分组模式不指定滚动高度时完整渲染，空态不保留固定视口", () => {
  const table = new HGTablePage({ autoRowHeight: false, dataSource: Array.from({ length: 25 }, (_, id) => ({ id })) });
  assert.equal(table.getBodyHeight(), 25 * 48);
  assert.equal(table.renderBody().props.style, undefined);
  assert.equal(table.renderBody().props.children.props.children.length, 25);
  table.props = { ...table.props, dataSource: [], sections: [{ header: "分组", data: [{ id: 1 }] }] };
  assert.equal(table.getBodyHeight(), 40 + 48);
  assert.equal(table.renderSectionBody().props.style, undefined);
  table.props = { ...table.props, sections: [] };
  assert.equal(table.renderSectionBody().props.style, undefined);
  table.props = { ...table.props, sections: undefined, scroll: { y: 360 } };
  assert.equal(table.renderBody().props.style.height, 360);
});

for (const autoRowHeight of [false, true]) {
  test(`真实组件双向同步及子节点隔离，autoRowHeight=${autoRowHeight}`, () => {
    const table = new HGTablePage({ autoRowHeight, dataSource: [] });
    const header = table.headerRef.current = createScrollElement({ scrollWidth: 1200, clientWidth: 500 });
    const body = table.scrollRef.current = createScrollElement({ scrollWidth: 1200, clientWidth: 500 });
    const onBodyScroll = autoRowHeight ? table.handleAutoRowHeightScroll : table.handleScroll;
    assert.equal(table.renderHeader().props.onScroll, table.handleHeaderScroll);
    header.scrollLeft = 320;
    table.handleHeaderScroll({ target: header, currentTarget: header });
    assert.equal(body.scrollLeft, 320);
    onBodyScroll({ target: body, currentTarget: body });
    assert.equal(header.scrollLeft, 320);
    body.scrollLeft = 700;
    onBodyScroll({ target: body, currentTarget: body });
    assert.equal(header.scrollLeft, 700);
    const child = { scrollLeft: 10, scrollTop: 900 };
    onBodyScroll({ target: child, currentTarget: body });
    table.handleHeaderScroll({ target: child, currentTarget: header });
    assert.equal(header.scrollLeft, 700);
    assert.equal(body.scrollLeft, 700);
    assert.equal(table.state.offset, 0);
  });
}

test("空态保持 ref、事件与列宽；加载和模式切换后重新对齐", () => {
  const table = new HGTablePage({ columns: [{ title: "列", width: 900 }], dataSource: [], sections: [] });
  for (const render of [table.renderBody, table.renderAutoRowHeightBody, table.renderSectionBody]) {
    const empty = render();
    assert.equal(empty.props.ref, table.scrollRef);
    assert.equal(typeof empty.props.onScroll, "function");
    assert.equal(empty.props.children.props.style.minWidth, 900);
  }
  const header = table.headerRef.current = createScrollElement({ scrollWidth: 1200, clientWidth: 500 });
  const body = table.scrollRef.current = createScrollElement({ scrollLeft: 300, scrollWidth: 1200, clientWidth: 483 });
  table.componentDidMount();
  assert.equal(header.style.width, "483px");
  assert.equal(header.scrollLeft, 300);
  body.clientWidth = 500;
  table.componentDidUpdate();
  assert.equal(header.style.width, "500px");
  table.scrollRef.current = createScrollElement({ scrollLeft: 80, scrollWidth: 1200, clientWidth: 500 });
  table.componentDidUpdate();
  assert.equal(header.scrollLeft, 80);
  table.headerRef.current = null;
  assert.doesNotThrow(() => table.componentDidUpdate());
  table.componentWillUnmount();
});

test("显式列宽固定，其他列平分剩余空间并保留一致的最小宽度", () => {
  const table = new HGTablePage({
    columns: [{ title: "类目 ID", width: 220 }, { title: "名称" }, { title: "层级" }],
    dataSource: [{ id: 1 }],
  });
  assert.equal(table.getTotalColumnsWidth(), 460);
  const headerColumns = table.renderHeader().props.children.props.children;
  assert.deepEqual(headerColumns.map((cell) => cell.props.style.flex), ["0 0 220px", "1 0 0", "1 0 0"]);
  const row = table.renderAutoRowHeightBody().props.children.props.children[0];
  const bodyColumns = new row.type(row.props).render().props.children[0];
  assert.deepEqual(bodyColumns.map((cell) => cell.props.style.flex), headerColumns.map((cell) => cell.props.style.flex));
  assert.equal(table.renderAutoRowHeightBody().props.children.props.style.minWidth, 460);

  table.props = { ...table.props, columns: [{ title: "甲" }, { title: "乙" }, { title: "丙" }] };
  assert.deepEqual(table.renderHeader().props.children.props.children.map((cell) => cell.props.style.flex), ["1 0 0", "1 0 0", "1 0 0"]);
  assert.equal(table.getTotalColumnsWidth(), 360);

  table.props = { ...table.props, columns: [{ title: "类目 ID", width: 220 }, { title: "操作", minWidth: 170 }], dataSource: [] };
  assert.equal(table.getTotalColumnsWidth(), 390);
  assert.equal(table.renderHeader().props.children.props.children[1].props.style.minWidth, 170);
});

test("标题和内容默认居中，组件级 align 设置全部列且列配置可单独覆盖", () => {
  const table = new HGTablePage({
    align: "left",
    columns: [
      { title: "默认" },
      { title: "左", align: "left" },
      { title: "中", align: "center" },
      { title: "右", align: "right" },
      { title: "标题右", align: "left", titleAlign: "right" },
      { title: "标题左", titleAlign: "left" },
    ],
    dataSource: [{ id: 1 }],
  });
  const headerCells = table.renderHeader().props.children.props.children;
  const row = table.renderAutoRowHeightBody().props.children.props.children[0];
  const bodyCells = new row.type(row.props).render().props.children[0];
  assert.deepEqual(headerCells.map((cell) => cell.props.style.textAlign), ["left", "left", "center", "right", "right", "left"]);
  assert.deepEqual(bodyCells.map((cell) => cell.props.style.textAlign), ["left", "left", "center", "right", "left", "left"]);
  assert.deepEqual(bodyCells.map((cell) => cell.props.style.justifyContent), ["flex-start", "flex-start", "center", "flex-end", "flex-start", "flex-start"]);

  table.props = { ...table.props, align: undefined, columns: [{ title: "默认" }] };
  assert.equal(table.renderHeader().props.children.props.children[0].props.style.textAlign, "center");
});

test("表格 JavaScript 契约公开 columns 子属性的默认值、作用及对齐优先级", () => {
  const contract = readFileSync(
    new URL("./hg_table_contract.js", import.meta.url),
    "utf8"
  );
  assert.match(contract, /@typedef \{Object\} HGTableColumn/);
  assert.match(contract, /\[align=undefined\]/);
  assert.match(contract, /优先级高于表格级 align/);
  assert.match(
    contract,
    /export function hgTableColumns\(columns\)/
  );
});

test("自然行高的内容在被图片撑高的单元格中保持竖直居中", () => {
  const css = readFileSync(new URL("./hg_table.module.css", import.meta.url), "utf8"); // Node 无布局引擎，检查实际样式规则。
  assert.match(css, /\.autoHeightCell\s*\{[^}]*align-items:\s*center;/);
});

test("斑马纹按数据行索引交替，滚动复用和 section 模式不依赖池位置", () => {
  const records = Array.from({ length: 20 }, (_, id) => ({ id })); // 多于复用池的数据，用于核对非零滚动偏移。
  const columns = [{ title: "编号", dataIndex: "id" }]; // 三种表体共用同一列配置。
  const getRowClass = (row) => new row.type(row.props).render().props.className; // 读取真实 VirtualRow 的可观察样式类。

  const auto = new HGTablePage({ columns, dataSource: records.slice(0, 3) });
  const autoRows = auto.renderAutoRowHeightBody().props.children.props.children;
  assert.equal(getRowClass(autoRows[0]).includes("stripedRow"), false);
  assert.equal(getRowClass(autoRows[1]).includes("stripedRow"), true);
  assert.equal(getRowClass(autoRows[2]).includes("stripedRow"), false);
  assert.equal(auto.renderHeader().props.children.props.className.includes("stripedRow"), false);

  const fixed = new HGTablePage({ columns, dataSource: records, scroll: { y: 48 }, autoRowHeight: false });
  fixed.state.offset = 5;
  const fixedPool = fixed.renderBody().props.children.props.children;
  assert.equal(getRowClass(fixedPool[0].props.children).includes("stripedRow"), true);
  assert.equal(getRowClass(fixedPool[1].props.children).includes("stripedRow"), false);

  const section = new HGTablePage({ columns, sections: [{ data: records.slice(0, 2) }] });
  const sectionPool = section.renderSectionBody().props.children[2].props.children;
  assert.equal(getRowClass(sectionPool[0].props.children).includes("stripedRow"), false);
  assert.equal(getRowClass(sectionPool[1].props.children).includes("stripedRow"), true);
});

test("自定义斑马纹分组让父子行共用底色，未配置时仍按真实行号交替", () => {
  const records = [
    { id: 1, group: 0 }, { id: 2, group: 0 },
    { id: 3, group: 1 }, { id: 4, group: 1 },
  ]; // 根节点及其子节点共享组序号，不随展开后的行号变化。
  const table = new HGTablePage({
    columns: [{ title: "编号", dataIndex: "id" }],
    dataSource: records,
    getRowStripeIndex: (record) => record.group,
  });
  const getStriped = (row) => new row.type(row.props).render().props.className.includes("stripedRow"); // 核对最终行类名。
  const autoRows = table.renderAutoRowHeightBody().props.children.props.children;
  assert.deepEqual(autoRows.map(getStriped), [false, false, true, true]);

  table.props = { ...table.props, autoRowHeight: false };
  const fixedRows = table.renderBody().props.children.props.children.map((pool) => pool.props.children);
  assert.deepEqual(fixedRows.map(getStriped), [false, false, true, true]);

  table.props = { ...table.props, sections: [{ data: records }] };
  const sectionRows = table.renderSectionBody().props.children[2].props.children.map((pool) => pool.props.children);
  assert.deepEqual(sectionRows.map(getStriped), [false, false, true, true]);

  table.props = { ...table.props, sections: undefined, getRowStripeIndex: undefined };
  assert.deepEqual(table.renderAutoRowHeightBody().props.children.props.children.map(getStriped), [false, true, false, true]);
});

test("行悬浮变色默认开启，可关闭且不覆盖原有斑马纹", () => {
  const table = new HGTablePage({ columns: [{ title: "编号", dataIndex: "id" }], dataSource: [{ id: 1 }, { id: 2 }] });
  assert.equal(table.render().props.className.includes("hoverRows"), true);
  table.props = { ...table.props, rowHover: false };
  assert.equal(table.render().props.className.includes("hoverRows"), false);
  const css = readFileSync(new URL("./hg_table.module.css", import.meta.url), "utf8"); // 无浏览器布局时核对 hover 规则只在启用状态生效。
  assert.match(css, /\.hoverRows\s+\.dataRow:hover:not\(\.selectedRow\)/);
  assert.match(css, /\.hoverRows\s+\.poolRow:hover\s+\.dataRow:not\(\.selectedRow\)/);
  assert.doesNotMatch(css, /^\s*\.dataRow:hover/m);
});

test("混合列空态使用 border-box 列宽，不重复加内边距", () => {
  const table = new HGTablePage({ columns: [{ title: "类目 ID", width: 220 }, { title: "展开/收起" }], dataSource: [] });
  assert.equal(table.getTotalColumnsWidth(), 340);
  assert.equal(table.renderHeader().props.children.props.style.minWidth, 340);
  assert.equal(table.renderAutoRowHeightBody().props.children.props.style.minWidth, 340);
});

test("行尾按钮不增加列，表头和表体同步预留操作宽度", () => {
  const record = { categoryId: "parent" };
  const leaf = { categoryId: "leaf" }; // 无按钮的行仍需保留相同的末列宽度。
  const action = "展开"; // 文本节点用于检查行级传递，不依赖 DOM。
  const table = new HGTablePage({
    columns: [{ title: "类目 ID", dataIndex: "categoryId", width: 220 }, { title: "操作", minWidth: 170 }],
    dataSource: [record, leaf],
    renderRowAction: (row) => row === record ? action : null,
  });
  assert.equal(table.getTotalColumnsWidth(), 458);
  const header = table.renderHeader().props.children;
  assert.equal(header.props.style.minWidth, 458);
  assert.deepEqual(header.props.children.map((cell) => cell.props.style.flex), ["0 0 220px", "1 0 0"]);
  const body = table.renderAutoRowHeightBody();
  assert.equal(body.props.children.props.style.minWidth, 458);
  const [row, leafRow] = body.props.children.props.children;
  assert.equal(row.props.rowAction, action);
  const renderedRow = new row.type(row.props).render();
  assert.deepEqual(renderedRow.props.children[0].map((cell) => cell.props.style.flex), ["0 0 220px", "1 0 0"]);
  assert.equal(renderedRow.props.children[1].props.children, action);
  assert.equal(leafRow.props.rowAction, null);
  const leafClass = new leafRow.type(leafRow.props).render().props.className;
  assert.equal(leafClass.includes("actionRow"), true, "叶子行仍保留与父行一致的操作区占位");
  assert.equal(leafClass.includes("stripedRow"), true, "相邻行允许按数据索引使用不同底色");
  assert.equal(table.getColumns().length, 2);
});

test("表头、三种表体模式与空态都可按住纵向拖动，不影响分页", () => {
  const table = new HGTablePage({ columns: [{ title: "列" }], dataSource: [{ id: 1 }], sections: [{ data: [{ id: 1 }] }] });
  for (const render of [table.renderBody, table.renderAutoRowHeightBody, table.renderSectionBody]) {
    for (const dataSource of [[{ id: 1 }], []]) {
      table.props = { ...table.props, dataSource, sections: dataSource.length ? [{ data: dataSource }] : [] };
      const body = render();
      assert.equal(body.props.onPointerDown, table.hgOnPointerDown);
      assert.equal(body.props.onPointerMove, table.hgOnPointerMove);
      assert.equal(body.props.onDragStart, table.hgOnDragStart);
      assert.equal(body.props.onClickCapture, table.hgOnClickCapture);
    }
  }
  assert.equal(table.renderHeader().props.onPointerDown, table.hgOnPointerDown);
});

test("已对齐时不重复写入，脚本滚动回传不会形成循环", () => {
  const source = createScrollElement({ scrollLeft: 200, scrollWidth: 1200, clientWidth: 500 });
  let writes = 0;
  let left = 0;
  const target = {
    scrollWidth: 1200, clientWidth: 500,
    get scrollLeft() { return left; },
    set scrollLeft(value) { writes++; left = value; },
  };
  syncHorizontalScroll(source, target);
  syncHorizontalScroll(target, source);
  syncHorizontalScroll(source, target);
  assert.equal(writes, 1);
});

test("尺寸监听补偿纵向滚动条，右端回传不拉回表体且卸载清理监听", (t) => {
  let callback;
  let observed;
  let disconnects = 0;
  const previousObserver = Object.getOwnPropertyDescriptor(globalThis, "ResizeObserver");
  t.after(() => {
    if (previousObserver) Object.defineProperty(globalThis, "ResizeObserver", previousObserver);
    else delete globalThis.ResizeObserver;
  });
  globalThis.ResizeObserver = class {
    constructor(onResize) { this.onResize = onResize; }
    observe(node) {
      // 表格还会创建容器观察器；仅保存表体观察器的回调用于本用例的宽度变化。
      if (node === body) { callback = this.onResize; observed = node; }
    }
    disconnect() { disconnects++; }
  };
  const table = new HGTablePage({ dataSource: [] });
  const body = table.scrollRef.current = createScrollElement({ scrollLeft: 717, scrollWidth: 1200, clientWidth: 483 });
  const header = table.headerRef.current = createScrollElement({ scrollWidth: 1200, clientWidth: 500 });
  // 模拟浏览器应用表头宽度后重新计算 clientWidth，而非让测试替身忽略 CSS 校准。
  Object.defineProperty(header, "clientWidth", { get: () => Number.parseFloat(header.style.width) || 500 });
  table.componentDidMount();
  assert.equal(observed, body);
  assert.equal(header.scrollLeft, 717);
  table.handleHeaderScroll({ target: header, currentTarget: header });
  assert.equal(body.scrollLeft, 717);
  body.clientWidth = 500;
  body.scrollLeft = 700;
  callback();
  assert.equal(header.style.width, "500px");
  assert.equal(header.scrollLeft, 700);
  const disconnectsBeforeUnmount = disconnects; // 绑定监听时也会 disconnect；这里只核对卸载清理的两次调用。
  table.componentWillUnmount();
  assert.equal(disconnects - disconnectsBeforeUnmount, 2);
});

test("表体最大横滚范围更大时，表头位置会被钳制到自身最大值", () => {
  const body = createScrollElement({ scrollLeft: 1200, scrollWidth: 2000, clientWidth: 800 });
  const header = createScrollElement({ scrollWidth: 2000, clientWidth: 816 });

  const nextScrollLeft = syncHorizontalScroll(body, header);

  assert.equal(nextScrollLeft, 1184);
  assert.equal(header.scrollLeft, 1184);
  assert.equal(body.scrollLeft, 1200);
});

test("表头滚动时，表体使用相同的有效横向位置", () => {
  const header = createScrollElement({ scrollLeft: 420, scrollWidth: 2000, clientWidth: 816 });
  const body = createScrollElement({ scrollWidth: 2000, clientWidth: 800 });

  syncHorizontalScroll(header, body);

  assert.equal(body.scrollLeft, 420);
});

test("没有横向溢出时不会写入负数位置", () => {
  const source = createScrollElement({ scrollLeft: 30, scrollWidth: 600, clientWidth: 800 });
  const target = createScrollElement({ scrollLeft: 10, scrollWidth: 600, clientWidth: 800 });

  const nextScrollLeft = syncHorizontalScroll(source, target);

  assert.equal(nextScrollLeft, 0);
  assert.equal(target.scrollLeft, 0);
});

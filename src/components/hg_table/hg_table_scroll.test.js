import test from "node:test";
import assert from "node:assert/strict";
import { syncHorizontalScroll } from "./hg_table_scroll.js";
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
  if (name.endsWith(".css")) return new Proxy({}, { get: (_, key) => key });
  if (name === "./hg_table_scroll.js") return { syncHorizontalScroll };
  return hgRequire(name);
}, hgModule, hgModule.exports);
const HGTablePage = hgModule.exports.default;

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
    assert.equal(empty.props.children.props.style.minWidth, 932);
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
    constructor(onResize) { callback = onResize; }
    observe(node) { observed = node; }
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
  table.componentWillUnmount();
  assert.equal(disconnects, 2);
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

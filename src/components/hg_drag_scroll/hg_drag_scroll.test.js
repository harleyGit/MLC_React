import assert from "node:assert/strict";
import test from "node:test";
import { hgStartDrag, hgMoveDrag, hgScrollDragChain } from "./hg_drag_scroll.js";

/** 使用会钳制 scrollTop 的本地节点替身，模拟真实浏览器的边界行为。 */
function scrollNode(max, top = 0, parentElement = null) {
  let position = top; // 节点当前滚动距离（px），始终处于 0 到 max 之间。
  return {
    parentElement, scrollHeight: max + 100, clientHeight: 100,
    get scrollTop() { return position; },
    set scrollTop(value) { position = Math.max(0, Math.min(max, value)); },
  };
}

test("拖动先滚动列表，超出边界的余量继续滚动页面；反向亦然", () => {
  const page = scrollNode(1000, 120);
  const body = scrollNode(200, 170, page);
  const doc = { scrollingElement: page, defaultView: { getComputedStyle: () => ({ overflowY: "auto" }) } };
  page.ownerDocument = body.ownerDocument = doc;
  assert.equal(hgScrollDragChain(body, 80), 0);
  assert.equal(body.scrollTop, 200);
  assert.equal(page.scrollTop, 170);
  assert.equal(hgScrollDragChain(body, -250), 0);
  assert.equal(body.scrollTop, 0);
  assert.equal(page.scrollTop, 120);
});

test("点击、表单和触摸不被接管，鼠标超过阈值才拖动", () => {
  const page = scrollNode(500);
  const body = scrollNode(200, 100, page);
  const doc = { scrollingElement: page, defaultView: { getComputedStyle: () => ({ overflowY: "auto" }) } };
  page.ownerDocument = body.ownerDocument = doc;
  const target = { closest: () => null };
  const base = { pointerType: "mouse", button: 0, pointerId: 3, clientX: 50, clientY: 100, target, currentTarget: body };
  assert.equal(hgStartDrag({ ...base, pointerType: "touch" }), null);
  assert.equal(hgStartDrag({ ...base, target: { closest: () => ({ tagName: "BUTTON" }) } }), null);
  const drag = hgStartDrag(base);
  let prevented = 0;
  let captured = 0;
  body.setPointerCapture = () => { captured += 1; };
  const move = (clientY) => hgMoveDrag({ ...base, clientY, preventDefault: () => { prevented += 1; } }, drag);
  assert.equal(move(98), false);
  assert.equal(body.scrollTop, 100);
  assert.equal(move(80), true);
  assert.equal(move(60), true);
  assert.equal(body.scrollTop, 140);
  assert.equal(captured, 1);
  assert.equal(prevented, 2);
});

test("横向或斜向框选文字不滚动，手势锁定后纵向移动也不接管", () => {
  const body = scrollNode(200, 100);
  body.ownerDocument = { getSelection: () => null };
  const base = {
    pointerType: "mouse", button: 0, pointerId: 4, clientX: 40, clientY: 100,
    target: { closest: () => null }, currentTarget: body, preventDefault: () => assert.fail("框选文字不应被阻止"),
  };
  const drag = hgStartDrag(base);
  assert.equal(hgMoveDrag({ ...base, clientX: 70, clientY: 88 }, drag), false);
  assert.equal(hgMoveDrag({ ...base, clientX: 70, clientY: 30 }, drag), false);
  assert.equal(body.scrollTop, 100);
});

test("按下后产生原生文字选择时不滚动", () => {
  const body = scrollNode(200, 100);
  const text = {}; // 选择区锚点使用稳定对象模拟同一个文本节点。
  let selection = null;
  body.ownerDocument = { getSelection: () => selection };
  const base = {
    pointerType: "mouse", button: 0, pointerId: 5, clientX: 40, clientY: 100,
    target: { closest: () => null }, currentTarget: body, preventDefault: () => assert.fail("复制文字不应被阻止"),
  };
  const drag = hgStartDrag(base);
  selection = { isCollapsed: false, anchorNode: text, anchorOffset: 0, focusNode: text, focusOffset: 8 };
  assert.equal(hgMoveDrag({ ...base, clientX: 42, clientY: 70 }, drag), false);
  assert.equal(body.scrollTop, 100);
});

test("从文字像素上按下时直接保留浏览器框选能力", () => {
  const body = scrollNode(200, 100);
  const text = { nodeType: 3, data: "多行文字" };
  body.ownerDocument = {
    caretPositionFromPoint: () => ({ offsetNode: text, offset: 1 }),
    createRange: () => ({
      setStart: () => {}, setEnd: () => {},
      getClientRects: () => [{ left: 10, right: 30, top: 20, bottom: 40 }],
    }),
  };
  const drag = hgStartDrag({
    pointerType: "mouse", button: 0, pointerId: 6, clientX: 20, clientY: 30,
    target: { closest: () => null }, currentTarget: body,
  });
  assert.equal(drag, null);
  assert.equal(body.scrollTop, 100);
});

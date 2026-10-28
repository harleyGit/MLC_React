const HG_DRAG_THRESHOLD = 5; // 鼠标移动超过 5px 才视为拖动，保留普通点击。

/** 鼠标按住表体或卡片时记录起点；触摸交给浏览器原生滚动处理。 */
export function hgStartDrag(event) {
  if (event.pointerType !== "mouse" || event.button !== 0 ||
    event.target.closest?.("button, input, select, textarea, [contenteditable]") ||
    event.currentTarget.closest?.("[contenteditable]")) return null;
  return { id: event.pointerId, startY: event.clientY, lastY: event.clientY, dragged: false };
}

/** 优先滚动当前视口；到边界后把剩余距离交给可滚动祖先（包括整个页面）。 */
export function hgScrollDragChain(node, distance) {
  let remaining = distance; // 尚未被任何滚动容器消耗的纵向距离，正值表示向下滚动。
  const doc = node.ownerDocument;
  for (let current = node; current && remaining; current = current.parentElement) {
    const root = current === doc?.scrollingElement;
    if (current !== node && !root &&
      !/^(auto|scroll)$/.test(doc.defaultView?.getComputedStyle(current).overflowY ?? "")) continue;
    const before = current.scrollTop;
    const max = Math.max(0, current.scrollHeight - current.clientHeight);
    current.scrollTop = Math.max(0, Math.min(max, before + remaining));
    remaining -= current.scrollTop - before;
    if (root) break;
  }
  return remaining;
}

/** 手势超过阈值后抑制文字选择，并让指针离开表体仍可继续拖动。 */
export function hgMoveDrag(event, drag) {
  if (!drag || event.pointerId !== drag.id) return false;
  if (!drag.dragged && Math.abs(event.clientY - drag.startY) < HG_DRAG_THRESHOLD) return false;
  if (!drag.dragged) {
    drag.dragged = true;
    event.currentTarget.setPointerCapture?.(drag.id);
  }
  event.preventDefault();
  hgScrollDragChain(event.currentTarget, drag.lastY - event.clientY);
  drag.lastY = event.clientY;
  return true;
}

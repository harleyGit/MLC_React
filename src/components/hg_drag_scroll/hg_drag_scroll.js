const HG_DRAG_THRESHOLD = 5; // 鼠标移动超过 5px 才视为拖动，保留普通点击。
const HG_VERTICAL_INTENT_RATIO = 1.5; // 纵向位移至少为横向的 1.5 倍才接管手势，避免框选文字时误滚动。

/** 记录原生选择区边界；只比较本次按下后是否产生或改变了文字选择。 */
function hgSelectionSnapshot(node) {
  const selection = node?.ownerDocument?.getSelection?.();
  if (!selection || selection.isCollapsed) return null;
  return {
    anchorNode: selection.anchorNode,
    anchorOffset: selection.anchorOffset,
    focusNode: selection.focusNode,
    focusOffset: selection.focusOffset,
  };
}

/** 新产生的非折叠选择区表示用户正在复制文字，本次手势不再允许切换为滚动。 */
function hgSelectionChanged(node, initialSelection) {
  const current = hgSelectionSnapshot(node);
  if (!current) return false;
  if (!initialSelection) return true;
  return current.anchorNode !== initialSelection.anchorNode ||
    current.anchorOffset !== initialSelection.anchorOffset ||
    current.focusNode !== initialSelection.focusNode ||
    current.focusOffset !== initialSelection.focusOffset;
}

/** 命中文字像素时优先交给浏览器框选；单元格留白仍可发起纵向拖动。 */
function hgPointerStartsOnText(event) {
  const doc = event.currentTarget?.ownerDocument;
  if (!doc || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return false;
  const caret = doc.caretPositionFromPoint?.(event.clientX, event.clientY);
  const fallbackRange = caret ? null : doc.caretRangeFromPoint?.(event.clientX, event.clientY);
  const textNode = caret?.offsetNode ?? fallbackRange?.startContainer;
  const offset = caret?.offset ?? fallbackRange?.startOffset;
  if (textNode?.nodeType !== 3 || !textNode.data?.length || !Number.isInteger(offset)) return false;

  const characterOffset = Math.min(offset, textNode.data.length - 1);
  const range = doc.createRange?.();
  if (!range) return false;
  range.setStart(textNode, characterOffset);
  range.setEnd(textNode, characterOffset + 1);
  return Array.from(range.getClientRects()).some((rect) =>
    event.clientX >= rect.left && event.clientX <= rect.right &&
    event.clientY >= rect.top && event.clientY <= rect.bottom);
}

/** 鼠标按住表体或卡片时记录起点；触摸交给浏览器原生滚动处理。 */
export function hgStartDrag(event) {
  if (event.pointerType !== "mouse" || event.button !== 0 ||
    event.target.closest?.("button, input, select, textarea, [contenteditable]") ||
    event.currentTarget.closest?.("[contenteditable]") || hgPointerStartsOnText(event)) return null;
  return {
    id: event.pointerId,
    startX: Number.isFinite(event.clientX) ? event.clientX : 0,
    startY: event.clientY,
    lastY: event.clientY,
    dragged: false,
    blocked: false,
    initialSelection: hgSelectionSnapshot(event.currentTarget),
  };
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
  if (!drag || drag.blocked || event.pointerId !== drag.id) return false;
  if (!drag.dragged && hgSelectionChanged(event.currentTarget, drag.initialSelection)) {
    drag.blocked = true;
    return false;
  }
  const currentX = Number.isFinite(event.clientX) ? event.clientX : drag.startX;
  const deltaX = Math.abs(currentX - drag.startX);
  const deltaY = Math.abs(event.clientY - drag.startY);
  if (!drag.dragged && deltaX < HG_DRAG_THRESHOLD && deltaY < HG_DRAG_THRESHOLD) return false;
  if (!drag.dragged && (deltaY < HG_DRAG_THRESHOLD || deltaY < deltaX * HG_VERTICAL_INTENT_RATIO)) {
    drag.blocked = true;
    return false;
  }
  if (!drag.dragged) {
    drag.dragged = true;
    event.currentTarget.setPointerCapture?.(drag.id);
  }
  event.preventDefault();
  hgScrollDragChain(event.currentTarget, drag.lastY - event.clientY);
  drag.lastY = event.clientY;
  return true;
}

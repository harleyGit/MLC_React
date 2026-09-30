/**
 * 将一个横向滚动容器的位置同步到另一个容器。
 * 目标容器可能因纵向滚动条导致最大 scrollLeft 更小，因此必须钳制目标值。
 */
export function syncHorizontalScroll(source, target) {
  if (!source || !target) return null;

  const targetMaxScrollLeft = Math.max(0, target.scrollWidth - target.clientWidth);
  const nextScrollLeft = Math.min(Math.max(0, source.scrollLeft), targetMaxScrollLeft);
  if (target.scrollLeft !== nextScrollLeft) {
    target.scrollLeft = nextScrollLeft;
  }
  return nextScrollLeft;
}

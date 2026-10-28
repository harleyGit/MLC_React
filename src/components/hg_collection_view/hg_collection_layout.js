/** 未测量的 cell 先按估算高度占位，实际高度由 DOM 测量后覆盖。 */
export const HG_COLLECTION_ESTIMATED_HEIGHT = 156;

/** 构建变高 cell 的累计偏移；高度包含 cell 间距。 */
export function hgCollectionOffsets(items, getKey, heights) {
  const offsets = [0];
  items.forEach((item, index) => {
    const height = heights.get(getKey(item, index)) ?? HG_COLLECTION_ESTIMATED_HEIGHT;
    offsets.push(offsets[index] + height);
  });
  return offsets;
}

/** 二分定位包含指定滚动位置的 cell，供上下双向滚动使用。 */
export function hgCollectionStart(offsets, position) {
  if (offsets.length <= 1) return 0;
  let low = 0;
  let high = offsets.length - 1;
  while (low < high) {
    const middle = (low + high + 1) >>> 1;
    if (offsets[middle] <= position) low = middle;
    else high = middle - 1;
  }
  return Math.min(low, offsets.length - 2);
}

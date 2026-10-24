/** 前端仅保留最近 64 页返回位置，超长目录不会无限增长浏览器状态。 */
export const HGMaxMallBackPages = 64;

/** 向后翻页时维护有界历史；base 表示已丢弃的早期页面数，供页码展示。 */
export function HGAdvanceMallPage(hgHistory, hgBase, hgCursor) {
  const hgNext = [...hgHistory, hgCursor]; // 包含第一页空游标；每次前进只增加一个返回位置。
  if (hgNext.length <= HGMaxMallBackPages) return { history: hgNext, base: hgBase };
  return { history: hgNext.slice(-HGMaxMallBackPages), base: hgBase + 1 };
}

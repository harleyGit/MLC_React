/**
 * 实物订单列表的游标分页换算。
 * 约束：后端只返回 cursor / hasMore / nextCursor，没有总数也不支持自定义页大小，
 *      客户端选择的每页条数只影响已获取记录的展示，不改变服务端游标或请求页长。
 *      下方历史分页换算函数供仍使用固定页长的调用方保留。
 */

/** 服务端实物订单每次查询固定上限 20 条；展示分页可选其他条数。 */
export const HG_MALL_ORDER_PAGE_SIZE = 20;

/**
 * 取指定页码的服务端游标。
 * @param {string[]} hgCursors 已探索页的游标历史，索引 i 对应第 i+1 页。
 * @param {number} hgPage 目标页码，从 1 起。
 * @returns {string} 该页的服务端原始游标；页码超出已探索范围时退回末页游标。
 */
export function hgOrderCursorAt(hgCursors, hgPage) {
  return hgCursors[hgPage - 1] ?? hgCursors.at(-1) ?? "";
}

/**
 * 记录已探索页的游标，供分页器回翻。
 * @param {string[]} hgCursors 已有游标历史，索引 i 对应第 i+1 页。
 * @param {number} hgPage 本次加载的页码，从 1 起。
 * @param {string} hgNextCursor 下一页游标；空字符串表示已到末页。
 * @returns {string[]} 新的游标历史，长度至少覆盖当前页且丢弃更深的旧游标。
 */
export function hgOrderPushCursor(hgCursors, hgPage, hgNextCursor) {
  const hgKnown = hgCursors.slice(0, hgPage);
  if (hgNextCursor) hgKnown[hgPage] = hgNextCursor;
  return hgKnown;
}

/**
 * 换算分页器需要的条数。
 * @param {number} hgPage 当前页码，从 1 起。
 * @param {number} hgCount 当前页条数。
 * @param {boolean} hgHasMore 是否还有下一页。
 * @returns {number} 已到末页时为精确条数；否则多算一条以保持“下一页”可点。
 */
export function hgOrderTotalCount(hgPage, hgCount, hgHasMore) {
  return (hgPage - 1) * HG_MALL_ORDER_PAGE_SIZE + hgCount + (hgHasMore ? 1 : 0);
}

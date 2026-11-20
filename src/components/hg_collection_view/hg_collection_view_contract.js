/**
 * @typedef {'left'|'center'|'right'} HGCollectionAlign
 * CollectionView cell 支持的水平对齐枚举。
 */

/**
 * @typedef {Object} HGCollectionPagination
 * @property {number} current 当前页码，从 1 开始，无组件内默认值。
 * @property {number} pageSize 每页条数，无组件内默认值。
 * @property {number} loadedCount 当前已加载记录数，无组件内默认值。
 * @property {boolean} hasMore 服务端是否仍有后续数据，无组件内默认值。
 */

/** 分页对象字段说明入口；null 表示调用方必须提供，组件不会猜测业务值。 */
export const HG_COLLECTION_PAGINATION_DEFAULTS = Object.freeze({
  current: null,
  pageSize: null,
  loadedCount: null,
  hasMore: null,
});

/** CollectionView 允许的对齐值。 */
export const HG_COLLECTION_ALIGN_VALUES = Object.freeze([
  "left",
  "center",
  "right",
]);

/**
 * 为 JavaScript 页面提供可跳转、可补全的分页配置入口；不修改调用方对象。
 * @param {HGCollectionPagination} pagination 受控分页配置。
 * @returns {HGCollectionPagination} 原始分页配置。
 */
export function hgCollectionPagination(pagination) {
  return pagination;
}

/**
 * 归一化 cell 对齐值。
 * @param {unknown} align 调用方输入。
 * @returns {HGCollectionAlign} 合法对齐值，非法值回落到 center。
 */
export function hgNormalizeCollectionAlign(align) {
  return HG_COLLECTION_ALIGN_VALUES.includes(align) ? align : "center";
}

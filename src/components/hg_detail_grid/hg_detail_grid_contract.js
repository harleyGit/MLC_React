/**
 * @typedef {Object} HGDetailGridItem
 * @property {string} label 字段标题，必传，同时作为默认 React key。
 * @property {import("react").ReactNode} [value="-"] 字段值；undefined、null 或空字符串显示“-”。
 */

/** 单个详情字段配置的运行时默认值。 */
export const HG_DETAIL_GRID_ITEM_DEFAULTS = Object.freeze({
  value: "-",
});

/**
 * 为 JavaScript 页面提供可跳转、可补全的详情字段配置入口。
 * @param {HGDetailGridItem[]} items 详情字段配置。
 * @returns {HGDetailGridItem[]} 原始配置数组。
 */
export function hgDetailGridItems(items) {
  return items;
}

/**
 * @typedef {Object} HGStatCardItem
 * @property {string} label 指标标题，必传，同时作为默认 React key。
 * @property {import("react").ReactNode} [value="-"] 指标值；空值显示“-”。
 * @property {import("react").ReactNode} [suffix=undefined] 值后的单位或补充文本；缺省不渲染。
 * @property {'blue'|'green'|'orange'|'purple'|'gray'} [tone="blue"] 配色档位；非法值回落到 blue。
 * @property {import("react").ReactNode} [icon=undefined] 指标图标；缺省不占位。
 */

/** 单个统计卡片配置的运行时默认值。 */
export const HG_STAT_CARD_ITEM_DEFAULTS = Object.freeze({
  value: "-",
  suffix: undefined,
  tone: "blue",
  icon: undefined,
});

/**
 * 为 JavaScript 页面提供可跳转、可补全的统计项配置入口。
 * @param {HGStatCardItem[]} items 统计项配置。
 * @returns {HGStatCardItem[]} 原始配置数组。
 */
export function hgStatCardItems(items) {
  return items;
}

/**
 * @typedef {'left'|'center'|'right'} HGTableAlign
 * 表格支持的水平对齐枚举；非法值统一回落到 center。
 */

/**
 * @template [RecordType=Object]
 * @typedef {Object} HGTableColumn
 * @property {import("react").Key} [key=undefined] 列稳定标识；缺省依次使用 dataIndex 或 title。
 * @property {import("react").ReactNode} [title=undefined] 表头内容；缺省不显示标题文字。
 * @property {string} [dataIndex=undefined] 从记录读取单元格值的字段名；缺省仅由 render 使用整条记录。
 * @property {number} [width=undefined] 固定列宽，单位 px；缺省时参与剩余宽度平分。
 * @property {number} [minWidth=0] 弹性列最小宽度，单位 px。
 * @property {HGTableAlign} [align=undefined] 当前列标题与内容对齐；优先级高于表格级 align。
 * @property {HGTableAlign} [titleAlign=undefined] 仅覆盖当前列表头对齐；优先级高于当前列 align。
 * @property {(value: any, record: RecordType, index: number) => import("react").ReactNode} [render=undefined] 自定义单元格；缺省直接展示 record[dataIndex]。
 */

/**
 * @typedef {Object} HGTablePagination
 * @property {number} [current=1] 当前页码。
 * @property {number} [pageSize=10] 每页条数。
 * @property {number} [total=0] 供分页器计算页数的记录数。
 * @property {boolean} [showSizeChanger=false] 是否显示每页条数选择。
 * @property {boolean} [showQuickJumper=false] 是否显示页码跳转输入。
 */

/** columns 单项运行时默认值；点击各字段可同时查看默认值与用途。 */
export const HG_TABLE_COLUMN_DEFAULTS = Object.freeze({
  key: undefined,
  title: undefined,
  dataIndex: undefined,
  width: undefined,
  minWidth: 0,
  align: undefined,
  titleAlign: undefined,
  render: undefined,
});

/** pagination 运行时默认值；页面可以只覆盖需要的分页字段。 */
export const HG_TABLE_PAGINATION_DEFAULTS = Object.freeze({
  current: 1,
  pageSize: 10,
  total: 0,
  showSizeChanger: false,
  showQuickJumper: false,
});

/** 表格允许的对齐值，供运行时校验与编辑器跳转查看。 */
export const HG_TABLE_ALIGN_VALUES = Object.freeze([
  "left",
  "center",
  "right",
]);

/**
 * 为 JavaScript 页面提供可跳转、可补全的 columns 配置入口；不复制或修改调用方数组。
 * @template [RecordType=Object]
 * @param {Array<HGTableColumn<RecordType>>} columns 表格列配置。
 * @returns {Array<HGTableColumn<RecordType>>} 原始配置数组。
 */
export function hgTableColumns(columns) {
  return columns;
}

/**
 * 归一化表格对齐值。
 * @param {unknown} align 调用方输入。
 * @param {HGTableAlign} [fallback="center"] 非法或缺省值的回退对齐。
 * @returns {HGTableAlign} 可安全用于样式的对齐值。
 */
export function hgNormalizeTableAlign(align, fallback = "center") {
  return HG_TABLE_ALIGN_VALUES.includes(align) ? align : fallback;
}

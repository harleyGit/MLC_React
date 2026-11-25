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
 * @property {HGTableAlign} [align=undefined] 当前列标题与内容对齐；优先级高于表格级 align；缺省继承表格 align（表格默认 center）。
 * @property {HGTableAlign} [titleAlign=undefined] 仅覆盖当前列表头对齐；缺省沿用列 align，再回退表格 align。
 * @property {(value: any, record: RecordType, index: number) => import("react").ReactNode} [render=undefined] 自定义单元格；参数依次为当前字段值、整行记录及行索引，缺省直接展示 record[dataIndex]。
 */

/**
 * @typedef {Object} HGTablePagination
 * @property {number} [current=1] 当前页码。
 * @property {number} [pageSize=10] 每页条数。
 * @property {number} [total=0] 供分页器计算页数的记录数。
 * @property {boolean} [showSizeChanger=false] 是否显示每页条数选择。
 * @property {boolean} [showQuickJumper=false] 是否显示页码跳转输入。
 */

/**
 * @typedef {Object} HGTableSection
 * @property {Array<any>} [data=[]] 当前分组的数据行；空数组表示仅有表头或表尾。
 * @property {import("react").ReactNode|((section: HGTableSection, columns: Array<HGTableColumn>) => import("react").ReactNode)} [header=undefined] 分组头节点或渲染函数；缺省、null 或 false 不显示。
 * @property {import("react").ReactNode|((section: HGTableSection, columns: Array<HGTableColumn>) => import("react").ReactNode)} [footer=undefined] 分组尾节点或渲染函数；缺省、null 或 false 不显示。
 * @property {number} [headerHeight=40] 分组头高度，单位 px；0 回退 40。
 * @property {number} [footerHeight=32] 分组尾高度，单位 px；0 回退 32。
 */

/**
 * @typedef {Object} HGTableScroll
 * @property {number} [y=undefined] 表体高度上限，单位 px；设置后优先于 fillHeight。0 等同未设置。
 * @property {number} [x=undefined] 保留的横向配置字段；当前横向滚动范围由列宽自动计算，此字段不改变布局。
 */

/**
 * @typedef {Object} HGTableRowSelection
 * @property {'radio'|'checkbox'} [type="radio"] 单选或多选；缺省为单选。
 * @property {Array<import("react").Key>} [selectedRowKeys=[]] 外部受控的选中行 key；缺省无选中行。
 * @property {(keys: Array<import("react").Key>, rows: Array<any>) => void} [onChange=undefined] 选择变更回调；依次传新 key 与当前表格匹配的数据行，缺省不通知。
 */

/**
 * HGTablePage 的公开 JSX 属性；运行时默认值统一见 HGTablePage.defaultProps。
 * @typedef {Object} HGTableProps
 * @property {Array<HGTableColumn<any>>} [columns=[]] 业务列；每项字段见 HGTableColumn，空数组不显示业务列。
 * @property {Array<any>} [dataSource=[]] 普通数据行；传入 sections 数组时不使用此数据源。
 * @property {Array<HGTableSection>|undefined} [sections=undefined] 分组模式；数组（包括空数组）启用分组，缺省使用 dataSource。
 * @property {string|((record: any) => import("react").Key)|undefined} [rowKey=undefined] 稳定行标识字段或函数；缺省回退当前索引，动态列表应显式指定。
 * @property {boolean} [loading=false] 是否显示加载遮罩；默认不显示。
 * @property {false|HGTablePagination} [pagination=false] 默认不显示分页；传对象时由调用方维护 current/pageSize/total，字段见 HGTablePagination。
 * @property {((page: {current: number, pageSize: number, total: number}) => void)|undefined} [onChange=undefined] 分页变更回调，组件只通知不请求或切片；缺省不通知。
 * @property {number|string|undefined} [width=undefined] 表格整体宽度（px 或 CSS 长度）；缺省铺满父级。
 * @property {number|string|undefined} [height=undefined] 表格整体高度（px 或 CSS 长度），包含表头与分页；缺省按 fillHeight。
 * @property {HGTableScroll|undefined} [scroll=undefined] 表体滚动配置；scroll.y 优先约束表体，横向由列宽决定。
 * @property {boolean} [fillHeight=true] 默认填满父级可用区域；false 且没有 height/scroll.y 时随内容展开。
 * @property {boolean} [autoRowHeight=true] 默认内容可换行撑高；false 使用 48px 固定行高，sections 仍使用分组复用池。
 * @property {HGTableAlign} [align="center"] 所有列默认水平对齐；columns[].align 覆盖该列，titleAlign 只覆盖表头。
 * @property {boolean} [rowHover=true] 默认鼠标悬浮改变背景；false 保留原有斑马纹与选中态。
 * @property {HGTableRowSelection|undefined} [rowSelection=undefined] 受控行选择；缺省不显示选择列，字段见 HGTableRowSelection。
 * @property {((record: any, index: number) => import("react").ReactNode)|undefined} [renderRowAction=undefined] 行尾操作；缺省不预留区域，控件尺寸不超过 32px。
 * @property {((record: any, index: number) => number)|undefined} [getRowStripeIndex=undefined] 行斑马纹分组序号；缺省使用数据行索引。
 * @property {string} [className=""] 根容器附加类名；空字符串表示只用组件默认样式。
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
 * @example
 * const columns = hgTableColumns([
 *   { title: "管理员", dataIndex: "name", width: 220, align: "left" },
 *   { title: "操作", key: "actions", render: (_, record) => record.name },
 * ]);
 * // 传给 HGTablePage 的 columns；缺省列对齐继承表格 align，最后回退 center。
 */
export function hgTableColumns(columns) {
  return columns;
}

/**
 * 表格 JSX 属性的可跳转入口；传给 HGTablePage 时用 {...hgTableProps({ ... })}，不复制或补默认值。
 * @param {HGTableProps} props 表格公开属性，子配置可继续跳转至 HGTableColumn/HGTablePagination 等类型。
 * @returns {HGTableProps} 原始属性对象；运行时默认值仍由 HGTablePage.defaultProps 统一提供。
 */
export function hgTableProps(props) {
  return props;
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

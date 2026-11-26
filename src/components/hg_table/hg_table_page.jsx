import React from "react";
import styles from "./hg_table.module.css";
import { syncHorizontalScroll } from "./hg_table_scroll.js";
import { hgStartDrag, hgMoveDrag } from "../hg_drag_scroll/hg_drag_scroll.js";
import {
  HG_TABLE_COLUMN_DEFAULTS,
  HG_TABLE_PAGINATION_DEFAULTS,
  hgTableColumns,
  hgNormalizeTableAlign,
} from "./hg_table_contract.js";

/**
 * 默认行高（px）。
 */
const ROW_HEIGHT = 48;

/**
 * sectionHeader 默认高度（px）。
 */
const SECTION_HEADER_HEIGHT = 40;

/**
 * sectionFooter 默认高度（px）。
 */
const SECTION_FOOTER_HEIGHT = 32;

/**
 * 上下缓冲行数。
 */
const BUFFER_ROWS = 5;

/** 填充模式首次测量前的表体估算高度（px），不用于自然高度列表。 */
const FILL_BODY_ESTIMATE = 500;

/**
 * @typedef {'left'|'center'|'right'} HGTableAlign
 * 表格支持的水平对齐枚举；非法值统一回落到 center。
 */

/**
 * @typedef {Object} HGTableColumn
 * @property {React.Key} [key] 列的稳定标识；缺省依次使用 dataIndex 或 title。
 * @property {React.ReactNode} [title] 表头内容。
 * @property {string} [dataIndex] 当前列读取的记录字段。
 * @property {number} [width] 固定列宽（px）。
 * @property {number} [minWidth] 弹性列最小宽度（px）。
 * @property {HGTableAlign} [align] 当前列标题和内容的水平对齐；优先级高于 HGTablePage.align。
 * @property {HGTableAlign} [titleAlign] 仅覆盖当前列表头对齐；优先级高于当前列 align。
 * @property {(value: any, record: any, index: number) => React.ReactNode} [render] 当前列内容渲染函数。
 */

/**
 * 虚拟行类型枚举。
 * 职责：标识 flatten 后每行的渲染类型。
 */
const ROW_TYPE = {
  SECTION_HEADER: "sectionHeader",
  CELL: "cell",
  SECTION_FOOTER: "sectionFooter",
};

/**
 * 将 sections 数组 flatten 为虚拟行列表。
 * 职责：将多 section 数据展平为 [{type, sectionIndex, rowIndex?, height, ...}]，
 *       同时计算每行的累计偏移量，用于虚拟滚动定位。
 * @param {Array} sections - section 数组。
 * @returns {{ items: Array, totalHeight: number, sectionMetas: Array }} 展平后的行列表、总高度与 section 元数据。
 */
function flattenSections(sections) {
  const items = [];
  const sectionMetas = [];
  let cumulativeTop = 0;

  sections.forEach((section, sIdx) => {
    const headerHeight = section.headerHeight || SECTION_HEADER_HEIGHT;
    const footerHeight = section.footerHeight || SECTION_FOOTER_HEIGHT;
    const showHeader = section.header !== undefined && section.header !== null && section.header !== false;
    const showFooter = section.footer !== undefined && section.footer !== null && section.footer !== false;

    const sectionStart = cumulativeTop;
    let sectionEnd = cumulativeTop;
    let headerItem = null;

    if (showHeader) {
      headerItem = {
        type: ROW_TYPE.SECTION_HEADER,
        sectionIndex: sIdx,
        height: headerHeight,
        top: cumulativeTop,
        data: section,
      };
      items.push(headerItem);
      cumulativeTop += headerHeight;
    }

    const rows = section.data || [];
    rows.forEach((record, rIdx) => {
      items.push({
        type: ROW_TYPE.CELL,
        sectionIndex: sIdx,
        rowIndex: rIdx,
        height: ROW_HEIGHT,
        top: cumulativeTop,
        record,
        data: section,
      });
      cumulativeTop += ROW_HEIGHT;
    });

    if (showFooter) {
      items.push({
        type: ROW_TYPE.SECTION_FOOTER,
        sectionIndex: sIdx,
        height: footerHeight,
        top: cumulativeTop,
        data: section,
      });
      cumulativeTop += footerHeight;
    }

    sectionEnd = cumulativeTop;
    sectionMetas.push({
      index: sIdx,
      section,
      start: sectionStart,
      end: sectionEnd,
      headerHeight: showHeader ? headerHeight : 0,
      footerHeight: showFooter ? footerHeight : 0,
      hasHeader: showHeader,
      hasFooter: showFooter,
    });
  });

  return { items, totalHeight: cumulativeTop, sectionMetas };
}

/**
 * 二分查找：找到第一个 top + height > scrollTop 的 item 索引。
 * @param {Array} items - flatten 后的行列表。
 * @param {number} scrollTop - 当前滚动偏移。
 * @returns {number} 可见区域起始索引。
 */
function findStartIndex(items, scrollTop) {
  let lo = 0;
  let hi = items.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1;
    if (items[mid].top + items[mid].height <= scrollTop) {
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return Math.max(0, lo);
}

/** 表头和表体共用列宽规则；align 控制标题与内容，titleAlign 只覆盖标题。 */
function getColumnStyle(col, isHeader = false) {
  const widthStyle = col.width
    ? { width: col.width, flex: `0 0 ${col.width}px` }
    : { flex: "1 0 0", minWidth: col.minWidth ?? 0 }; // 未指定 width 时平分剩余空间。
  const requestedAlign = isHeader ? col.titleAlign ?? col.align : col.align; // 标题未单独配置时沿用列对齐方式。
  const align = hgNormalizeTableAlign(requestedAlign); // 缺省或非法值统一居中。
  return isHeader
    ? { ...widthStyle, textAlign: align }
    : { ...widthStyle, textAlign: align, justifyContent: { left: "flex-start", center: "center", right: "flex-end" }[align] };
}

/**
 * sectionHeader 行组件（PureComponent）。
 * 职责：渲染 section 头部区域。
 */
/**
 * @typedef {object} HGTableSectionProps
 * @property {Object|null} section 必传，无默认值；父表格提供的分组，null 表示该槽无内容。
 * @property {Array<any>} columns 必传，无默认值；传给分组 header/footer 渲染函数的列定义。
 */
/** @extends {React.PureComponent<HGTableSectionProps>} */
class VirtualSectionHeader extends React.PureComponent {
  render() {
    const { section, columns } = this.props;
    if (!section) return null;

    const header = section.header;
    if (typeof header === "function") {
      return <div className={styles.sectionHeader}>{header(section, columns)}</div>;
    }
    return <div className={styles.sectionHeader}>{header}</div>;
  }
}

/**
 * sectionFooter 行组件（PureComponent）。
 * 职责：渲染 section 尾部区域。
 */
/** @extends {React.PureComponent<HGTableSectionProps>} */
class VirtualSectionFooter extends React.PureComponent {
  render() {
    const { section, columns } = this.props;
    if (!section) return null;

    const footer = section.footer;
    if (typeof footer === "function") {
      return <div className={styles.sectionFooter}>{footer(section, columns)}</div>;
    }
    return <div className={styles.sectionFooter}>{footer}</div>;
  }
}

/**
 * 单行组件（PureComponent）。
 * 职责：渲染一行中所有单元格。以 poolIndex 为 key 实现 React 级 cell 复用。
 */
/**
 * @typedef {object} HGTableRowProps
 * @property {Array<any>} columns 必传，无默认值；父表格传入包含选择列的最终列定义。
 * @property {Object|null} record 必传，无默认值；null 表示复用池中的空槽。
 * @property {number} rowIndex 必传，无默认值；真实数据行号，从 0 开始。
 * @property {number} [stripeIndex] 默认使用 rowIndex；分组序号相同的行使用相同斑马纹。
 * @property {boolean} [autoRowHeight=false] 默认固定行高，true 允许内容换行撑高。
 * @property {boolean} [selected=false] 默认未选中，true 使用选中底色。
 * @property {Function} [onSelect] 默认 undefined 不响应行选择；传入后点击非交互内容可选中行。
 * @property {React.ReactNode} [rowAction] 默认 undefined 不渲染行尾操作。
 * @property {boolean} [reserveRowAction=false] 默认不预留行尾区域；父表格有操作列时统一开启。
 */
/** @extends {React.PureComponent<HGTableRowProps>} */
class VirtualRow extends React.PureComponent {
  render() {
    // stripeIndex 缺省为实际行号；分组时可由表格注入同一根节点的序号，让父子行共用背景色。
    // reserveRowAction 即使叶子行没有按钮，也保持与表头相同的末列宽度。
    const { columns, record, rowIndex, stripeIndex = rowIndex, autoRowHeight, selected, onSelect, rowAction, reserveRowAction } = this.props;
    if (!record) return <div className={styles.row} />;

    return (
      // autoRowHeight 开启时，行不再依赖固定 48px 高度，由单元格内容自然撑开。
      <div
        // 默认按实际行号交替；分组时按调用方提供的根节点序号着色，避免子行与父行颜色不同。
        className={`${styles.row} ${styles.dataRow} ${stripeIndex % 2 === 1 ? styles.stripedRow : ""} ${autoRowHeight ? styles.autoHeightRow : ""} ${selected ? styles.selectedRow : ""} ${onSelect ? styles.selectableRow : ""} ${reserveRowAction ? styles.actionRow : ""}`}
        onClick={onSelect ? (event) => {
          // 行内操作及选择控件自行处理点击，避免冒泡后再次切换选中状态。
          if (!event.target.closest("button, input, a, select, textarea, label")) {
            onSelect(record);
          }
        } : undefined}
      >
        {columns.map((col) => {
          const value = record[col.dataIndex];
          const rendered = col.render ? col.render(value, record, rowIndex) : value;
          return (
            <div
              key={col.key || col.dataIndex || col.title}
              // autoHeightCell 负责取消省略号和单行限制，让长字段按列宽换行完整展示。
              className={`${styles.cell} ${autoRowHeight ? styles.autoHeightCell : ""}`}
              style={getColumnStyle(col)}
            >
              {rendered}
            </div>
          );
        })}
        {rowAction && <span className={styles.rowAction}>{rowAction}</span>}
      </div>
    );
  }
}

/**
 * 自定义表格组件，替代 antd Table。
 *
 * iOS UITableView cell 复用原理实现：
 *   1. 创建固定数量的 VirtualRow（复用池），以 poolIndex 为 key 常驻内存；
 *   2. 滚动时通过 offset 计算每行应显示哪条数据，仅更新 VirtualRow 的 props；
 *   3. 超出数据范围的行传入 record=null，隐藏但保留 DOM（复用池）；
 *   4. 池大小 = 可见行数 + 缓冲行数，DOM 节点数恒定不随数据量增长。
 *
 * Section 支持：
 *   - sections prop：[{header?, footer?, data: [...], headerHeight?, footerHeight?}]
 *   - header/footer 可为 string 或 (section, columns) => ReactNode
 *   - header/footer 可选显示，不传则不渲染
 *   - 多 section 时自动 flatten 为 sectionHeader/cell/footer 混合虚拟列表
 *   - sectionHeader 吸顶：滚动时当前 section 的 header 固定在顶部
 *   - sectionFooter 吸底：滚动时当前 section 的 footer 固定在底部
 *
 * 输入：columns, dataSource, sections, rowKey, loading, pagination, onChange, width, height, scroll, fillHeight, align, rowSelection, renderRowAction, getRowStripeIndex, rowHover。
 * rowHover：数据行是否在鼠标悬浮时改变背景，默认 true；false 时保留原有背景及选中态。
 * getRowStripeIndex(record, rowIndex)：可选斑马纹分组序号，同组行共用底色；缺省使用数据行号。
 * align：全部列的默认水平对齐，left/center/right，默认 center。
 * columns[].align：覆盖当前列的标题与内容水平对齐；titleAlign 可继续单独覆盖标题。
 * renderRowAction(record, rowIndex)：可选行尾操作，控件不超过 32px；不占表格列，配置后统一预留行尾宽度。
 * rowSelection：{type: "radio" | "checkbox", selectedRowKeys: [], onChange(keys, rows)}；由调用方持有选择状态。
 * fillHeight 说明：默认开启；表格作为父级弹性布局的子项占满剩余高度，
 *                  表体高度由 ResizeObserver 实测（容器高度扣除表头与分页器）或弹性布局决定，
 *                  随窗口/父级高度动态变化；显式 height 约束表格整体，scroll.y 优先约束表体。
 * width/height 说明：数字单位为 px，也支持 CSS 长度；仅内容超过指定宽高后，表体才出现对应滚动。
 *
 * @example
 * // 全表左对齐，但“金额”列仍由 columns[].align 以最高优先级右对齐。
 * <HGTablePage
 *   align="left"
 *   columns={[
 *     { title: "角色", dataIndex: "name" },
 *     { title: "金额", dataIndex: "amount", align: "right" },
 *   ]}
 * />
 * @extends {React.Component<import("./hg_table_contract.js").HGTableProps>}
 */
class HGTablePage extends React.Component {
  /** JavaScript columns 配置辅助函数；点击可查看 columns[] 全部属性、默认值与作用。 */
  static configureColumns = hgTableColumns;

  /** columns[] 子属性默认值与用途的可跳转入口；业务配置可使用 hgTableColumns 获得编辑器提示。 */
  static columnDefaultProps = HG_TABLE_COLUMN_DEFAULTS;

  /** pagination 子属性默认值与用途的可跳转入口。 */
  static paginationDefaultProps = HG_TABLE_PAGINATION_DEFAULTS;

  /** 可选属性默认值；数据与选择状态始终由调用方拥有。 */
  static defaultProps = {
    /** 列定义，默认 [] 不显示业务列；使用 configureColumns/hgTableColumns 可跳转查看子属性。 @type {ReturnType<typeof hgTableColumns>} */
    columns: [],
    /** 普通表格行数据，默认 [] 展示空态；传 sections 时改用分组数据。 @type {Array<any>} */
    dataSource: [],
    /** 分组配置，默认 undefined 使用 dataSource；数组（含 []）启用分组，header/footer 可为节点或渲染函数。 @type {Array<{data?: Array<any>, header?: React.ReactNode|Function, footer?: React.ReactNode|Function, headerHeight?: number, footerHeight?: number}>|undefined} */
    sections: undefined,
    /** 行主键字段或函数，默认 undefined 回退索引；动态列表应传稳定业务主键。 @type {string|((record: any) => React.Key)|undefined} */
    rowKey: undefined,
    /** 默认不显示加载遮罩；true 覆盖表格区域。 */
    loading: false,
    /** 默认不显示分页；对象中 current/pageSize/total 分别默认 1/10/0，由页面管理数据。 @type {false|{current?: number, pageSize?: number, total?: number, showSizeChanger?: boolean, showQuickJumper?: boolean}} */
    pagination: false,
    /** 分页变化通知 {current, pageSize, total}，默认 undefined 不通知；组件不自行请求或切片。 @type {((page: {current: number, pageSize: number, total: number}) => void)|undefined} */
    onChange: undefined,
    /** 表格整体宽度（px 或 CSS 长度）；默认 undefined 由样式铺满父级宽度。 @type {number|string|undefined} */
    width: undefined,
    /** 表格整体高度（px 或 CSS 长度），包含表头、表体和分页；默认 undefined 使用 fillHeight。 @type {number|string|undefined} */
    height: undefined,
    /** 默认 undefined 随父级填充；y 为显式表体高度（px），优先于填充；横向范围由列宽决定。 @type {{x?: number, y?: number}|undefined} */
    scroll: undefined,
    /** 默认填满父级可用宽高；无父级高度时保留 500px 表体；false 且无 scroll.y 时随内容展开。 */
    fillHeight: true,
    /** 默认按内容换行计算行高；false 使用 48px 固定行高复用池，sections 始终使用分组复用池。 */
    autoRowHeight: true,
    /** 全部列默认水平居中；columns[].align 优先，其次使用本属性，最后回落到 center。 @type {HGTableAlign} */
    align: "center",
    /** 默认开启数据行悬浮底色，false 保留斑马纹和选中底色。 */
    rowHover: true,
    /** 默认 undefined 不显示选择列；type 默认单选，selectedRowKeys 与 onChange(keys, rows) 由页面受控。 @type {{type?: 'radio'|'checkbox', selectedRowKeys?: Array<React.Key>, onChange?: (keys: Array<React.Key>, rows: Array<any>) => void}|undefined} */
    rowSelection: undefined,
    /** 行尾操作渲染函数，默认 undefined 不预留操作区；控件尺寸不超过 32px。 @type {((record: any, index: number) => React.ReactNode)|undefined} */
    renderRowAction: undefined,
    /** 斑马纹分组序号，默认 undefined 使用数据行号；返回相同序号可让父子行共用底色。 @type {((record: any, index: number) => number)|undefined} */
    getRowStripeIndex: undefined,
    /** 根容器附加样式类，默认空字符串，仅保留组件样式。 */
    className: "",
  };

  constructor(props) {
    super(props);
    this.state = {
      offset: 0, // 固定行高虚拟列表的起始行索引；0 表示从首行开始。
      scrollTop: 0, // section 列表的纵向滚动位置（px）；初始为顶部。
      fillBodyHeight: null, // 填充模式（fillHeight）下实测的表体可用高度；null 表示尚未完成首次测量。
    };
    this.scrollRef = React.createRef(); // 当前表体滚动节点；挂载前 current 为 null。
    // 表头与表体独立滚动，以 ref 同步像素位置而不触发 React 重渲染。
    this.headerRef = React.createRef(); // 表头横向滚动节点；与表体同步位置。
    this.containerRef = React.createRef(); // 表格根容器；填充模式据此测量可用高度。
    this.paginationRef = React.createRef(); // 分页器节点；填充模式测高时需扣除其占位。
    this.hgDrag = null; // 当前鼠标拖动身份；null 表示没有正在拖动表体。
    this.hgSuppressClick = false; // 拖动后屏蔽该手势触发的行内链接误点击。
  }

  /** 监听表体可视宽度变化，包含窗口缩放及纵向滚动条出现/消失。 */
  componentDidMount() {
    if (typeof ResizeObserver !== "undefined") {
      this.hgResizeObserver = new ResizeObserver(this.hgRefreshScrollLayout);
      // 填充模式需跟踪容器高度：窗口缩放或父级高度变化时重算表体可用高度。
      this.hgContainerResizeObserver = new ResizeObserver(this.hgMeasureFillHeight);
    }
    this.hgObserveScrollBody();
  }

  /** 数据、列及模式更新后，重新绑定可能更换的表体并对齐位置。 */
  componentDidUpdate() {
    this.hgObserveScrollBody();
  }

  /** 卸载后停止尺寸监听，避免访问已移除的滚动节点。 */
  componentWillUnmount() {
    this.hgDrag = null;
    this.hgResizeObserver?.disconnect();
    this.hgContainerResizeObserver?.disconnect();
  }

  /** 仅在表体节点更换时重建监听，不在每次虚拟列表更新时重复订阅。 */
  hgObserveScrollBody = () => {
    const body = this.scrollRef.current;
    if (body !== this.hgObservedBody) {
      this.hgResizeObserver?.disconnect();
      if (body) this.hgResizeObserver?.observe(body);
      this.hgObservedBody = body;
    }
    // 填充或显式整体高度下按需监听容器节点；节点更换（如模式切换）时重建监听。
    const container = this.containerRef.current;
    const usesContainerHeight = this.hgUsesContainerHeight(); // scroll.y 只约束表体，不测量整体剩余高度。
    if (container !== this.hgObservedContainer || usesContainerHeight !== this.hgObservedFill) {
      this.hgContainerResizeObserver?.disconnect();
      if (container && usesContainerHeight)
        this.hgContainerResizeObserver?.observe(container);
      this.hgObservedContainer = container;
      this.hgObservedFill = usesContainerHeight;
    }
    this.hgRefreshScrollLayout();
    this.hgMeasureFillHeight();
  };

  /**
   * 填充模式测高：容器实际高度扣除表头与分页器后即为表体可用高度。
   * 约束：仅 fillHeight 开启时执行；测量值未变化时不更新 state，
   *       避免 ResizeObserver 回调与 setState 形成死循环。
   */
  hgMeasureFillHeight = () => {
    if (!this.hgUsesContainerHeight()) return;
    // 直接测量 CSS 分配后的表体，避免分页换行、边框或小容器导致高度相加溢出。
    const nextHeight = this.scrollRef.current?.clientHeight;
    if (!nextHeight) return;
    if (nextHeight !== this.state.fillBodyHeight) {
      this.setState({ fillBodyHeight: nextHeight });
    }
  };

  /** 显式滚动高度优先；其余场景默认由父级区域决定表体大小。 */
  hgFillsParent = () => Boolean(this.props.fillHeight && this.props.height == null && !this.props.scroll?.y);

  /** 默认填充或显式整体高度都由容器向表体分配剩余空间；scroll.y 仍单独约束表体。 */
  hgUsesContainerHeight = () => Boolean(this.props.height != null || this.hgFillsParent());

  /** 表头使用表体的可视宽度，使两端最大横滚范围相同且列保持像素对齐。 */
  hgRefreshScrollLayout = () => {
    const body = this.scrollRef.current;
    const header = this.headerRef.current;
    if (!body || !header || body.clientWidth === 0) return;
    const width = `${body.clientWidth}px`;
    if (header.style.width !== width) header.style.width = width;
    this.syncScrollPosition(body, header);
    this.hgMeasureFillHeight();
  };

  /**
   * 判断是否使用 sections 模式。
   * @returns {boolean}
   */
  isSectionMode = () => {
    return Array.isArray(this.props.sections);
  };

  /**
   * 获取行唯一 key。
   */
  getRowKey = (record, index) => {
    const { rowKey } = this.props;
    if (typeof rowKey === "function") return rowKey(record);
    if (typeof rowKey === "string" && record[rowKey] !== undefined)
      return String(record[rowKey]);
    return String(index);
  };

  /** 分组行按调用方的组序号着色；未配置或返回空值时仍按真实行号交替。 */
  getStripeIndex = (record, rowIndex) => this.props.getRowStripeIndex?.(record, rowIndex) ?? rowIndex;

  /** 获取当前数据行；section 模式也与普通表体共用同一选择契约。 */
  getSelectionRows = () => {
    const { dataSource = [], sections } = this.props;
    return Array.isArray(sections) ? sections.flatMap((section) => section.data || []) : dataSource;
  };

  /** 受控选择变更：只提交 key 与对应行，不在表格内部保存业务选择。 */
  handleSelectRow = (record) => {
    const { rowSelection } = this.props;
    if (!rowSelection) return;
    const rows = this.getSelectionRows();
    const key = this.getRowKey(record, rows.indexOf(record));
    const selectedKeys = rowSelection.selectedRowKeys || [];
    const nextKeys = rowSelection.type === "checkbox"
      ? selectedKeys.includes(key) ? selectedKeys.filter((item) => item !== key) : [...selectedKeys, key]
      : [key];
    rowSelection.onChange?.(nextKeys, rows.filter((row, index) => nextKeys.includes(this.getRowKey(row, index))));
  };

  /** 多选表头仅操作当前表格数据，保留不在当前数据中的已选 key。 */
  handleSelectAll = (checked) => {
    const { rowSelection } = this.props;
    const rows = this.getSelectionRows();
    const selectedKeys = rowSelection.selectedRowKeys || [];
    const keys = rows.map((row, index) => this.getRowKey(row, index));
    const nextKeys = checked
      ? [...new Set([...selectedKeys, ...keys])]
      : selectedKeys.filter((key) => !keys.includes(key));
    rowSelection.onChange?.(nextKeys, rows.filter((row, index) => nextKeys.includes(this.getRowKey(row, index))));
  };

  /** 配置选择列；未传 rowSelection 时维持原表格列与交互。 */
  getColumns = () => {
    const { columns = [], rowSelection } = this.props;
    const tableAlign = hgNormalizeTableAlign(this.props.align); // 非法组件级值不向单元格透传，统一回落到居中。
    const alignedColumns = columns.map((column) => ({
      ...column,
      align: hgNormalizeTableAlign(column.align, tableAlign),
    }));
    if (!rowSelection) return alignedColumns;
    const rows = this.getSelectionRows();
    const selectedKeys = rowSelection.selectedRowKeys || [];
    const allKeys = rows.map((row, index) => this.getRowKey(row, index));
    const selectedCount = allKeys.filter((key) => selectedKeys.includes(key)).length;
    const multiple = rowSelection.type === "checkbox";
    return [{
      key: "hg-selection",
      width: 56,
      align: tableAlign,
      title: multiple ? (
        <input
          type="checkbox"
          aria-label="全选"
          checked={allKeys.length > 0 && selectedCount === allKeys.length}
          ref={(input) => { if (input) input.indeterminate = selectedCount > 0 && selectedCount < allKeys.length; }}
          disabled={allKeys.length === 0}
          onChange={(event) => this.handleSelectAll(event.target.checked)}
        />
      ) : "选择",
      render: (_, record) => {
        const key = this.getRowKey(record, rows.indexOf(record));
        return (
          <input
            type={multiple ? "checkbox" : "radio"}
            aria-label={`选择 ${key}`}
            checked={selectedKeys.includes(key)}
            onChange={() => this.handleSelectRow(record)}
          />
        );
      },
    }, ...alignedColumns];
  };

  /**
   * 获取表体可视区域高度。
   * 填充模式优先使用实测可用高度；显式滚动优先使用 scroll.y。
   * 未约束高度的固定行/分组表按数据总高度撑开，供复用池完整渲染。
   */
  getBodyHeight = () => {
    const { scroll, fillHeight } = this.props;
    const { fillBodyHeight } = this.state;
    if (scroll?.y) return scroll.y;
    if (this.hgUsesContainerHeight() && fillBodyHeight) return fillBodyHeight;
    // 填充模式首次测量前保留适当的复用池估值，避免只渲染缓冲区内的行。
    if (fillHeight || this.props.height != null) return FILL_BODY_ESTIMATE;
    return this.isSectionMode()
      ? flattenSections(this.props.sections).totalHeight
      : (this.props.dataSource?.length ?? 0) * ROW_HEIGHT;
  };

  /**
   * 计算表头与表体共同使用的最小列宽。
   * 单元格为 border-box，显式 width 已包含 padding；无 width 的列按至少 120px 估算，
   * 可用 minWidth 提高个别弹性列的最小宽度。
   * 行尾操作不参与列布局，需额外预留末列间距、按钮尺寸及右侧间距。
   */
  getTotalColumnsWidth = () => {
    const columns = this.getColumns();
    const DEFAULT_COL_WIDTH = 120; // 未设置宽度的弹性列预留的最小估算宽度（px）。
    const columnsWidth = columns.reduce((sum, col) => {
      const w = col.width ? Number(col.width) : Math.max(DEFAULT_COL_WIDTH, Number(col.minWidth) || 0); // 弹性列至少保留可读宽度。
      return sum + w;
    }, 0);
    return columnsWidth + (this.props.renderRowAction ? 68 : 0); // 末列间距 20px、按钮 32px、右间距 16px。
  };

  /**
   * 滚动事件处理（sections 模式）。
   * 职责：计算虚拟行偏移量与滚动位置，触发 React 更新。
   */
  handleSectionScroll = (e) => {
    if (!this.shouldHandleScroll(e)) return;
    const { scrollTop } = e.currentTarget;
    const { sections = [] } = this.props;
    const { items } = flattenSections(sections);

    this.syncScrollPosition(e.currentTarget, this.headerRef.current);

    const startIdx = findStartIndex(items, scrollTop - ROW_HEIGHT * BUFFER_ROWS);
    const stateUpdate = {};
    if (startIdx !== this.state.offset) {
      stateUpdate.offset = startIdx;
    }
    if (scrollTop !== this.state.scrollTop) {
      stateUpdate.scrollTop = scrollTop;
    }
    if (Object.keys(stateUpdate).length > 0) {
      this.setState(stateUpdate);
    }
  };

  /**
   * 滚动事件处理（dataSource 模式）。
   * 职责：计算行偏移量，触发 React 更新复用池中每行显示的数据。
   */
  handleScroll = (e) => {
    if (!this.shouldHandleScroll(e)) return;
    const { scrollTop } = e.currentTarget;
    const { dataSource = [] } = this.props;
    const totalCount = dataSource.length;
    const bodyHeight = this.getBodyHeight();

    this.syncScrollPosition(e.currentTarget, this.headerRef.current);

    const poolSize = Math.ceil(bodyHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
    const maxOffset = Math.max(0, totalCount - poolSize);
    const rawOffset = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    const newOffset = Math.min(rawOffset, maxOffset);

    if (newOffset !== this.state.offset) {
      this.setState({ offset: newOffset });
    }
  };

  /**
   * 横向滚动同步处理（自然行高模式）。
   * 职责：只同步表头与表体的横向位置，不触发固定行高虚拟滚动计算。
   */
  handleAutoRowHeightScroll = (e) => {
    if (!this.shouldHandleScroll(e)) return;

    // 自然行高模式只需要同步横向位置；纵向高度交给浏览器文档流自然计算。
    this.syncScrollPosition(e.currentTarget, this.headerRef.current);
  };

  /**
   * 处理表头横向滚动事件。
   * 职责：只响应 headerWrap 自身的滚动，避免嵌套可滚动节点冒泡造成错误同步。
   */
  handleHeaderScroll = (e) => {
    if (!this.shouldHandleScroll(e)) return;
    this.syncScrollPosition(e.currentTarget, this.scrollRef.current);
  };

  /**
   * 只处理容器自身事件；脚本同步产生的事件由相等位置检查避免重复写入。
   */
  shouldHandleScroll = (e) => {
    return e.currentTarget === e.target;
  };

  /**
   * 双向同步两个横向滚动容器，并按目标容器的最大范围钳制位置。
   */
  syncScrollPosition = (source, target) => {
    if (!source || !target) return;

    syncHorizontalScroll(source, target);
  };

  /** 表体拖动优先滚动自身，触底或触顶后继续滚动整个页面。 */
  hgOnPointerDown = (event) => {
    this.hgSuppressClick = false;
    this.hgDrag = hgStartDrag(event);
  };

  hgOnPointerMove = (event) => {
    if (hgMoveDrag(event, this.hgDrag)) this.hgSuppressClick = true;
  };

  hgOnPointerEnd = (event) => {
    if (this.hgDrag?.id === event.pointerId) this.hgDrag = null;
  };

  /** 鼠标拖动表体中的链接或图片时不启动浏览器原生拖拽。 */
  hgOnDragStart = (event) => {
    if (this.hgDrag) event.preventDefault();
  };

  hgOnClickCapture = (event) => {
    if (!this.hgSuppressClick) return;
    this.hgSuppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  /** 表头和所有表体模式共用纵向拖动；分页控件保持原有点击行为。 */
  hgBodyDragProps = () => ({
    onPointerDown: this.hgOnPointerDown,
    onPointerMove: this.hgOnPointerMove,
    onPointerUp: this.hgOnPointerEnd,
    onPointerCancel: this.hgOnPointerEnd,
    onLostPointerCapture: this.hgOnPointerEnd,
    onDragStart: this.hgOnDragStart,
    onClickCapture: this.hgOnClickCapture,
  });

  /**
   * 触发外部分页变更回调。
   */
  emitChange = (page, size) => {
    const { pagination, onChange } = this.props;
    const total = pagination && pagination.mode !== "cursor" ? pagination.total || 0 : 0;
    if (onChange) onChange({ current: page, pageSize: size, total });
  };

  /**
   * 渲染 loading 遮罩层。
   */
  renderLoading = () => {
    const { loading } = this.props;
    if (!loading) return null;
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.spinner} />
      </div>
    );
  };

  /** 游标不提供总数或任意页跳转；发出相邻页码，由业务页持有实际游标。 */
  renderCursorPagination = ({
    current = HG_TABLE_PAGINATION_DEFAULTS.current, // 从 1 开始的当前页码。
    pageSize = HG_TABLE_PAGINATION_DEFAULTS.pageSize, // 回调使用的每页条数，组件不截取结果。
    hasPreviousPage = HG_TABLE_PAGINATION_DEFAULTS.hasPreviousPage, // 缺少前页游标时不允许回退。
    hasNextPage = HG_TABLE_PAGINATION_DEFAULTS.hasNextPage, // 缺少后页游标时不允许前进。
  }) => {
    const { loading } = this.props; // 请求期间两侧按钮都不可操作。
    return (
      <nav className={styles.pagination} ref={this.paginationRef} aria-label="表格分页">
        <button type="button" className={styles.pageBtn} aria-label="上一页"
          disabled={loading || current <= 1 || !hasPreviousPage}
          onClick={() => this.emitChange(current - 1, pageSize)}>‹</button>
        <span className={styles.totalText} aria-current="page">第 {current} 页</span>
        <button type="button" className={styles.pageBtn} aria-label="下一页"
          disabled={loading || !hasNextPage}
          onClick={() => this.emitChange(current + 1, pageSize)}>›</button>
      </nav>
    );
  };

  /**
   * 渲染分页器。
   */
  renderPagination = () => {
    const { pagination } = this.props;
    if (pagination === false || !pagination) return null;
    if (pagination.mode === "cursor") return this.renderCursorPagination(pagination);

    const {
      current = 1,
      pageSize = 10,
      total = 0,
      showSizeChanger = false,
      showQuickJumper = false,
    } = pagination;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    const handleChangePage = (page) => {
      if (page < 1 || page > totalPages || page === current) return;
      this.emitChange(page, pageSize);
    };

    const handleSizeChange = (size) => {
      this.emitChange(1, size);
    };

    const getPageNumbers = () => {
      const pages = [];
      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        if (current > 3) pages.push("...");
        const start = Math.max(2, current - 1);
        const end = Math.min(totalPages - 1, current + 1);
        for (let i = start; i <= end; i++) pages.push(i);
        if (current < totalPages - 2) pages.push("...");
        pages.push(totalPages);
      }
      return pages;
    };

    const startItem = total > 0 ? (current - 1) * pageSize + 1 : 0;
    const endItem = Math.min(current * pageSize, total);

    return (
      <div className={styles.pagination} ref={this.paginationRef}>
        <span className={styles.totalText}>
          {total > 0 ? `${startItem}-${endItem} / ${total}` : `共 0 条`}
        </span>
        {showSizeChanger && (
          <select
            className={styles.sizeChanger}
            value={pageSize}
            onChange={(e) => handleSizeChange(Number(e.target.value))}
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} 条/页
              </option>
            ))}
          </select>
        )}
        <button
          className={styles.pageBtn}
          disabled={current <= 1}
          onClick={() => handleChangePage(current - 1)}
        >
          ‹
        </button>
        {getPageNumbers().map((page, idx) =>
          page === "..." ? (
            <span key={`ellipsis-${idx}`} className={styles.ellipsis}>
              ···
            </span>
          ) : (
            <button
              key={page}
              className={`${styles.pageBtn} ${page === current ? styles.pageBtnActive : ""}`}
              onClick={() => handleChangePage(page)}
            >
              {page}
            </button>
          )
        )}
        <button
          className={styles.pageBtn}
          disabled={current >= totalPages}
          onClick={() => handleChangePage(current + 1)}
        >
          ›
        </button>
        {showQuickJumper && (
          <span className={styles.quickJumper}>
            跳至
            <input
              className={styles.quickInput}
              type="number"
              min={1}
              max={totalPages}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  const val = Number(e.target.value);
                  if (val >= 1 && val <= totalPages) {
                    handleChangePage(val);
                    e.target.value = "";
                  }
                }
              }}
            />
            页
          </span>
        )}
      </div>
    );
  };

  /**
   * 渲染表头。
   */
  renderHeader = () => {
    const columns = this.getColumns();
    const totalWidth = this.getTotalColumnsWidth();
    const reserveRowAction = Boolean(this.props.renderRowAction); // 与表体一致，末列伸缩但保留行尾按钮区域。
    return (
      <div className={styles.headerWrap} ref={this.headerRef} onScroll={this.handleHeaderScroll} {...this.hgBodyDragProps()}>
        {/*
          表头必须采用“外层 100% 可视宽度 + 内层 totalWidth 总列宽”的结构。
          这样 headerWrap 才会拥有真实横向滚动空间，表体滚动时设置 scrollLeft 才能移动 title 行。
        */}
        <div className={`${styles.row} ${reserveRowAction ? styles.actionRow : ""}`} style={{ minWidth: totalWidth }}>
          {columns.map((col) => (
            <div
              key={col.key || col.dataIndex || col.title}
              className={styles.headerCell}
              style={getColumnStyle(col, true)}
            >
              {col.title}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 渲染 sections 模式表体（虚拟滚动，变高行，支持吸顶/吸底）。
   *
   * 实现：
   *   - flattenSections 将多 section 展平为 [{type, top, height, ...}] 列表；
   *   - 二分查找 findStartIndex 定位可见区域起始行；
   *   - 按 poolSize 渲染复用池，每行 absolute 定位到对应 top；
   *   - sectionHeader/footer 使用专用组件渲染，cell 使用 VirtualRow；
   *   - 吸顶：当 section header 滚出顶部时，sticky 固定在可视区域顶部；
   *   - 吸底：当 section footer 滚出底部时，sticky 固定在可视区域底部。
   */
  renderSectionBody = () => {
    const { sections = [], rowSelection, renderRowAction } = this.props;
    const columns = this.getColumns();
    const selectionRows = rowSelection ? this.getSelectionRows() : []; // 仅在启用选择时展平，供 section 行 key 对齐。
    const { offset, scrollTop } = this.state;
    const bodyHeight = this.getBodyHeight();
    const { items, totalHeight, sectionMetas } = flattenSections(sections);
    const totalWidth = this.getTotalColumnsWidth();

    if (items.length === 0) {
      return (
        <div className={styles.bodyWrap} style={this.props.scroll?.y || this.hgUsesContainerHeight() ? { height: bodyHeight } : undefined} ref={this.scrollRef} onScroll={this.handleSectionScroll} {...this.hgBodyDragProps()}>
          <div className={styles.emptyCell} style={{ minWidth: totalWidth }}>暂无数据</div>
        </div>
      );
    }

    const poolSize = this.props.scroll?.y || this.hgUsesContainerHeight()
      ? Math.ceil(bodyHeight / ROW_HEIGHT) + BUFFER_ROWS * 2
      : items.length;
    const visibleItems = [];
    for (let i = 0; i < poolSize && offset + i < items.length; i++) {
      visibleItems.push(items[offset + i]);
    }

    // 计算当前需要 sticky 的 header 和 footer
    let stickyHeader = null;
    let stickyFooter = null;

    for (let i = 0; i < sectionMetas.length; i++) {
      const meta = sectionMetas[i];
      const sectionBottom = meta.end;
      const sectionTop = meta.start;

      // 吸顶逻辑：section header 已经滚出顶部，但 section 还在可视区域内
      if (meta.hasHeader && scrollTop > sectionTop && scrollTop < sectionBottom - meta.footerHeight) {
        stickyHeader = {
          section: meta.section,
          sectionIndex: meta.index,
          height: meta.headerHeight,
        };
      }

      // 吸底逻辑：section footer 已经滚出底部，但 section 还在可视区域内
      if (meta.hasFooter) {
        const footerTop = sectionBottom - meta.footerHeight;
        const viewportBottom = scrollTop + bodyHeight;
        if (footerTop > scrollTop && footerTop > viewportBottom - meta.footerHeight && sectionTop < viewportBottom) {
          stickyFooter = {
            section: meta.section,
            sectionIndex: meta.index,
            height: meta.footerHeight,
          };
        }
      }
    }

    return (
      <div
        className={styles.bodyWrap}
        style={this.props.scroll?.y || this.hgUsesContainerHeight() ? { height: bodyHeight } : undefined}
        ref={this.scrollRef}
        onScroll={this.handleSectionScroll}
        {...this.hgBodyDragProps()}
      >
        {/* Sticky Section Header */}
        {stickyHeader && (
          <div
            className={styles.stickyHeader}
            style={{ height: stickyHeader.height, minWidth: totalWidth }}
          >
            <VirtualSectionHeader section={stickyHeader.section} columns={columns} />
          </div>
        )}

        {/* Sticky Section Footer */}
        {stickyFooter && (
          <div
            className={styles.stickyFooter}
            style={{ height: stickyFooter.height, minWidth: totalWidth }}
          >
            <VirtualSectionFooter section={stickyFooter.section} columns={columns} />
          </div>
        )}

        <div className={styles.virtualSpacer} style={{ height: totalHeight, minWidth: totalWidth }}>
          {visibleItems.map((item) => {
            const key = `${item.type}-${item.sectionIndex}-${item.rowIndex ?? "s"}`;

            if (item.type === ROW_TYPE.SECTION_HEADER) {
              return (
                <div
                  key={key}
                  className={styles.poolRow}
                  style={{ top: item.top, height: item.height, minWidth: totalWidth }}
                >
                  <VirtualSectionHeader section={item.data} columns={columns} />
                </div>
              );
            }

            if (item.type === ROW_TYPE.SECTION_FOOTER) {
              return (
                <div
                  key={key}
                  className={styles.poolRow}
                  style={{ top: item.top, height: item.height, minWidth: totalWidth }}
                >
                  <VirtualSectionFooter section={item.data} columns={columns} />
                </div>
              );
            }

            // cell
            return (
              <div
                key={key}
                className={styles.poolRow}
                style={{ top: item.top, height: item.height, minWidth: totalWidth }}
              >
                <VirtualRow
                  columns={columns}
                  record={item.record}
                  rowIndex={item.rowIndex}
                  stripeIndex={this.getStripeIndex(item.record, item.rowIndex)}
                  selected={rowSelection?.selectedRowKeys?.includes(this.getRowKey(item.record, selectionRows.indexOf(item.record)))}
                  onSelect={rowSelection ? this.handleSelectRow : undefined}
                  rowAction={renderRowAction?.(item.record, item.rowIndex)}
                  reserveRowAction={Boolean(renderRowAction)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * 渲染 dataSource 模式表体（原有虚拟滚动，固定行高）。
   */
  renderBody = () => {
    const { dataSource = [], rowSelection, renderRowAction } = this.props;
    const columns = this.getColumns();
    const { offset } = this.state;
    const bodyHeight = this.getBodyHeight();
    const totalCount = dataSource.length;
    const totalHeight = totalCount * ROW_HEIGHT;
    const poolSize = Math.ceil(bodyHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
    const totalWidth = this.getTotalColumnsWidth();

    if (totalCount === 0) {
      return (
        <div className={styles.bodyWrap} style={this.props.scroll?.y || this.hgUsesContainerHeight() ? { height: bodyHeight } : undefined} ref={this.scrollRef} onScroll={this.handleScroll} {...this.hgBodyDragProps()}>
          <div className={styles.emptyCell} style={{ minWidth: totalWidth }}>暂无数据</div>
        </div>
      );
    }

    return (
      <div
        className={styles.bodyWrap}
        style={this.props.scroll?.y || this.hgUsesContainerHeight() ? { height: bodyHeight } : undefined}
        ref={this.scrollRef}
        onScroll={this.handleScroll}
        {...this.hgBodyDragProps()}
      >
        <div className={styles.virtualSpacer} style={{ height: totalHeight, minWidth: totalWidth }}>
          {Array.from({ length: this.props.scroll?.y || this.hgUsesContainerHeight() ? poolSize : totalCount }, (_, poolIdx) => {
            const dataIdx = offset + poolIdx;
            const inBounds = dataIdx >= 0 && dataIdx < totalCount;
            const record = inBounds ? dataSource[dataIdx] : null;
            return (
              <div
                key={poolIdx}
                className={styles.poolRow}
                style={{
                  top: inBounds ? dataIdx * ROW_HEIGHT : -ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  minWidth: totalWidth,
                  visibility: record ? "visible" : "hidden",
                }}
              >
                <VirtualRow
                  columns={columns}
                  record={record}
                  rowIndex={dataIdx}
                  stripeIndex={record ? this.getStripeIndex(record, dataIdx) : dataIdx}
                  selected={record && rowSelection?.selectedRowKeys?.includes(this.getRowKey(record, dataIdx))}
                  onSelect={rowSelection ? this.handleSelectRow : undefined}
                  rowAction={record ? renderRowAction?.(record, dataIdx) : null}
                  reserveRowAction={Boolean(renderRowAction)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * 自然行高表体在填充模式下的样式。
   * 职责：fillHeight 开启时不再使用固定像素 maxHeight，改为弹性占满容器剩余高度；
   *       关闭时仅在显式指定 scroll.y 时限制表体高度，其他情况由内容撑开。
   */
  hgAutoBodyStyle = () => {
    const { fillHeight, scroll } = this.props;
    if (scroll?.y) return { maxHeight: scroll.y };
    return fillHeight || this.props.height != null
      ? { flex: `1 1 ${FILL_BODY_ESTIMATE}px`, minHeight: 0 }
      : undefined;
  };

  /**
   * 渲染自然行高表体。
   * 职责：用于少量分页数据需要完整换行展示的场景，避免固定行高虚拟列表裁切内容。
   */
  renderAutoRowHeightBody = () => {
    const { dataSource = [], rowSelection, renderRowAction } = this.props;
    const columns = this.getColumns();
    const hgBodyStyle = this.hgAutoBodyStyle();
    // 表体内层宽度必须和表头内层宽度一致，否则横向滚动距离与 title 列无法对齐。
    const totalWidth = this.getTotalColumnsWidth();

    if (dataSource.length === 0) {
      return (
        <div
          className={`${styles.bodyWrap} ${styles.autoHeightBodyWrap}`}
          style={hgBodyStyle}
          ref={this.scrollRef}
          onScroll={this.handleAutoRowHeightScroll}
          {...this.hgBodyDragProps()}
        >
          <div className={styles.emptyCell} style={{ minWidth: totalWidth }}>暂无数据</div>
        </div>
      );
    }

    return (
      <div
        className={`${styles.bodyWrap} ${styles.autoHeightBodyWrap}`}
        style={hgBodyStyle}
        ref={this.scrollRef}
        onScroll={this.handleAutoRowHeightScroll}
        {...this.hgBodyDragProps()}
      >
        {/*
          autoHeightBodyInner 是实际被横向滚动的内容层。
          minWidth 使用列总宽度撑开表体，宽容器内则与表头一样填满可视区域。
        */}
        <div className={styles.autoHeightBodyInner} style={{ minWidth: totalWidth }}>
          {dataSource.map((record, rowIndex) => (
            <VirtualRow
              key={this.getRowKey(record, rowIndex)}
              columns={columns}
              record={record}
              rowIndex={rowIndex}
              stripeIndex={this.getStripeIndex(record, rowIndex)}
              autoRowHeight
              selected={rowSelection?.selectedRowKeys?.includes(this.getRowKey(record, rowIndex))}
              onSelect={rowSelection ? this.handleSelectRow : undefined}
              rowAction={renderRowAction?.(record, rowIndex)}
              reserveRowAction={Boolean(renderRowAction)}
            />
          ))}
        </div>
      </div>
    );
  };

  render() {
    // 默认开启自然行高：表格字段超出列宽时换行展示，避免固定行高虚拟列表裁切长内容。
    // fillHeight：填充模式开关，开启后容器作为父级弹性子项占满剩余高度，表体高度随容器动态变化。
    // rowHover：默认开启行悬浮背景；关闭时不覆盖斑马纹或分组底色。
    const { className = "", width, height, autoRowHeight = true, rowHover = true } = this.props; // 默认值和用途见 defaultProps。
    const fillHeight = this.hgFillsParent(); // 显式 scroll.y 时保持固定视口，不拉伸外层。
    const usesContainerHeight = this.hgUsesContainerHeight(); // 显式整体高度也让表体占满扣除表头、分页后的剩余区域。
    const useSections = this.isSectionMode();
    const tableClassName = `${styles.tableContainer} ${usesContainerHeight ? styles.boundedHeightContainer : ""} ${fillHeight ? styles.fillContainer : ""} ${height != null ? styles.explicitHeightContainer : ""} ${autoRowHeight ? styles.autoHeightTableContainer : ""} ${rowHover ? styles.hoverRows : ""} ${className}`;
    const tableStyle = width == null && height == null ? undefined : {
      ...(width == null ? {} : { width }),
      ...(height == null ? {} : { height }),
    };

    return (
      <div className={tableClassName} style={tableStyle} ref={this.containerRef}>
        {this.renderLoading()}
        {!useSections && this.renderHeader()}
        {useSections
          ? this.renderSectionBody()
          : autoRowHeight
            ? this.renderAutoRowHeightBody()
            : this.renderBody()}
        {this.renderPagination()}
      </div>
    );
  }
}

export default HGTablePage;

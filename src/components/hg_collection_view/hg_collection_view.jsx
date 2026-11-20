import React from "react";
import {
  hgCollectionOffsets,
  hgCollectionStart,
} from "./hg_collection_layout.js";
import styles from "./hg_collection_view.module.css";
import { hgStartDrag, hgMoveDrag } from "../hg_drag_scroll/hg_drag_scroll.js";
import {
  HG_COLLECTION_PAGINATION_DEFAULTS,
  hgCollectionPagination,
  hgNormalizeCollectionAlign,
} from "./hg_collection_view_contract.js";

const HG_OVERSCAN = 240; // 可视区域上下额外预渲染的像素，减少快速滚动时的空白。
const HG_LOAD_THRESHOLD = 120; // 距底部不足此像素数时触发下一页。
const HG_PULL_THRESHOLD = 70; // 触摸从顶部下拉超过此像素数才刷新。

/**
 * @typedef {'left'|'center'|'right'} HGCollectionAlign
 * CollectionView cell 支持的水平对齐枚举；非法值统一回落到 center。
 */

/**
 * @typedef {object} HGCollectionViewProps
 * @property {Array<any>} [items=[]] 列表数据，按数组顺序展示；缺省显示空态，组件不会请求或修改数据。
 * @property {boolean} [fillHeight=true] 默认填满父级可用宽高；false 且未传 height 时由内容撑高。
 * @property {number|string} [width] 列表整体宽度，数字单位为 px；缺省铺满父级宽度。
 * @property {number|string} [height] 列表整体高度，数字单位为 px；优先于 fillHeight，分页与状态栏包含在该高度内。
 * @property {number} [columnMinWidth] 自然高度模式的网格最小列宽（px）；缺省保持单列，仅 fillHeight=false 且无 height 时生效。
 * @property {HGCollectionAlign} [align="center"] cell 内容的水平对齐；非法值回落到居中。
 * @property {boolean} [loading=false] true 展示加载提示，并阻止重复触底或下拉请求。
 * @property {boolean} [hasMore=false] true 且提供 onLoadMore 时允许触底加载下一批数据。
 * @property {false|{current: number, pageSize: number, loadedCount: number, hasMore: boolean}} [pagination=false] 受控分页配置；启用时关闭触底加载。
 * @property {(page: {current: number, pageSize: number}) => void} [onChange] 翻页回调；调用方负责维护页码和数据。
 * @property {() => void} [onLoadMore] 触底追加数据回调；缺省不自动加载。
 * @property {() => void} [onRefresh] 顶部下拉超过 70px 后触发；缺省不刷新。
 * @property {string|number} [resetKey] 数据集身份；变化时回到顶部并清除高度缓存。
 * @property {string|number} [pageKey] 展示页身份；变化时仅回到顶部并保留高度缓存。
 * @property {string} [ariaLabel="列表"] 辅助技术读取的列表名称，业务页面应按场景覆盖。
 * @property {React.ReactNode} [emptyText="暂无数据"] 无记录且未加载时的占位内容。
 * @property {React.ReactNode} [loadedText="已加载全部订单"] 非分页列表全部加载完成后的提示。
 * @property {(item: any, index: number) => React.Key} getKey 必传，无默认值；返回稳定业务主键，重排和复用时用于隔离子组件状态。
 * @property {(item: any, index: number) => React.ReactNode} renderCell 必传，无默认值；将一条数据渲染为卡片，行高由实际内容测量。
 */

/**
 * 类似 UICollectionView 的单列变高复用列表。
 * 默认填满父级分配的区域；父级没有高度约束时使用 520px 视口基准，slot 按池索引复用 DOM。
 * 显式 width/height 约束列表整体尺寸；只有内容超出可视宽高时才由内部视口滚动。
 * 子组件以业务 key 隔离状态，不能跨订单复用业务状态。
 * 数据、游标及网络错误均由调用方管理；视口模式仅缓存当前挂载期间的高度。
 * 可选 pagination 使用受控页码和每页条数；分页时不再触底自动加载，避免重复翻页。
 *
 * @example
 * // HGCollectionView 没有 columns；组件级 align 直接控制所有 cell，缺省为 center。
 * <HGCollectionView
 *   align="left"
 *   items={roles}
 *   getKey={(role) => role.id}
 *   renderCell={(role) => <RoleCard role={role} />}
 * />
 * @extends {React.Component<HGCollectionViewProps>}
 */
export default class HGCollectionView extends React.Component {
  /** JavaScript pagination 配置辅助函数；点击可查看全部字段与用途。 */
  static configurePagination = hgCollectionPagination;

  /** pagination 子属性默认值与用途的可跳转入口；业务配置可使用 hgCollectionPagination 获得编辑器提示。 */
  static paginationDefaultProps = HG_COLLECTION_PAGINATION_DEFAULTS;

  /** 可选属性默认值；仅省略或传 undefined 时采用，null 保留调用方语义。 */
  static defaultProps = {
    /** 列表数据，按数组顺序展示；默认 [] 显示空态，不在组件内请求或修改数据。 @type {Array<any>} */
    items: [],
    /** 默认撑满父级可用宽高；false 且未传 height 时由内容撑高。 */
    fillHeight: true,
    /** 列表整体宽度（px 或 CSS 长度）；默认 undefined 由样式铺满父级宽度。 @type {number|string|undefined} */
    width: undefined,
    /** 列表整体高度（px 或 CSS 长度），包含状态栏和分页；优先于 fillHeight，默认 undefined 使用父级区域。 @type {number|string|undefined} */
    height: undefined,
    /** 默认不加载；true 展示加载提示并阻止重复触底/下拉请求。 */
    loading: false,
    /** 默认没有后续数据；true 且提供 onLoadMore 时允许触底加载。 */
    hasMore: false,
    /** 受控分页配置；默认 false 隐藏分页；使用 configurePagination/hgCollectionPagination 可跳转查看子属性。 @type {false|ReturnType<typeof hgCollectionPagination>} */
    pagination: false,
    /** 翻页回调，返回 {current, pageSize}；默认 undefined，由调用方维护分页数据。 @type {((page: {current: number, pageSize: number}) => void)|undefined} */
    onChange: undefined,
    /** 触底追加数据回调；默认 undefined 不自动加载，失败重试由页面负责。 @type {(() => void)|undefined} */
    onLoadMore: undefined,
    /** 顶部下拉超过 70px 后触发；默认 undefined 不刷新。 @type {(() => void)|undefined} */
    onRefresh: undefined,
    /** 数据集身份；变化时回到顶部并清除高度缓存，默认 undefined 不主动重置。 @type {string|number|undefined} */
    resetKey: undefined,
    /** 展示页身份；变化时仅回到顶部并保留高度缓存，默认 undefined 不切页。 @type {string|number|undefined} */
    pageKey: undefined,
    /** 辅助技术读取的列表名称，默认“列表”，业务页面可覆盖。 */
    ariaLabel: "列表",
    /** 无记录且未加载时的占位文案，默认“暂无数据”。 @type {React.ReactNode} */
    emptyText: "暂无数据",
    /** 非分页列表全部加载完成后的提示，默认沿用订单场景文案。 @type {React.ReactNode} */
    loadedText: "已加载全部订单",
    /** 自然高度模式的最小列宽（px）；默认 undefined 保持单列，传入后按 auto-fill 自动分列。仅 fillHeight=false 且无 height 时生效。 @type {number|undefined} */
    columnMinWidth: undefined,
    /** cell 内容默认水平居中；支持 left/center/right，非法值回落到 center。 @type {HGCollectionAlign} */
    align: "center",
  };

  state = {
    hgScrollTop: 0, // 当前纵向滚动像素，初始在顶部。
    hgViewportHeight: 520, // 视口测量高度（px）；挂载前用默认高度估算可见池。
    hgLayoutVersion: 0, // 测量结果变化时递增，促使偏移量重新计算。
  };

  hgViewport = React.createRef(); // 本组件的滚动容器；卸载后不再访问。
  hgSlots = new Map(); // 池编号到 DOM 节点的映射，只保存当前挂载的节点。
  hgSlotRefs = new Map(); // 池编号到稳定 ref 回调，避免每次滚动解绑尺寸观察。
  hgHeights = new Map(); // 业务 key 到含间距实测高度（px）的映射，卸载及刷新时清空。
  hgPoolSize = 0; // 本轮数据需要的最大 slot 数量，数据重置时归零。
  hgLastLoadLength = -1; // 最近一次自动加载对应的数据量，避免同长度重复请求。
  hgTouchStart = null; // 顶部触摸起点 Y（px）；null 表示没有待识别的下拉手势。
  hgPullDistance = 0; // 当前手势向下距离（px），松手时判断是否刷新。
  hgObservedWidth = 0; // 当前容器宽度（px）；改变时旧的变高测量不再有效。
  hgDrag = null; // 当前鼠标拖动身份；null 表示没有按住表体。
  hgSuppressClick = false; // 拖动结束后仅屏蔽由本次手势产生的误点击。
  hgLoadSentinel = null; // 自然高度模式的触底标记；未挂载时为 null。
  hgLoadVisible = false; // 标记是否进入页面可视区，仅在自然高度模式用于触底加载。

  componentDidMount() {
    if (this.hgUsesViewport() && typeof ResizeObserver !== "undefined") {
      this.hgObserver = new ResizeObserver(this.hgOnResize);
      if (this.hgViewport.current) this.hgObserver.observe(this.hgViewport.current);
      this.hgSlots.forEach((node) => this.hgObserver.observe(node));
    }
    if (this.hgUsesViewport()) {
      this.hgSyncSize();
      this.hgSlots.forEach((node) => this.hgMeasureSlot(node));
    }
    this.hgObserveLoadMore();
    this.hgCheckLoadMore();
  }

  componentDidUpdate(prevProps) {
    if (this.hgUsesViewport(prevProps) !== this.hgUsesViewport()) {
      this.hgObserver?.disconnect();
      this.hgObserver = undefined;
      this.hgHeights.clear();
      this.hgPoolSize = 0;
      this.hgLoadVisible = false;
      this.hgLoadObserver?.disconnect();
      this.hgLoadObserver = undefined;
      if (this.hgUsesViewport() && typeof ResizeObserver !== "undefined") {
        this.hgObserver = new ResizeObserver(this.hgOnResize);
        if (this.hgViewport.current) this.hgObserver.observe(this.hgViewport.current);
        this.hgSlots.forEach((node) => this.hgObserver.observe(node));
      }
      this.hgObserveLoadMore();
    }
    if (prevProps.resetKey !== this.props.resetKey) {
      this.hgHeights.clear();
      this.hgPoolSize = 0;
      this.hgLastLoadLength = -1;
      this.hgTouchStart = null;
      if (this.hgViewport.current) this.hgViewport.current.scrollTop = 0;
      this.setState((state) => ({ hgScrollTop: 0, hgLayoutVersion: state.hgLayoutVersion + 1 }));
      return;
    }
    if (prevProps.pageKey !== this.props.pageKey) {
      if (this.hgViewport.current) this.hgViewport.current.scrollTop = 0;
      this.setState({ hgScrollTop: 0 });
      return;
    }
    if (this.hgUsesViewport()) {
      this.hgSyncSize();
      this.hgSlots.forEach((node) => this.hgMeasureSlot(node));
    }
    this.hgCheckLoadMore();
  }

  componentWillUnmount() {
    this.hgDrag = null;
    this.hgObserver?.disconnect();
    this.hgLoadObserver?.disconnect();
    this.hgSlots.clear();
    this.hgSlotRefs.clear();
    this.hgHeights.clear();
  }

  /** 填充或显式高度均使用内部虚拟视口；只有明确关闭填充且无高度时随内容展开。 */
  hgUsesViewport = (props = this.props) => Boolean(props.fillHeight || props.height != null);

  /** slot 引用只在实际节点更换时更新监听；业务子组件随 key 更换而重新挂载。 */
  hgSetSlot = (index, node) => {
    const previous = this.hgSlots.get(index);
    if (previous === node) return;
    if (previous) this.hgObserver?.unobserve(previous);
    if (node) {
      this.hgSlots.set(index, node);
      this.hgObserver?.observe(node);
    } else this.hgSlots.delete(index);
  };

  /** 自然高度列表使用页面视口的底部标记触发加载，避免无内部滚动条时一次性请求全部页。 */
  hgObserveLoadMore = () => {
    if (this.hgUsesViewport() || typeof IntersectionObserver === "undefined" || !this.hgLoadSentinel || this.hgLoadObserver) return;
    this.hgLoadObserver = new IntersectionObserver((entries) => {
      this.hgLoadVisible = entries[0]?.isIntersecting ?? false;
      this.hgCheckLoadMore();
    }, { rootMargin: `0px 0px ${HG_LOAD_THRESHOLD}px 0px` });
    this.hgLoadObserver.observe(this.hgLoadSentinel);
  };

  hgSlotRef = (index) => {
    if (!this.hgSlotRefs.has(index)) this.hgSlotRefs.set(index, (node) => this.hgSetSlot(index, node));
    return this.hgSlotRefs.get(index);
  };

  /** 视口宽度变化后清除旧高度；cell 尺寸变化时修正顶部锚点避免列表跳动。 */
  hgOnResize = (entries) => {
    for (const entry of entries) {
      if (entry.target === this.hgViewport.current) {
        this.hgSyncSize();
      } else {
        this.hgMeasureSlot(entry.target);
      }
    }
  };

  hgSyncSize = () => {
    const node = this.hgViewport.current;
    if (!node) return;
    if (node.clientWidth !== this.hgObservedWidth) {
      this.hgObservedWidth = node.clientWidth;
      this.hgHeights.clear();
      this.setState((state) => ({ hgLayoutVersion: state.hgLayoutVersion + 1 }));
    }
    if (node.clientHeight && node.clientHeight !== this.state.hgViewportHeight) {
      this.setState({ hgViewportHeight: node.clientHeight });
    }
  };

  hgMeasureSlot = (node) => {
    const { items, getKey } = this.props;
    const index = Number(node.dataset.index);
    if (!Number.isInteger(index) || index < 0 || index >= items.length) return;
    const key = getKey(items[index], index);
    if (String(key) !== node.dataset.key) return;
    const height = Math.ceil(node.getBoundingClientRect().height);
    if (height <= 0 || this.hgHeights.get(key) === height) return;
    const offsets = hgCollectionOffsets(items, getKey, this.hgHeights);
    const delta = height - (this.hgHeights.get(key) ?? offsets[index + 1] - offsets[index]);
    this.hgHeights.set(key, height);
    const viewport = this.hgViewport.current;
    if (viewport && index < hgCollectionStart(offsets, viewport.scrollTop)) {
      viewport.scrollTop += delta;
      this.setState((state) => ({ hgScrollTop: viewport.scrollTop, hgLayoutVersion: state.hgLayoutVersion + 1 }));
    } else {
      this.setState((state) => ({ hgLayoutVersion: state.hgLayoutVersion + 1 }));
    }
  };

  /** 用数据长度作为自动请求门闩；失败后由页面的错误重试按钮显式重试。 */
  hgCheckLoadMore = () => {
    const { items, hasMore, loading, onLoadMore, pagination } = this.props;
    const node = this.hgViewport.current;
    if (pagination || !node || !items.length || !hasMore || loading || !onLoadMore || this.hgLastLoadLength === items.length) return;
    // IO 回调之后列表可能已变长；每次请求前复核标记位置，避免旧的可见状态连续拉取远处的页。
    const sentinelTop = this.hgLoadSentinel?.getBoundingClientRect?.().top;
    const naturalBottomVisible = this.hgLoadVisible && (sentinelTop == null || typeof window === "undefined" || sentinelTop <= window.innerHeight + HG_LOAD_THRESHOLD);
    if (!this.hgUsesViewport() ? naturalBottomVisible : node.scrollHeight - node.scrollTop - node.clientHeight <= HG_LOAD_THRESHOLD) {
      this.hgLastLoadLength = items.length;
      onLoadMore();
    }
  };

  hgOnScroll = (event) => {
    this.setState({ hgScrollTop: event.currentTarget.scrollTop });
    this.hgCheckLoadMore();
  };

  /** 鼠标拖动列表：保留内部虚拟滚动，到边界时把余量传给页面。 */
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

  /** 按住链接或图片拖动时避免浏览器原生拖拽抢走纵向手势。 */
  hgOnDragStart = (event) => {
    if (this.hgDrag) event.preventDefault();
  };

  hgOnClickCapture = (event) => {
    if (!this.hgSuppressClick) return;
    this.hgSuppressClick = false;
    event.preventDefault();
    event.stopPropagation();
  };

  hgOnTouchStart = (event) => {
    // 页面尚未回到顶部时，向下拖动应先滚动页面，而非误触发列表刷新。
    const pageTop = this.hgViewport.current?.ownerDocument?.scrollingElement?.scrollTop ?? 0;
    this.hgTouchStart = this.hgViewport.current?.scrollTop === 0 && pageTop === 0 && !this.props.loading
      ? event.touches[0].clientY : null;
    this.hgPullDistance = 0;
  };

  hgOnTouchMove = (event) => {
    if (this.hgTouchStart !== null) {
      this.hgPullDistance = Math.max(0, event.touches[0].clientY - this.hgTouchStart);
    }
  };

  hgOnTouchEnd = () => {
    if (this.hgTouchStart !== null && this.hgPullDistance >= HG_PULL_THRESHOLD && !this.props.loading) {
      this.props.onRefresh?.();
    }
    this.hgTouchStart = null;
    this.hgPullDistance = 0;
  };

  /** 系统取消触摸（如来电或切换手势）时不应触发刷新。 */
  hgOnTouchCancel = () => {
    this.hgTouchStart = null;
    this.hgPullDistance = 0;
  };

  /** 归一化 cell 水平对齐值，避免向样式透传无效枚举。 */
  hgCellAlign = () => hgNormalizeCollectionAlign(this.props.align);

  /** 按测量后的累计偏移确定池范围；池编号稳定，内容由业务 key 隔离。 */
  renderSlots = (offsets) => {
    const { items, getKey, renderCell } = this.props;
    const start = hgCollectionStart(offsets, Math.max(0, this.state.hgScrollTop - HG_OVERSCAN));
    let end = start;
    const bottom = this.state.hgScrollTop + this.state.hgViewportHeight + HG_OVERSCAN;
    while (end < items.length && offsets[end] < bottom) end += 1;
    this.hgPoolSize = Math.max(this.hgPoolSize, end - start);
    return Array.from({ length: this.hgPoolSize }, (_, slot) => {
      const index = start + slot;
      const inBounds = index < items.length; // 支持 0、空字符串等有效的基础类型数据。
      const item = inBounds ? items[index] : null;
      return (
        <div
          key={slot}
          ref={this.hgSlotRef(slot)}
          className={styles.slot}
          role={inBounds ? "listitem" : undefined}
          data-index={inBounds ? index : undefined}
          data-key={inBounds ? String(getKey(item, index)) : undefined}
          style={{
            top: inBounds ? offsets[index] : 0,
            display: inBounds ? undefined : "none",
            textAlign: this.hgCellAlign(),
          }}
        >
          {inBounds ? <React.Fragment key={getKey(item, index)}>{renderCell(item, index)}</React.Fragment> : null}
        </div>
      );
    });
  };

  /** 自然高度列表：默认单列随内容排版；传入 columnMinWidth 时按最小列宽自动分列成网格。 */
  renderNaturalSlots = () => {
    const { items, getKey, renderCell, columnMinWidth } = this.props;
    const slots = items.map((item, index) => (
      <div
        key={getKey(item, index)}
        className={styles.naturalSlot}
        role="listitem"
        style={{ textAlign: this.hgCellAlign() }}
      >
        {renderCell(item, index)}
      </div>
    ));
    if (!columnMinWidth) return slots;
    return (
      <div
        className={styles.naturalGrid}
        style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${columnMinWidth}px, 1fr))` }}
      >
        {slots}
      </div>
    );
  };

  /** 页码来自调用方，只有已加载的记录或服务端 hasMore 才允许继续翻页。 */
  renderPagination = () => {
    const { pagination, onChange, loading } = this.props;
    if (!pagination) return null;
    const { current, pageSize, loadedCount, hasMore } = pagination;
    const pageCount = Math.max(current, Math.ceil(loadedCount / pageSize) + (hasMore ? 1 : 0), 1);
    const pages = [];
    for (let page = 1; page <= pageCount; page += 1) {
      if (page === 1 || page === pageCount || Math.abs(page - current) <= 1) pages.push(page);
      else if (pages.at(-1) !== "...") pages.push("...");
    }
    const canNext = hasMore || loadedCount > current * pageSize;
    return (
      <nav className={styles.pagination} aria-label="列表分页">
        <span>已加载 {loadedCount} 条{hasMore ? "，还有更多" : ""}</span>
        <label className={styles.pageSize}>
          每页
          <select value={pageSize} disabled={loading} onChange={(event) => onChange?.({ current: 1, pageSize: Number(event.target.value) })}>
            {[10, 20, 50, 100].map((size) => <option key={size} value={size}>{size} 条</option>)}
          </select>
        </label>
        <button type="button" disabled={loading || current <= 1} onClick={() => onChange?.({ current: current - 1, pageSize })}>
          上一页
        </button>
        {pages.map((page, index) => page === "..." ? <span key={`gap-${index}`}>…</span> : (
          <button key={page} type="button" aria-label={`第 ${page} 页`}
            aria-current={page === current ? "page" : undefined}
            disabled={loading || page === current || (page > current && !hasMore && (page - 1) * pageSize >= loadedCount)}
            onClick={() => onChange?.({ current: page, pageSize })}>{page}</button>
        ))}
        <button type="button" disabled={loading || !canNext} onClick={() => onChange?.({ current: current + 1, pageSize })}>
          下一页
        </button>
      </nav>
    );
  };

  render() {
    const {
      items, getKey, loading, hasMore, pagination,
      width, height, fillHeight, ariaLabel, emptyText, loadedText, // 默认值和用途统一见 defaultProps。
    } = this.props;
    const usesViewport = this.hgUsesViewport(); // 填充/固定视口需要复用池，自然高度时完整渲染。
    const fillsParent = fillHeight && height == null; // 显式 height 优先，避免被父级弹性拉伸。
    const hasExplicitHeight = height != null; // 显式高度约束列表整体，分页与状态栏从中分配空间。
    const offsets = usesViewport ? hgCollectionOffsets(items, getKey, this.hgHeights) : null; // 仅虚拟视口需要累计偏移。
    const containerStyle = width == null && height == null ? undefined : {
      ...(width == null ? {} : { width }),
      ...(height == null ? {} : { height }),
    };
    return (
      <div
        className={`${styles.container} ${fillsParent ? styles.fillContainer : ""} ${hasExplicitHeight ? styles.explicitHeightContainer : ""}`}
        style={containerStyle}
      >
        <div
          ref={this.hgViewport}
          className={`${styles.viewport} ${fillsParent ? styles.fillViewport : ""} ${hasExplicitHeight ? styles.explicitHeightViewport : ""} ${usesViewport ? "" : styles.naturalViewport}`}
          tabIndex={0}
          role="list"
          aria-label={ariaLabel}
          aria-busy={!!loading}
          onScroll={this.hgOnScroll}
          onPointerDown={this.hgOnPointerDown}
          onPointerMove={this.hgOnPointerMove}
          onPointerUp={this.hgOnPointerEnd}
          onPointerCancel={this.hgOnPointerEnd}
          onLostPointerCapture={this.hgOnPointerEnd}
          onDragStart={this.hgOnDragStart}
          onClickCapture={this.hgOnClickCapture}
          onTouchStart={this.hgOnTouchStart}
          onTouchMove={this.hgOnTouchMove}
          onTouchEnd={this.hgOnTouchEnd}
          onTouchCancel={this.hgOnTouchCancel}
        >
          {!usesViewport ? this.renderNaturalSlots() : (
            <div className={styles.spacer} style={{ height: offsets[items.length] }}>
              {this.renderSlots(offsets)}
            </div>
          )}
          {!items.length && <div className={styles.status}>{loading ? "加载中…" : emptyText}</div>}
          {!usesViewport && <div ref={(node) => { this.hgLoadSentinel = node; }} aria-hidden="true" />}
        </div>
        {items.length > 0 && !pagination && <div className={styles.status} role="status">
          {loading ? "加载中…" : hasMore ? "上滑加载更多 · 顶部下拉刷新" : loadedText}
        </div>}
        {pagination && loading && <div className={styles.status} role="status">加载中…</div>}
        {this.renderPagination()}
      </div>
    );
  }
}

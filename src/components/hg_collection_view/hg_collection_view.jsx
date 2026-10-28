import React from "react";
import {
  hgCollectionOffsets,
  hgCollectionStart,
} from "./hg_collection_layout.js";
import styles from "./hg_collection_view.module.css";

const HG_OVERSCAN = 240; // 可视区域上下额外预渲染的像素，减少快速滚动时的空白。
const HG_LOAD_THRESHOLD = 120; // 距底部不足此像素数时触发下一页。
const HG_PULL_THRESHOLD = 70; // 触摸从顶部下拉超过此像素数才刷新。

/**
 * 类似 UICollectionView 的单列变高复用列表。
 * 固定数量的 slot 按池索引复用 DOM；子组件以业务 key 隔离状态，不能跨订单复用业务状态。
 * 数据、游标及网络错误均由调用方管理，组件仅缓存当前挂载期间的高度。
 * 可选 pagination 使用受控页码和每页条数；分页时不再触底自动加载，避免重复翻页。
 */
export default class HGCollectionView extends React.Component {
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

  componentDidMount() {
    if (typeof ResizeObserver !== "undefined") {
      this.hgObserver = new ResizeObserver(this.hgOnResize);
      if (this.hgViewport.current) this.hgObserver.observe(this.hgViewport.current);
      this.hgSlots.forEach((node) => this.hgObserver.observe(node));
    }
    this.hgSyncSize();
    this.hgSlots.forEach((node) => this.hgMeasureSlot(node));
    this.hgCheckLoadMore();
  }

  componentDidUpdate(prevProps) {
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
    this.hgSyncSize();
    this.hgSlots.forEach((node) => this.hgMeasureSlot(node));
    this.hgCheckLoadMore();
  }

  componentWillUnmount() {
    this.hgObserver?.disconnect();
    this.hgSlots.clear();
    this.hgSlotRefs.clear();
    this.hgHeights.clear();
  }

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
    if (node.scrollHeight - node.scrollTop - node.clientHeight <= HG_LOAD_THRESHOLD) {
      this.hgLastLoadLength = items.length;
      onLoadMore();
    }
  };

  hgOnScroll = (event) => {
    this.setState({ hgScrollTop: event.currentTarget.scrollTop });
    this.hgCheckLoadMore();
  };

  hgOnTouchStart = (event) => {
    this.hgTouchStart = this.hgViewport.current?.scrollTop === 0 && !this.props.loading
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
          style={{ top: inBounds ? offsets[index] : 0, display: inBounds ? undefined : "none" }}
        >
          {inBounds ? <React.Fragment key={getKey(item, index)}>{renderCell(item, index)}</React.Fragment> : null}
        </div>
      );
    });
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
      items, getKey, loading, hasMore, onRefresh, pagination,
      height = 520, // 未配置高度时使用 520px 固定视口，保证列表可滚动。
      ariaLabel = "列表", // 未配置时使用通用辅助技术名称；业务页面应覆盖。
    } = this.props;
    const offsets = hgCollectionOffsets(items, getKey, this.hgHeights);
    return (
      <div>
        {onRefresh && <div className={styles.toolbar}>
          <button type="button" onClick={onRefresh} disabled={loading}>刷新</button>
        </div>}
        <div
          ref={this.hgViewport}
          className={styles.viewport}
          style={{ height }}
          tabIndex={0}
          role="list"
          aria-label={ariaLabel}
          aria-busy={!!loading}
          onScroll={this.hgOnScroll}
          onTouchStart={this.hgOnTouchStart}
          onTouchMove={this.hgOnTouchMove}
          onTouchEnd={this.hgOnTouchEnd}
          onTouchCancel={this.hgOnTouchCancel}
        >
          <div className={styles.spacer} style={{ height: offsets[items.length] }}>
            {this.renderSlots(offsets)}
          </div>
          {!items.length && <div className={styles.status}>{loading ? "加载中…" : "暂无数据"}</div>}
        </div>
        {items.length > 0 && !pagination && <div className={styles.status} role="status">
          {loading ? "加载中…" : hasMore ? "上滑加载更多 · 顶部下拉刷新" : "已加载全部订单"}
        </div>}
        {pagination && loading && <div className={styles.status} role="status">加载中…</div>}
        {this.renderPagination()}
      </div>
    );
  }
}

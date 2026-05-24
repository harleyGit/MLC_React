import React from "react";
import styles from "./hg_table.module.css";

/**
 * 默认行高（px）。
 */
const ROW_HEIGHT = 48;

/**
 * 上下缓冲行数。
 */
const BUFFER_ROWS = 5;

/**
 * 默认表体最大高度（px）。
 */
const MAX_BODY_HEIGHT = 500;

/**
 * 单行组件（PureComponent）。
 * 职责：渲染一行中所有单元格。以 poolIndex 为 key 实现 React 级 cell 复用。
 * 原理：poolIndex 不变 → React 复用组件实例和 DOM → 仅更新变化的 props。
 */
class VirtualRow extends React.PureComponent {
  render() {
    const { columns, record, rowIndex } = this.props;
    if (!record) return <div className={styles.row} />;

    return (
      <div className={styles.row}>
        {columns.map((col) => {
          const value = record[col.dataIndex];
          const rendered = col.render ? col.render(value, record, rowIndex) : value;
          return (
            <div
              key={col.dataIndex || col.title}
              className={styles.cell}
              style={col.width ? { width: col.width, flex: `0 0 ${col.width}px` } : undefined}
            >
              {rendered}
            </div>
          );
        })}
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
 *   4. 池大小 = 可见行数 + 缓冲行数，DOM 节点数恒定不随数据量增长；
 *   5. 每个 VirtualRow 通过 poolIndex（identifier）标识，支持多种 cell 类型。
 *
 * 输入：columns, dataSource, rowKey, loading, pagination, onChange, scroll。
 */
class HGTablePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      offset: 0,
    };
    this.scrollRef = React.createRef();
  }

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

  /**
   * 获取表体可视区域高度。
   */
  getBodyHeight = () => {
    const { scroll } = this.props;
    return scroll && scroll.y ? scroll.y : MAX_BODY_HEIGHT;
  };

  /**
   * 滚动事件处理。
   * 职责：计算行偏移量，触发 React 更新复用池中每行显示的数据。
   * 仅在 offset 变化时触发 setState，避免每帧重渲染。
   */
  handleScroll = (e) => {
    const { scrollTop, scrollLeft } = e.target;
    const headerEl = e.target.previousElementSibling;
    if (headerEl) headerEl.scrollLeft = scrollLeft;

    const newOffset = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER_ROWS);
    if (newOffset !== this.state.offset) {
      this.setState({ offset: newOffset });
    }
  };

  /**
   * 触发外部分页变更回调。
   * 格式对齐 antd Table：onChange({ current, pageSize, total })。
   */
  emitChange = (page, size) => {
    const { pagination, onChange } = this.props;
    const total = pagination ? pagination.total || 0 : 0;
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

  /**
   * 渲染分页器。
   */
  renderPagination = () => {
    const { pagination } = this.props;
    if (pagination === false || !pagination) return null;

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
      <div className={styles.pagination}>
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
   * 使用 flex 布局，与表体列宽对齐。
   */
  renderHeader = () => {
    const { columns = [] } = this.props;
    return (
      <div className={styles.headerWrap}>
        <div className={styles.row}>
          {columns.map((col) => (
            <div
              key={col.dataIndex || col.title}
              className={styles.headerCell}
              style={col.width ? { width: col.width, flex: `0 0 ${col.width}px` } : undefined}
            >
              {col.title}
            </div>
          ))}
        </div>
      </div>
    );
  };

  /**
   * 渲染 cell 复用表体。
   *
   * 复用池实现（类 iOS UITableView）：
   *   - 创建 POOL_SIZE 个 VirtualRow，以 poolIndex（identifier）为 key；
   *   - poolIndex 不变 → React 复用组件实例 → DOM 节点常驻内存；
   *   - offset 变化 → 每个 VirtualRow 的 record 和 rowIndex 更新；
   *   - record=null 的行渲染空 div，但保留 DOM（放入缓存池的效果）；
   *   - 新数据进入可视区时，React 通过 poolIndex 找到缓存的 VirtualRow，
   *     仅更新 props（类似 iOS dequeueReusableCellWithIdentifier）。
   */
  renderBody = () => {
    const { columns = [], dataSource = [] } = this.props;
    const { offset } = this.state;
    const bodyHeight = this.getBodyHeight();
    const totalCount = dataSource.length;
    const totalHeight = totalCount * ROW_HEIGHT;
    const poolSize = Math.ceil(bodyHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;

    if (totalCount === 0) {
      return (
        <div className={styles.bodyWrap} style={{ height: bodyHeight }}>
          <div className={styles.emptyCell}>暂无数据</div>
        </div>
      );
    }

    return (
      <div
        className={styles.bodyWrap}
        style={{ height: bodyHeight }}
        ref={this.scrollRef}
        onScroll={this.handleScroll}
      >
        <div className={styles.virtualSpacer} style={{ height: totalHeight }}>
          {Array.from({ length: poolSize }, (_, poolIdx) => {
            const dataIdx = offset + poolIdx;
            const record = dataIdx >= 0 && dataIdx < totalCount ? dataSource[dataIdx] : null;
            return (
              <div
                key={poolIdx}
                className={styles.poolRow}
                style={{
                  top: dataIdx >= 0 ? dataIdx * ROW_HEIGHT : -ROW_HEIGHT,
                  height: ROW_HEIGHT,
                  visibility: record ? "visible" : "hidden",
                }}
              >
                <VirtualRow
                  columns={columns}
                  record={record}
                  rowIndex={dataIdx}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  render() {
    const { className = "" } = this.props;
    return (
      <div className={`${styles.tableContainer} ${className}`}>
        {this.renderLoading()}
        {this.renderHeader()}
        {this.renderBody()}
        {this.renderPagination()}
      </div>
    );
  }
}

export default HGTablePage;

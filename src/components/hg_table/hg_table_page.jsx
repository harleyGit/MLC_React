import React from "react";
import styles from "./hg_table.module.css";

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

/**
 * 默认表体最大高度（px）。
 */
const MAX_BODY_HEIGHT = 500;

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

/**
 * sectionHeader 行组件（PureComponent）。
 * 职责：渲染 section 头部区域。
 */
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
class VirtualRow extends React.PureComponent {
  render() {
    const { columns, record, rowIndex, autoRowHeight } = this.props;
    if (!record) return <div className={styles.row} />;

    return (
      <div className={`${styles.row} ${autoRowHeight ? styles.autoHeightRow : ""}`}>
        {columns.map((col) => {
          const value = record[col.dataIndex];
          const rendered = col.render ? col.render(value, record, rowIndex) : value;
          return (
            <div
              key={col.dataIndex || col.title}
              className={`${styles.cell} ${autoRowHeight ? styles.autoHeightCell : ""}`}
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
 * 输入：columns, dataSource, sections, rowKey, loading, pagination, onChange, scroll。
 */
class HGTablePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      offset: 0,
      scrollTop: 0,
    };
    this.scrollRef = React.createRef();
    this.headerRef = React.createRef();
  }

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

  /**
   * 获取表体可视区域高度。
   */
  getBodyHeight = () => {
    const { scroll } = this.props;
    return scroll && scroll.y ? scroll.y : MAX_BODY_HEIGHT;
  };

  /**
   * 计算列总宽度（含单元格 padding）。
   * 无显式 width 的列按默认 120px 估算。
   */
  getTotalColumnsWidth = () => {
    const { columns = [] } = this.props;
    const CELL_PADDING = 32; // 12px padding * 2
    const DEFAULT_COL_WIDTH = 120;
    return columns.reduce((sum, col) => {
      const w = col.width ? Number(col.width) : DEFAULT_COL_WIDTH;
      return sum + w + CELL_PADDING;
    }, 0);
  };

  /**
   * 滚动事件处理（sections 模式）。
   * 职责：计算虚拟行偏移量与滚动位置，触发 React 更新。
   */
  handleSectionScroll = (e) => {
    const { scrollTop, scrollLeft } = e.target;
    const { sections = [] } = this.props;
    const { items } = flattenSections(sections);

    this.syncHeaderScrollLeft(scrollLeft);

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
    const { scrollTop, scrollLeft } = e.target;
    const { dataSource = [] } = this.props;
    const totalCount = dataSource.length;
    const bodyHeight = this.getBodyHeight();

    this.syncHeaderScrollLeft(scrollLeft);

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
    const { scrollLeft } = e.target;

    this.syncHeaderScrollLeft(scrollLeft);
  };

  /**
   * 同步表头横向滚动位置。
   * 职责：统一处理不同表体渲染模式的表头联动，避免依赖 DOM 兄弟关系失效。
   */
  syncHeaderScrollLeft = (scrollLeft) => {
    if (this.headerRef.current) {
      this.headerRef.current.scrollLeft = scrollLeft;
    }
  };

  /**
   * 触发外部分页变更回调。
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
   */
  renderHeader = () => {
    const { columns = [] } = this.props;
    const totalWidth = this.getTotalColumnsWidth();
    return (
      <div className={styles.headerWrap} ref={this.headerRef}>
        <div className={styles.row} style={{ minWidth: totalWidth }}>
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
    const { sections = [], columns = [] } = this.props;
    const { offset, scrollTop } = this.state;
    const bodyHeight = this.getBodyHeight();
    const { items, totalHeight, sectionMetas } = flattenSections(sections);
    const totalWidth = this.getTotalColumnsWidth();

    if (items.length === 0) {
      return (
        <div className={styles.bodyWrap} style={{ height: bodyHeight }}>
          <div className={styles.emptyCell}>暂无数据</div>
        </div>
      );
    }

    const poolSize = Math.ceil(bodyHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
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
        style={{ height: bodyHeight }}
        ref={this.scrollRef}
        onScroll={this.handleSectionScroll}
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
    const { columns = [], dataSource = [] } = this.props;
    const { offset } = this.state;
    const bodyHeight = this.getBodyHeight();
    const totalCount = dataSource.length;
    const totalHeight = totalCount * ROW_HEIGHT;
    const poolSize = Math.ceil(bodyHeight / ROW_HEIGHT) + BUFFER_ROWS * 2;
    const totalWidth = this.getTotalColumnsWidth();

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
        <div className={styles.virtualSpacer} style={{ height: totalHeight, minWidth: totalWidth }}>
          {Array.from({ length: poolSize }, (_, poolIdx) => {
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
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  /**
   * 渲染自然行高表体。
   * 职责：用于少量分页数据需要完整换行展示的场景，避免固定行高虚拟列表裁切内容。
   */
  renderAutoRowHeightBody = () => {
    const { columns = [], dataSource = [] } = this.props;
    const bodyHeight = this.getBodyHeight();
    const totalWidth = this.getTotalColumnsWidth();

    if (dataSource.length === 0) {
      return (
        <div
          className={`${styles.bodyWrap} ${styles.autoHeightBodyWrap}`}
          style={{ maxHeight: bodyHeight }}
          ref={this.scrollRef}
          onScroll={this.handleAutoRowHeightScroll}
        >
          <div className={styles.emptyCell}>暂无数据</div>
        </div>
      );
    }

    return (
      <div
        className={`${styles.bodyWrap} ${styles.autoHeightBodyWrap}`}
        style={{ maxHeight: bodyHeight }}
        ref={this.scrollRef}
        onScroll={this.handleAutoRowHeightScroll}
      >
        <div className={styles.autoHeightBodyInner} style={{ minWidth: totalWidth }}>
          {dataSource.map((record, rowIndex) => (
            <VirtualRow
              key={this.getRowKey(record, rowIndex)}
              columns={columns}
              record={record}
              rowIndex={rowIndex}
              autoRowHeight
            />
          ))}
        </div>
      </div>
    );
  };

  render() {
    const { className = "", autoRowHeight = true } = this.props;
    const useSections = this.isSectionMode();
    const tableClassName = `${styles.tableContainer} ${autoRowHeight ? styles.autoHeightTableContainer : ""} ${className}`;

    return (
      <div className={tableClassName}>
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

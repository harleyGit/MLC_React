import React from "react";
import styles from "./hg_table.module.css";

/**
 * 自定义表格组件，替代 antd Table。
 * 职责：根据 columns 和 dataSource 渲染可交互表格，支持自定义渲染、分页、loading。
 * 输入：columns, dataSource, rowKey, loading, pagination, onChange。
 * 约束：columns 格式为 [{title, dataIndex, width?, render?}]，dataSource 为对象数组。
 */
class HGTablePage extends React.Component {
  /**
   * 获取行唯一 key。
   * @param {object} record - 行数据。
   * @param {number} index - 行索引。
   * @returns {string} 行唯一标识。
   */
  getRowKey = (record, index) => {
    const { rowKey } = this.props;
    if (typeof rowKey === "function") {
      return rowKey(record);
    }
    if (typeof rowKey === "string" && record[rowKey] !== undefined) {
      return String(record[rowKey]);
    }
    return String(index);
  };

  /**
   * 渲染 loading 遮罩层。
   * @returns {React.ReactNode} loading 节点或 null。
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
   * @returns {React.ReactNode} 分页节点或 null。
   */
  renderPagination = () => {
    const { pagination } = this.props;
    if (pagination === false) return null;
    if (!pagination) return null;

    const {
      current = 1,
      pageSize = 10,
      total = 0,
      showSizeChanger = false,
      showQuickJumper = false,
      onChange,
      onShowSizeChange,
    } = pagination;

    const totalPages = Math.max(1, Math.ceil(total / pageSize));

    /**
     * 触发页码变更。
     * @param {number} page - 目标页码。
     */
    const handleChangePage = (page) => {
      if (page < 1 || page > totalPages || page === current) return;
      if (onChange) {
        onChange(page, pageSize);
      }
    };

    /**
     * 触发每页条数变更。
     * @param {number} size - 新的每页条数。
     */
    const handleSizeChange = (size) => {
      if (onShowSizeChange) {
        onShowSizeChange(current, size);
      } else if (onChange) {
        onChange(1, size);
      }
    };

    /**
     * 生成页码按钮列表（最多 7 个，含省略号）。
     * @returns {Array<number|string>} 页码数组。
     */
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

    const startItem = (current - 1) * pageSize + 1;
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
   * 渲染表格主体。
   * @returns {React.ReactNode} table 元素。
   */
  renderTable = () => {
    const { columns = [], dataSource = [] } = this.props;

    return (
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead className={styles.thead}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.dataIndex || col.title}
                  className={styles.th}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.title}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className={styles.tbody}>
            {dataSource.length === 0 ? (
              <tr>
                <td className={styles.emptyCell} colSpan={columns.length}>
                  暂无数据
                </td>
              </tr>
            ) : (
              dataSource.map((record, rowIndex) => {
                const key = this.getRowKey(record, rowIndex);
                return (
                  <tr key={key} className={styles.tr}>
                    {columns.map((col) => {
                      const value = record[col.dataIndex];
                      const rendered = col.render
                        ? col.render(value, record, rowIndex)
                        : value;
                      return (
                        <td
                          key={col.dataIndex || col.title}
                          className={styles.td}
                          style={col.width ? { width: col.width } : undefined}
                        >
                          {rendered}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  render() {
    const { className = "" } = this.props;

    return (
      <div className={`${styles.tableContainer} ${className}`}>
        {this.renderLoading()}
        {this.renderTable()}
        {this.renderPagination()}
      </div>
    );
  }
}

export default HGTablePage;

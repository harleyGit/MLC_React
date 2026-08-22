import React, { Component } from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGTaskVM, { CRAWLER_TASK_PAGE_SIZE } from "./hg_task_vm";
import styles from "./hg_task_page.module.css";

/**
 * HGTaskPage 提供任务筛选、游标分页和手动触发能力。
 * cursorByPage 保存“前端页码 -> 后端 cursor”映射，使自定义表格仍可展示页码而后端避免深分页。
 */
class HGTaskPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: [],
      loading: false,
      cursorByPage: { 1: 0 },
      pagination: { current: 1, pageSize: CRAWLER_TASK_PAGE_SIZE, total: 0 },
    };
  }

  /** 页面挂载后从首页 cursor=0 开始读取任务。 */
  componentDidMount() {
    this.loadTasks(1, CRAWLER_TASK_PAGE_SIZE);
  }

  /**
   * 按前端页码读取已缓存的 cursor，再请求后端有界任务列表。
   * 后端只有 hasMore 而没有精确总数时，total 只合成到下一页，防止用户跳转到未知深页。
   * @param {number} page 前端页码。
   * @param {number} pageSize 每页条数。
   */
  loadTasks = (page, pageSize) => {
    const cursor = this.state.cursorByPage[page] || 0;
    this.setState({ loading: true });
    HGTaskVM.fetchTasks({ cursor, pageSize })
      .then((result) => this.setState((prev) => ({
        rows: result?.list || [],
        cursorByPage: {
          ...prev.cursorByPage,
          ...(result?.hasMore ? { [page + 1]: result.nextCursor } : {}),
        },
        pagination: {
          current: page,
          pageSize,
          total: HGTaskVM.total({ page, pageSize, count: result?.list?.length || 0, hasMore: result?.hasMore }),
        },
      })))
      .catch((error) => message.error(getRequestErrorMessage(error, "任务列表获取失败")))
      .finally(() => this.setState({ loading: false }));
  };

  /**
   * 处理表格页码和 pageSize 变化；修改 pageSize 后必须从 cursor=0 重新构建分页链。
   * @param {Object} next HGTablePage 分页参数。
   */
  handleTableChange = (next) => {
    if (next.pageSize !== this.state.pagination.pageSize) {
      this.setState({ cursorByPage: { 1: 0 } }, () => this.loadTasks(1, next.pageSize));
      return;
    }
    this.loadTasks(next.current, next.pageSize);
  };

  /** @returns {Array<Object>} 任务表格列配置。 */
  getColumns = () => [
    { title: "任务 ID", dataIndex: "id", width: 110 }, { title: "任务名称", dataIndex: "name", width: 190 }, { title: "平台", dataIndex: "platform", width: 100 },
    { title: "解析类型", dataIndex: "parserType", width: 160 }, { title: "Item Selector", dataIndex: "itemPath", width: 190 },
    { title: "调度", dataIndex: "cron", width: 150, render: (value, row) => row.enabled ? value || "-" : "手动" },
    { title: "最近状态", dataIndex: "lastRunStatus", width: 110, render: (value) => <span className={`${styles.status} ${styles[`status${String(value).toUpperCase()}`] || ""}`}>{HGTaskVM.statusText(value)}</span> },
    { title: "最近数据量", dataIndex: "lastRunItemCount", width: 100 },
    { title: "更新时间", dataIndex: "updatedAt", width: 190, render: (value) => value ? new Date(value).toLocaleString() : "-" },
    { title: "最近错误", dataIndex: "lastRunError", width: 260, render: (value) => <span title={value} className={styles.errorCell}>{value || "-"}</span> },
  ];

  /** @returns {React.ReactNode} 任务管理页面。 */
  render() { const { loading, pagination, rows } = this.state; return <div><div className={styles.header}><div><p>TASK ORCHESTRATION</p><h1>任务管理</h1><span>持久化任务定义是权威配置，最近运行结果随定义展示</span></div><HGButtonPage type="primary" onClick={() => this.props.onNavigate?.("crawler_task_create")}>新建采集任务</HGButtonPage></div><HGCardPage title="任务定义"><HGTablePage rowKey={(row) => row.id} columns={this.getColumns()} dataSource={rows} loading={loading} pagination={{ ...pagination, showSizeChanger: true }} onChange={this.handleTableChange} scroll={{ y: 410, x: 1500 }} /></HGCardPage></div>; }
}
export default HGTaskPage;

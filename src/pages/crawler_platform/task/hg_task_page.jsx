import React, { Component } from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGSelectPage from "../../../components/hg_select/hg_select_page";
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
      creating: false,
      status: "",
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
    HGTaskVM.fetchTasks({ cursor, pageSize, status: this.state.status })
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
   * 更新状态筛选并清空旧 cursor 映射，避免用“全部任务”的 cursor 查询过滤后的结果集。
   * @param {string} status 任务状态枚举，空字符串表示全部。
   */
  handleStatus = (status = "") => this.setState(
    { status, cursorByPage: { 1: 0 } },
    () => this.loadTasks(1, this.state.pagination.pageSize)
  );

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

  /**
   * 手动创建一次 Bilibili 推荐任务。
   * 成功后回到首页刷新，因为新任务始终插入任务列表最前端。
   */
  createTask = () => {
    this.setState({ creating: true });
    HGTaskVM.createTask()
      .then(() => {
        message.success("Bilibili 推荐采集完成");
        this.setState({ cursorByPage: { 1: 0 } }, () => this.loadTasks(1, this.state.pagination.pageSize));
      })
      .catch((error) => message.error(getRequestErrorMessage(error, "任务执行失败或已有任务运行中")))
      .finally(() => this.setState({ creating: false }));
  };

  /** @returns {Array<Object>} 任务表格列配置。 */
  getColumns = () => [
    { title: "任务 ID", dataIndex: "id", width: 155 }, { title: "类型", dataIndex: "type", width: 130 }, { title: "平台", dataIndex: "platform", width: 100 },
    { title: "优先级", dataIndex: "priority", width: 80 }, { title: "状态", dataIndex: "status", width: 100, render: (value) => <span className={`${styles.status} ${styles[`status${value}`] || ""}`}>{HGTaskVM.statusText(value)}</span> },
    { title: "数据量", dataIndex: "itemCount", width: 90 }, { title: "耗时", dataIndex: "costMillis", width: 100, render: (value) => `${value || 0} ms` },
    { title: "创建时间", dataIndex: "createdAt", width: 190, render: (value) => value ? new Date(value).toLocaleString() : "-" },
    { title: "错误", dataIndex: "error", width: 280, render: (value) => <span title={value} className={styles.errorCell}>{value || "-"}</span> },
  ];

  /** @returns {React.ReactNode} 任务管理页面。 */
  render() { const { loading, creating, status, pagination, rows } = this.state; return <div><div className={styles.header}><div><p>TASK ORCHESTRATION</p><h1>任务管理</h1><span>手动任务同步返回结果，周期任务由单 worker 串行执行</span></div><HGButtonPage type="primary" loading={creating} onClick={this.createTask}>立即采集 Bilibili 推荐</HGButtonPage></div><HGCardPage title="运行记录" extra={<div className={styles.filters}><span>状态</span><HGSelectPage value={status} options={[{ value: "", label: "全部" }, { value: "RUNNING", label: "运行中" }, { value: "SUCCESS", label: "成功" }, { value: "FAILED", label: "失败" }]} onChange={this.handleStatus} /></div>}><HGTablePage rowKey={(row) => row.id} columns={this.getColumns()} dataSource={rows} loading={loading} pagination={{ ...pagination, showSizeChanger: true }} onChange={this.handleTableChange} scroll={{ y: 410 }} /></HGCardPage></div>; }
}
export default HGTaskPage;

import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import styles from "./hg_task_page.module.css";
import HGTaskVM, { CRAWLER_TASK_PAGE_SIZE } from "./hg_task_vm";

/** HGTaskPage 展示持久化任务定义，并提供创建、编辑和详情入口。 */
class HGTaskPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: [],
      loading: false,
      cursorByPage: { 1: 0 },
      pagination: { current: 1, pageSize: CRAWLER_TASK_PAGE_SIZE, total: 0 },
    };
    this.requestSequence = 0;
    this.unmounted = false;
  }

  componentDidMount() {
    this.loadTasks(1, CRAWLER_TASK_PAGE_SIZE);
  }

  componentWillUnmount() {
    this.unmounted = true;
  }

  /** 按已缓存 cursor 加载一页任务，过期响应不会覆盖用户最后一次翻页。 */
  loadTasks = (page, pageSize) => {
    const cursor = this.state.cursorByPage[page] ?? 0;
    const sequence = ++this.requestSequence;
    this.setState({ loading: true });
    HGTaskVM.fetchTasks({ cursor, pageSize })
      .then((result) => {
        if (this.unmounted || sequence !== this.requestSequence) return;
        this.setState((prev) => ({
          rows: result?.list || [],
          cursorByPage: {
            ...prev.cursorByPage,
            ...(result?.hasMore ? { [page + 1]: result.nextCursor } : {}),
          },
          pagination: {
            current: page,
            pageSize,
            total: HGTaskVM.total({
              page,
              pageSize,
              count: result?.list?.length || 0,
              hasMore: result?.hasMore,
            }),
          },
        }));
      })
      .catch((error) => {
        if (!this.unmounted && sequence === this.requestSequence) {
          message.error(getRequestErrorMessage(error, "任务列表获取失败"));
        }
      })
      .finally(() => {
        if (!this.unmounted && sequence === this.requestSequence) this.setState({ loading: false });
      });
  };

  /** pageSize 变化时重建 cursor 链，普通翻页直接使用已记录的后端 cursor。 */
  handleTableChange = (next) => {
    if (next.pageSize !== this.state.pagination.pageSize) {
      this.setState({ cursorByPage: { 1: 0 } }, () => this.loadTasks(1, next.pageSize));
      return;
    }
    this.loadTasks(next.current, next.pageSize);
  };

  /** 进入隐藏的创建/编辑叶子页；该页面不再占用侧边菜单项。 */
  navigateToEditor = (task = null) => this.props.onNavigate?.("crawler_task_create", task ? { task } : null);

  /** 从持久化 JSON 配置中读取请求超时。 */
  getTimeoutSeconds = (row) => Math.max(1, Number(row?.configuration?.request?.timeoutMs || 10000) / 1000);

  /** 任务定义列表只展示用户要求的六组业务字段。 */
  getColumns = () => [
    { title: "任务名称", dataIndex: "name", width: 220 },
    {
      title: "数据源",
      dataIndex: "platform",
      width: 150,
      render: (value) => ({ bilibili: "Bilibili", custom: "自定义 HTTP" }[value] || value || "-"),
    },
    {
      title: "执行方式",
      dataIndex: "cron",
      width: 210,
      render: (value, row) => (row.enabled ? `定时：${value || "-"}` : "手动执行"),
    },
    {
      title: "执行限制",
      dataIndex: "maxItems",
      width: 190,
      render: (value, row) => `${this.getTimeoutSeconds(row)} 秒 / 最多 ${value || 0} 条`,
    },
    {
      title: "编辑任务",
      dataIndex: "id",
      width: 110,
      render: (_, row) => <HGButtonPage type="link" onClick={() => this.navigateToEditor(row)}>编辑</HGButtonPage>,
    },
    {
      title: "查看任务详情",
      dataIndex: "detail",
      width: 140,
      render: (_, row) => (
        <HGButtonPage
          type="link"
          onClick={() => this.props.onNavigate?.("crawler_task_detail", { task: row })}
        >
          查看详情
        </HGButtonPage>
      ),
    },
  ];

  render() {
    const { loading, pagination, rows } = this.state;
    return (
      <div>
        <div className={styles.header}>
          <div>
            <p>TASK ORCHESTRATION</p>
            <h1>任务管理</h1>
            <span>新建或编辑采集任务，保存后列表自动读取 MySQL 中的最新定义</span>
          </div>
          <HGButtonPage type="primary" onClick={() => this.navigateToEditor()}>新建采集任务</HGButtonPage>
        </div>
        <HGCardPage title="采集任务列表">
          <HGTablePage
            rowKey={(row) => row.id}
            columns={this.getColumns()}
            dataSource={rows}
            loading={loading}
            pagination={{ ...pagination, showSizeChanger: true }}
            onChange={this.handleTableChange}
            scroll={{ y: 440, x: 1020 }}
          />
        </HGCardPage>
      </div>
    );
  }
}

export default HGTaskPage;

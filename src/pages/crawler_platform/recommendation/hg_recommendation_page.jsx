import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import styles from "./hg_recommendation_page.module.css";
import HGRecommendationVM from "./hg_recommendation_vm";

/** HGRecommendationPage 分页展示采集任务，并通过导航进入任务采集数据页。 */
class HGRecommendationPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      taskRows: [],
      loading: false,
      taskCursorByPage: { 1: 0 },
      taskPagination: {
        current: 1,
        pageSize: HGRecommendationVM.taskPageSize,
        total: 0,
      },
    };
    this.requestSequence = 0;
    this.unmounted = false;
  }

  componentDidMount() {
    this.loadTasks(1, HGRecommendationVM.taskPageSize);
  }

  componentWillUnmount() {
    this.unmounted = true;
  }

  /** 请求序列确保快速翻页时只提交最后一次响应。 */
  nextSequence = () => ++this.requestSequence;

  loadTasks = (page, pageSize) => {
    const cursor = this.state.taskCursorByPage[page] ?? 0;
    const sequence = this.nextSequence();
    this.setState({ loading: true });
    HGRecommendationVM.fetchTasks({ cursor, pageSize })
      .then((result) => {
        if (this.unmounted || sequence !== this.requestSequence) return;
        this.setState((prev) => ({
          taskRows: result.list,
          taskCursorByPage: {
            ...prev.taskCursorByPage,
            ...(result.hasMore ? { [page + 1]: result.nextCursor } : {}),
          },
          taskPagination: {
            current: page,
            pageSize,
            total: HGRecommendationVM.total({
              page,
              pageSize,
              count: result.list.length,
              hasMore: result.hasMore,
            }),
          },
        }));
      })
      .catch((error) => {
        if (!this.unmounted && sequence === this.requestSequence)
          message.error(getRequestErrorMessage(error, "采集任务获取失败"));
      })
      .finally(() => {
        if (!this.unmounted && sequence === this.requestSequence)
          this.setState({ loading: false });
      });
  };

  handleTaskPageChange = (next) => {
    if (next.pageSize !== this.state.taskPagination.pageSize) {
      this.setState({ taskCursorByPage: { 1: 0 } }, () =>
        this.loadTasks(1, next.pageSize)
      );
      return;
    }
    this.loadTasks(next.current, next.pageSize);
  };

  getTaskColumns = () => [
    { title: "任务名称", dataIndex: "name", width: 220 },
    { title: "数据源", dataIndex: "platform", width: 130 },
    {
      title: "执行方式",
      dataIndex: "cron",
      width: 210,
      render: (value, row) => (row.enabled ? `定时：${value}` : "手动执行"),
    },
    {
      title: "最近状态",
      dataIndex: "lastRunStatus",
      width: 120,
      render: (value) => value || "未运行",
    },
    { title: "最近数据量", dataIndex: "lastRunItemCount", width: 120 },
    {
      title: "查看采集数据",
      dataIndex: "action",
      width: 140,
      render: (_, row) => (
        <HGButtonPage
          type="link"
          onClick={() =>
            this.props.onNavigate?.("crawler_recommendation_detail", { task: row })
          }
        >
          查看数据
        </HGButtonPage>
      ),
    },
  ];

  renderTaskList = () => {
    const { loading, taskRows, taskPagination } = this.state;
    return (
      <HGCardPage title="采集任务列表">
        <HGTablePage
          rowKey={(row) => row.id}
          columns={this.getTaskColumns()}
          dataSource={taskRows}
          loading={loading}
          pagination={{ ...taskPagination, showSizeChanger: true }}
          onChange={this.handleTaskPageChange}
          scroll={{ y: 460, x: 980 }}
        />
      </HGCardPage>
    );
  };

  render() {
    return (
      <div>
        <div className={styles.header}>
          <div>
            <p>COLLECTED DATA</p>
            <h1>采集结果</h1>
            <span>先选择采集任务，再分页查看该任务写入的标准化数据字段</span>
          </div>
        </div>
        {this.renderTaskList()}
      </div>
    );
  }
}

export default HGRecommendationPage;

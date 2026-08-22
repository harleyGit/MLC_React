import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import styles from "./hg_recommendation_page.module.css";
import HGRecommendationVM, { CRAWLER_CONTENT_PAGE_SIZE } from "./hg_recommendation_vm";

/** HGRecommendationPage 先分页展示采集任务，再分页查看该任务关联的采集内容。 */
class HGRecommendationPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      selectedTask: null,
      taskRows: [],
      contentRows: [],
      loading: false,
      taskCursorByPage: { 1: 0 },
      contentCursorByPage: { 1: 0 },
      taskPagination: { current: 1, pageSize: HGRecommendationVM.taskPageSize, total: 0 },
      contentPagination: { current: 1, pageSize: CRAWLER_CONTENT_PAGE_SIZE, total: 0 },
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

  /** 通用请求序列确保任务和内容快速切换时只提交最后一次响应。 */
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
          taskCursorByPage: { ...prev.taskCursorByPage, ...(result.hasMore ? { [page + 1]: result.nextCursor } : {}) },
          taskPagination: {
            current: page,
            pageSize,
            total: HGRecommendationVM.total({ page, pageSize, count: result.list.length, hasMore: result.hasMore }),
          },
        }));
      })
      .catch((error) => {
        if (!this.unmounted && sequence === this.requestSequence) message.error(getRequestErrorMessage(error, "采集任务获取失败"));
      })
      .finally(() => {
        if (!this.unmounted && sequence === this.requestSequence) this.setState({ loading: false });
      });
  };

  loadContents = (task, page, pageSize) => {
    const cursor = this.state.contentCursorByPage[page] ?? 0;
    const sequence = this.nextSequence();
    this.setState({ loading: true });
    HGRecommendationVM.fetchContents({ taskId: task.id, cursor, pageSize })
      .then((result) => {
        if (this.unmounted || sequence !== this.requestSequence) return;
        this.setState((prev) => ({
          contentRows: result.list,
          contentCursorByPage: { ...prev.contentCursorByPage, ...(result.hasMore ? { [page + 1]: result.nextCursor } : {}) },
          contentPagination: {
            current: page,
            pageSize,
            total: HGRecommendationVM.total({ page, pageSize, count: result.list.length, hasMore: result.hasMore }),
          },
        }));
      })
      .catch((error) => {
        if (!this.unmounted && sequence === this.requestSequence) message.error(getRequestErrorMessage(error, "任务采集数据获取失败"));
      })
      .finally(() => {
        if (!this.unmounted && sequence === this.requestSequence) this.setState({ loading: false });
      });
  };

  selectTask = (task) => this.setState({
    selectedTask: task,
    contentRows: [],
    contentCursorByPage: { 1: 0 },
    contentPagination: { current: 1, pageSize: CRAWLER_CONTENT_PAGE_SIZE, total: 0 },
  }, () => this.loadContents(task, 1, CRAWLER_CONTENT_PAGE_SIZE));

  handleTaskPageChange = (next) => {
    if (next.pageSize !== this.state.taskPagination.pageSize) {
      this.setState({ taskCursorByPage: { 1: 0 } }, () => this.loadTasks(1, next.pageSize));
      return;
    }
    this.loadTasks(next.current, next.pageSize);
  };

  handleContentPageChange = (next) => {
    if (next.pageSize !== this.state.contentPagination.pageSize) {
      this.setState({ contentCursorByPage: { 1: 0 } }, () => this.loadContents(this.state.selectedTask, 1, next.pageSize));
      return;
    }
    this.loadContents(this.state.selectedTask, next.current, next.pageSize);
  };

  getTaskColumns = () => [
    { title: "任务名称", dataIndex: "name", width: 220 },
    { title: "数据源", dataIndex: "platform", width: 130 },
    { title: "执行方式", dataIndex: "cron", width: 210, render: (value, row) => (row.enabled ? `定时：${value}` : "手动执行") },
    { title: "最近状态", dataIndex: "lastRunStatus", width: 120, render: (value) => value || "未运行" },
    { title: "最近数据量", dataIndex: "lastRunItemCount", width: 120 },
    { title: "查看采集数据", dataIndex: "action", width: 140, render: (_, row) => <HGButtonPage type="link" onClick={() => this.selectTask(row)}>查看数据</HGButtonPage> },
  ];

  renderContent = (_, row) => (
    <div className={styles.contentCell}>
      {row.coverUrl ? <img src={row.coverUrl} alt="" loading="lazy" referrerPolicy="no-referrer" /> : <div className={styles.coverFallback}>NO COVER</div>}
      <div><strong title={row.title}>{row.title || "未命名内容"}</strong><span>{row.authorName || "未知作者"} · {row.contentId || "-"}</span></div>
    </div>
  );

  getContentColumns = () => [
    { title: "内容", dataIndex: "title", width: 360, render: this.renderContent },
    { title: "播放", dataIndex: "viewCount", width: 100, render: HGRecommendationVM.countText },
    { title: "点赞", dataIndex: "likeCount", width: 100, render: HGRecommendationVM.countText },
    { title: "评论", dataIndex: "commentCount", width: 100, render: HGRecommendationVM.countText },
    { title: "时长", dataIndex: "durationSeconds", width: 90, render: HGRecommendationVM.durationText },
    { title: "发布时间", dataIndex: "publishedAt", width: 180, render: (value) => (value ? new Date(value).toLocaleString() : "-") },
    { title: "最近采集", dataIndex: "lastSeenAt", width: 180, render: (value) => (value ? new Date(value).toLocaleString() : "-") },
    { title: "原站", dataIndex: "targetUrl", width: 90, render: (value) => (value ? <a className={styles.sourceLink} href={value} target="_blank" rel="noreferrer noopener">查看</a> : "-") },
  ];

  renderTaskList = () => {
    const { loading, taskRows, taskPagination } = this.state;
    return <HGCardPage title="采集任务列表"><HGTablePage rowKey={(row) => row.id} columns={this.getTaskColumns()} dataSource={taskRows} loading={loading} pagination={{ ...taskPagination, showSizeChanger: true }} onChange={this.handleTaskPageChange} scroll={{ y: 460, x: 980 }} /></HGCardPage>;
  };

  renderContentList = () => {
    const { selectedTask, loading, contentRows, contentPagination } = this.state;
    return (
      <>
        <div className={styles.detailHeader}><HGButtonPage onClick={() => this.setState({ selectedTask: null, contentRows: [] })}>返回任务列表</HGButtonPage><div><p>TASK DATA</p><h2>{selectedTask.name}</h2><span>{selectedTask.platform} · 任务 ID {selectedTask.id}</span></div></div>
        <HGCardPage title="采集数据字段列表" extra={<span className={styles.note}>按任务关联记录倒序分页</span>}>
          <HGTablePage rowKey={(row) => row.associationId} columns={this.getContentColumns()} dataSource={contentRows} loading={loading} pagination={{ ...contentPagination, showSizeChanger: true }} onChange={this.handleContentPageChange} scroll={{ y: 470, x: 1200 }} />
        </HGCardPage>
      </>
    );
  };

  render() {
    return (
      <div>
        <div className={styles.header}><div><p>COLLECTED DATA</p><h1>采集结果</h1><span>先选择采集任务，再分页查看该任务写入的标准化数据字段</span></div></div>
        {this.state.selectedTask ? this.renderContentList() : this.renderTaskList()}
      </div>
    );
  }
}

export default HGRecommendationPage;

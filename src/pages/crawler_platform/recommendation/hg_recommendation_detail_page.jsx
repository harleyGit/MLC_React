import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import styles from "./hg_recommendation_page.module.css";
import HGRecommendationVM, {
  CRAWLER_CONTENT_PAGE_SIZE,
} from "./hg_recommendation_vm";

/** HGRecommendationDetailPage 分页展示从任务列表导航进入的任务采集内容。 */
class HGRecommendationDetailPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      rows: [],
      loading: false,
      cursorByPage: { 1: 0 },
      pagination: {
        current: 1,
        pageSize: CRAWLER_CONTENT_PAGE_SIZE,
        total: 0,
      },
    };
    this.requestSequence = 0;
    this.unmounted = false;
  }

  componentDidMount() {
    const task = this.props.pageContext?.task;
    if (task?.id) this.loadContents(1, CRAWLER_CONTENT_PAGE_SIZE);
  }

  componentWillUnmount() {
    this.unmounted = true;
  }

  /** 按已缓存 cursor 加载当前任务的一页采集内容。 */
  loadContents = (page, pageSize) => {
    const task = this.props.pageContext?.task;
    if (!task?.id) return;
    const cursor = this.state.cursorByPage[page] ?? 0;
    const sequence = ++this.requestSequence;
    this.setState({ loading: true });
    HGRecommendationVM.fetchContents({ taskId: task.id, cursor, pageSize })
      .then((result) => {
        if (this.unmounted || sequence !== this.requestSequence) return;
        this.setState((prev) => ({
          rows: result.list,
          cursorByPage: {
            ...prev.cursorByPage,
            ...(result.hasMore ? { [page + 1]: result.nextCursor } : {}),
          },
          pagination: {
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
        if (!this.unmounted && sequence === this.requestSequence) {
          message.error(getRequestErrorMessage(error, "任务采集数据获取失败"));
        }
      })
      .finally(() => {
        if (!this.unmounted && sequence === this.requestSequence) {
          this.setState({ loading: false });
        }
      });
  };

  /** 每页条数变化时重建 cursor 链，普通翻页使用已记录 cursor。 */
  handlePageChange = (next) => {
    if (next.pageSize !== this.state.pagination.pageSize) {
      this.setState({ cursorByPage: { 1: 0 } }, () =>
        this.loadContents(1, next.pageSize)
      );
      return;
    }
    this.loadContents(next.current, next.pageSize);
  };

  renderContent = (_, row) => (
    <div className={styles.contentCell}>
      {row.coverUrl ? (
        <img
          src={row.coverUrl}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      ) : (
        <div className={styles.coverFallback}>NO COVER</div>
      )}
      <div>
        <strong title={row.title}>{row.title || "未命名内容"}</strong>
        <span>
          {row.authorName || "未知作者"} · {row.contentId || "-"}
        </span>
      </div>
    </div>
  );

  getColumns = () => [
    { title: "内容", dataIndex: "title", width: 360, render: this.renderContent },
    { title: "播放", dataIndex: "viewCount", width: 100, render: HGRecommendationVM.countText },
    { title: "点赞", dataIndex: "likeCount", width: 100, render: HGRecommendationVM.countText },
    { title: "评论", dataIndex: "commentCount", width: 100, render: HGRecommendationVM.countText },
    { title: "时长", dataIndex: "durationSeconds", width: 90, render: HGRecommendationVM.durationText },
    {
      title: "发布时间",
      dataIndex: "publishedAt",
      width: 180,
      render: (value) => (value ? new Date(value).toLocaleString() : "-"),
    },
    {
      title: "最近采集",
      dataIndex: "lastSeenAt",
      width: 180,
      render: (value) => (value ? new Date(value).toLocaleString() : "-"),
    },
    {
      title: "原站",
      dataIndex: "targetUrl",
      width: 90,
      render: (value) => value ? (
        <a className={styles.sourceLink} href={value} target="_blank" rel="noreferrer noopener">
          查看
        </a>
      ) : "-",
    },
  ];

  render() {
    const task = this.props.pageContext?.task;
    const { loading, pagination, rows } = this.state;
    if (!task?.id) {
      return (
        <HGCardPage title="任务采集数据">
          <div className={styles.empty}>未找到任务上下文，请返回采集结果重新选择任务。</div>
          <HGButtonPage onClick={() => this.props.onNavigate?.("crawler_recommendations")}>
            返回采集结果
          </HGButtonPage>
        </HGCardPage>
      );
    }

    return (
      <div>
        <div className={styles.detailHeader}>
          <HGButtonPage onClick={() => this.props.onNavigate?.("crawler_recommendations")}>
            返回任务列表
          </HGButtonPage>
          <div>
            <p>TASK DATA</p>
            <h2>{task.name}</h2>
            <span>{task.platform} · 任务 ID {task.id}</span>
          </div>
        </div>
        <HGCardPage
          title="采集数据字段列表"
          extra={<span className={styles.note}>按任务关联记录倒序分页</span>}
        >
          <HGTablePage
            rowKey={(row) => row.associationId}
            columns={this.getColumns()}
            dataSource={rows}
            loading={loading}
            pagination={{ ...pagination, showSizeChanger: true }}
            onChange={this.handlePageChange}
            scroll={{ y: 470, x: 1200 }}
          />
        </HGCardPage>
      </div>
    );
  }
}

export default HGRecommendationDetailPage;

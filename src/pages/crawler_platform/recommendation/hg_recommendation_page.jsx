import React, { Component } from "react";
import { getRequestErrorMessage } from "../../../api/hg_request_error";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import styles from "./hg_recommendation_page.module.css";
import HGRecommendationVM from "./hg_recommendation_vm";

/**
 * HGRecommendationPage 展示最近一次成功任务产出的标准化推荐快照。
 * 页面只读且直接链接原站，不代理媒体内容；请求失败时保留已有 rows，避免短暂故障导致操作台闪空。
 */
class HGRecommendationPage extends Component {
  constructor(props) {
    super(props);
    this.state = { rows: [], loading: false, refreshedAt: null };
    // requestSequence 用于丢弃慢请求的过期响应，防止连续点击刷新时旧结果覆盖新结果。
    this.requestSequence = 0;
    this.unmounted = false;
  }

  /** 页面挂载后自动读取最近成功快照。 */
  componentDidMount() {
    this.loadRecommendations();
  }

  /** 标记页面已卸载，异步请求完成后不再调用 setState。 */
  componentWillUnmount() {
    this.unmounted = true;
  }

  /**
   * 加载最新推荐快照。
   * 只有最后发起的请求可以提交状态，确保高延迟网络下的刷新顺序与用户操作顺序一致。
   */
  loadRecommendations = () => {
    const sequence = ++this.requestSequence;
    this.setState({ loading: true });
    HGRecommendationVM.fetchRecommendations()
      .then((result) => {
        if (this.unmounted || sequence !== this.requestSequence) return;
        this.setState({
          rows: HGRecommendationVM.rows(result),
          refreshedAt: new Date(),
        });
      })
      .catch((error) => {
        if (this.unmounted || sequence !== this.requestSequence) return;
        message.error(getRequestErrorMessage(error, "采集结果获取失败"));
      })
      .finally(() => {
        if (!this.unmounted && sequence === this.requestSequence)
          this.setState({ loading: false });
      });
  };

  /** @returns {React.ReactNode} 标题、作者和封面的组合展示。 */
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

  /** @returns {Array<Object>} 采集结果表格列配置。 */
  getColumns = () => [
    {
      title: "内容",
      dataIndex: "title",
      width: 360,
      render: this.renderContent,
    },
    {
      title: "播放",
      dataIndex: "viewCount",
      width: 110,
      render: HGRecommendationVM.countText,
    },
    {
      title: "点赞",
      dataIndex: "likeCount",
      width: 100,
      render: HGRecommendationVM.countText,
    },
    {
      title: "弹幕",
      dataIndex: "commentCount",
      width: 100,
      render: HGRecommendationVM.countText,
    },
    {
      title: "时长",
      dataIndex: "durationSeconds",
      width: 90,
      render: HGRecommendationVM.durationText,
    },
    {
      title: "发布时间",
      dataIndex: "publishedAt",
      width: 190,
      render: (value) => (value ? new Date(value).toLocaleString() : "-"),
    },
    {
      title: "原站",
      dataIndex: "targetUrl",
      width: 100,
      render: (value) =>
        value ? (
          <a
            className={styles.sourceLink}
            href={value}
            target="_blank"
            rel="noreferrer noopener"
          >
            查看
          </a>
        ) : (
          "-"
        ),
    },
  ];

  /** @returns {React.ReactNode} 最近成功采集结果页面。 */
  render() {
    const { rows, loading, refreshedAt } = this.state;
    return (
      <div>
        <div className={styles.header}>
          <div>
            <p>COLLECTED DATA</p>
            <h1>采集结果</h1>
            <span>
              查看最近一次成功任务产出的公开元数据快照，不下载或代理媒体文件
            </span>
          </div>
          <HGButtonPage loading={loading} onClick={this.loadRecommendations}>
            刷新快照
          </HGButtonPage>
        </div>
        <div className={styles.summary}>
          <div>
            <span>快照记录</span>
            <strong>{rows.length}</strong>
          </div>
          <div>
            <span>数据来源</span>
            <strong>Bilibili Public API</strong>
          </div>
          <div>
            <span>页面刷新</span>
            <strong>
              {refreshedAt ? refreshedAt.toLocaleTimeString() : "等待加载"}
            </strong>
          </div>
        </div>
        <HGCardPage
          title="最新成功快照"
          extra={
            <span className={styles.note}>失败任务不会覆盖上一份可用数据</span>
          }
        >
          <HGTablePage
            rowKey={(row) => `${row.platform}:${row.contentId}`}
            columns={this.getColumns()}
            dataSource={rows}
            loading={loading}
            pagination={false}
            scroll={{ y: 480 }}
          />
          {!loading && rows.length === 0 ? (
            <div className={styles.empty}>
              尚无成功采集快照，请先在任务管理中执行推荐采集。
            </div>
          ) : null}
        </HGCardPage>
      </div>
    );
  }
}

export default HGRecommendationPage;

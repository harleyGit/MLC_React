import React, { Component } from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import HGDashboardVM from "./hg_dashboard_vm";
import styles from "./hg_dashboard_page.module.css";

/**
 * HGDashboardPage 展示采集任务、worker 和最近抓取趋势。
 * 页面只维护展示状态，接口请求与字段兼容由 HGDashboardVM 负责。
 */
class HGDashboardPage extends Component {
  constructor(props) {
    super(props);
    this.state = { ...HGDashboardVM.emptyData(), loading: false };
  }

  /** 页面挂载后立即读取一次 crawler 内存快照。 */
  componentDidMount() {
    this.loadDashboard();
  }

  /**
   * 刷新 Dashboard 数据。
   * loading 同时驱动刷新按钮和最近任务表格，失败时保留上一份可用数据而不是清空页面。
   */
  loadDashboard = () => {
    this.setState({ loading: true });
    HGDashboardVM.fetchDashboard()
      .then((result) => this.setState(HGDashboardVM.normalize(result)))
      .catch(() => message.error("采集指标获取失败，请确认 hg_crawler 服务已启动"))
      .finally(() => this.setState({ loading: false }));
  };

  /**
   * 渲染任务、成功率相关核心指标卡。
   * @returns {React.ReactNode} 响应式指标卡网格。
   */
  renderStatCards = () => {
    const { stats } = this.state;
    const cards = [
      ["任务总数", stats.total, "全部运行记录"], ["成功任务", stats.success, "最近成功采集"],
      ["失败任务", stats.failed, "需要排查的任务"], ["在线 Worker", stats.workers, "独立采集进程"],
      ["推荐快照", stats.recommendations, "最新公开视频元数据"],
    ];
    return (
      <div className={styles.statsGrid}>
        {cards.map(([label, value, note]) => (
          <div className={styles.statCard} key={label}>
            <span>{label}</span>
            <strong>{Number(value || 0).toLocaleString()}</strong>
            <small>{note}</small>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 使用原生 SVG 绘制最近任务采集量趋势。
   * x 轴按任务顺序等距分布，y 轴按当前窗口最大值归一化，避免引入额外图表依赖。
   * @returns {React.ReactNode} 趋势卡片。
   */
  renderTrend = () => {
    const points = this.state.trend;
    const maxValue = Math.max(1, ...points.map((item) => Number(item.value || 0)));
    const polyline = points.map((item, index) => `${points.length <= 1 ? 50 : (index / (points.length - 1)) * 100},${92 - (Number(item.value || 0) / maxValue) * 72}`).join(" ");
    return (
      <HGCardPage title="采集趋势" extra={<span className={styles.liveLabel}>LIVE SNAPSHOT</span>}>
        <div className={styles.chart}>
          <svg viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="crawlerArea" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#25a49a" stopOpacity=".36" />
                <stop offset="1" stopColor="#25a49a" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={`M 0 100 L ${polyline || "0,92"} L 100 100 Z`} fill="url(#crawlerArea)" />
            <polyline points={polyline || "0,92 100,92"} fill="none" stroke="#168d84" strokeWidth="2" vectorEffect="non-scaling-stroke" />
          </svg>
          {points.length === 0 ? <div className={styles.emptyChart}>执行任务后生成趋势</div> : null}
        </div>
      </HGCardPage>
    );
  };

  /**
   * 构建最近任务表格列。
   * @returns {Array<Object>} HGTablePage 列配置。
   */
  getColumns = () => [
    { title: "任务 ID", dataIndex: "id", width: 150 }, { title: "平台", dataIndex: "platform", width: 110 },
    { title: "状态", dataIndex: "status", width: 100, render: (value) => <span className={`${styles.status} ${styles[`status${value}`] || ""}`}>{HGDashboardVM.statusText(value)}</span> },
    { title: "数据量", dataIndex: "itemCount", width: 90 }, { title: "耗时", dataIndex: "costMillis", width: 100, render: (value) => `${value || 0} ms` },
    { title: "创建时间", dataIndex: "createdAt", width: 190, render: (value) => value ? new Date(value).toLocaleString() : "-" },
  ];

  /** @returns {React.ReactNode} Dashboard 页面。 */
  render() {
    return <div><header className={styles.pageHeader}><div><p>DATA COLLECTION PLATFORM</p><h1>采集运行概览</h1><span>对公开元数据执行有界、可取消、可观察的采集任务</span></div><HGButtonPage loading={this.state.loading} onClick={this.loadDashboard}>刷新指标</HGButtonPage></header>{this.renderStatCards()}<div className={styles.mainGrid}>{this.renderTrend()}<HGCardPage title="运行策略"><dl className={styles.policy}><div><dt>数据边界</dt><dd>仅公开元数据</dd></div><div><dt>媒体文件</dt><dd>不下载、不代理</dd></div><div><dt>默认限流</dt><dd>0.2 req/s</dd></div><div><dt>响应上限</dt><dd>2 MiB</dd></div></dl></HGCardPage></div><HGCardPage title="最近任务" extra={<span className={styles.tableNote}>最多展示 8 条</span>}><HGTablePage rowKey={(row) => row.id} columns={this.getColumns()} dataSource={this.state.tasks} loading={this.state.loading} pagination={false} scroll={{ y: 300 }} /></HGCardPage></div>;
  }
}

export default HGDashboardPage;

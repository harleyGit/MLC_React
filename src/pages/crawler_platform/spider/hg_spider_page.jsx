import React, { Component } from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import { hgMessage as message } from "../../../components/hg_message/hg_message_page";
import HGSpacePage from "../../../components/hg_space/hg_space_page";
import HGTablePage from "../../../components/hg_table/hg_table_page";
import HGSpiderVM from "./hg_spider_vm";
import styles from "./hg_spider_page.module.css";

/**
 * HGSpiderPage 管理已授权平台的数据采集 worker。
 * actionId 只锁定当前操作行，避免一个 Spider 的启停请求阻塞其他行的展示和刷新。
 */
class HGSpiderPage extends Component {
  constructor(props) {
    super(props);
    this.state = { rows: [], loading: false, actionId: "" };
  }

  /** 页面挂载后读取 worker 状态。 */
  componentDidMount() {
    this.loadSpiders();
  }

  /**
   * 获取 Spider 列表并标准化空响应。
   * 请求失败时保留已有 rows，避免短暂网络错误造成表格闪空。
   */
  loadSpiders = () => {
    this.setState({ loading: true });
    HGSpiderVM.fetchSpiders()
      .then((result) => this.setState({ rows: HGSpiderVM.rows(result) }))
      .catch(() => message.error("Spider 列表获取失败"))
      .finally(() => this.setState({ loading: false }));
  };

  /**
   * 执行指定 Spider 的 start/stop 操作并刷新权威状态。
   * @param {Object} row 当前 Spider 行。
   * @param {"start"|"stop"} action HGSpiderVM 操作名。
   */
  runAction = (row, action) => {
    this.setState({ actionId: row.id });
    HGSpiderVM[action](row.id)
      .then(() => {
        message.success(action === "start" ? "Spider 已启动" : "Spider 已停止");
        this.loadSpiders();
      })
      .catch(() => message.error("Spider 操作失败"))
      .finally(() => this.setState({ actionId: "" }));
  };

  /** @returns {Array<Object>} Spider 表格列配置。 */
  getColumns = () => [
    { title: "Spider", dataIndex: "name", width: 260, render: (value, row) => <div><strong>{value}</strong><small className={styles.subText}>{row.id} · {row.type}</small></div> },
    { title: "状态", dataIndex: "status", width: 120, render: (value) => <span className={`${styles.status} ${value === "RUNNING" ? styles.running : styles.stopped}`}>{value}</span> },
    { title: "Worker", dataIndex: "workers", width: 90 }, { title: "QPS 上限", dataIndex: "qpsLimit", width: 110 },
    { title: "调度周期", dataIndex: "intervalSeconds", width: 120, render: (value) => `${value}s` },
    { title: "最后成功", dataIndex: "lastSuccessAt", width: 190, render: (value) => value && !String(value).startsWith("0001") ? new Date(value).toLocaleString() : "尚未执行" },
    { title: "操作", dataIndex: "actions", width: 190, render: (_, row) => <HGSpacePage><HGButtonPage type="primary" size="small" disabled={row.status === "RUNNING"} loading={this.state.actionId === row.id && row.status !== "RUNNING"} onClick={() => this.runAction(row, "start")}>启动</HGButtonPage><HGButtonPage size="small" danger disabled={row.status !== "RUNNING"} onClick={() => this.runAction(row, "stop")}>停止</HGButtonPage></HGSpacePage> },
  ];

  /** @returns {React.ReactNode} Spider 管理页面。 */
  render() { return <div><div className={styles.header}><div><p>SPIDER FLEET</p><h1>Spider 管理</h1><span>一个独立进程只运行一个有界 worker，避免多副本请求放大</span></div><HGButtonPage loading={this.state.loading} onClick={this.loadSpiders}>刷新</HGButtonPage></div><HGCardPage><HGTablePage rowKey="id" columns={this.getColumns()} dataSource={this.state.rows} loading={this.state.loading} pagination={false} scroll={{ y: 360 }} /></HGCardPage><div className={styles.notice}><strong>平台扩展约束</strong><span>Douyin 与 Xiaohongshu 仅保留平台适配位置，必须在获得正式 API 授权、签名方案和合规评审后启用。</span></div></div>; }
}
export default HGSpiderPage;

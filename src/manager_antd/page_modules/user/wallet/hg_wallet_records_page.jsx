import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../../router/hg_router_path";
import HGWalletVM, { formatHGYuanFromFen } from "./hg_wallet_vm.js";
import styles from "./hg_wallet_page.module.css";

/**
 * 独立充值记录页；钱包可用 hgPreview 嵌入相同记录预览，避免维护两套请求与金额展示逻辑。
 * props.location：由路由适配器或钱包传入，无默认值；key 变化时重新读取首页。
 * hgPreview 在同一次挂载中保持固定，全部记录由独立路由重新挂载展示。
 */
export default class HGWalletRecordsPage extends React.Component {
  static defaultProps = {
    hgPreview: false, // 默认展示完整记录页和分页；true 时仅展示钱包最近 50 条预览。
    hgRefreshKey: 0, // 外部刷新版本，默认 0；值变化时重读首页，不作为请求参数。
  };

  state = {
    hgRecords: [], // 当前页充值订单，默认空数组；每次最多保留 50 条。
    hgRecordsPage: 1, // 当前游标页的展示序号，从 1 开始，不表示服务端总页数。
    hgRecordsCursorHistory: [""], // 各已访问页的请求游标；空字符串代表首页，用于上一页导航。
    hgRecordsNextCursor: "", // 服务端下一页的不透明游标；空字符串表示没有可用下一页游标。
    hgRecordsHasMore: false, // 是否存在下一页，由服务端返回；首次查询前默认 false。
    hgRecordsLoading: false, // 当前页是否正在加载，默认 false；用于禁用分页并展示加载提示。
    hgRecordsError: "", // 当前页查询错误文案；空字符串表示没有错误。
  };
  hgMounted = false; // 挂载标记，卸载后禁止晚到请求更新页面。
  hgRecordsRequestId = 0; // 递增请求代次，刷新或卸载后旧响应自动失效。
  hgRecordsBusy = false; // 同步请求门闩，避免 setState 生效前重复点击翻页。

  /** 初次加载并监听返回页面；预览和完整页均只查询记录，不查询余额。 */
  componentDidMount() {
    this.hgMounted = true;
    this.hgRefreshRecords();
    window.addEventListener("pageshow", this.hgRefreshRecords);
    window.addEventListener("focus", this.hgRefreshRecords);
  }

  /** 路由位置或钱包手动刷新版本改变时，重置到最新记录的首页。 */
  componentDidUpdate(hgPrevious) {
    if (hgPrevious.hgRefreshKey !== this.props.hgRefreshKey || hgPrevious.location?.key !== this.props.location?.key)
      this.hgRefreshRecords();
  }

  /** 撤销写回权限并解除监听；请求链尚不支持外部取消，晚到结果只丢弃。 */
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRecordsRequestId += 1;
    window.removeEventListener("pageshow", this.hgRefreshRecords);
    window.removeEventListener("focus", this.hgRefreshRecords);
  }

  /** 重新从首页读取，丢弃此前翻页时积累的游标链。 */
  hgRefreshRecords = () => this.hgLoadRecords("", 1, [""]);

  /** cursor 默认空字符串表示首页，page 默认 1；游标历史只用于本地向前翻页。 */
  hgLoadRecords = (hgCursor = "", hgPage = 1, hgCursorHistory = [""]) => {
    if (!this.hgMounted) return;
    // 本次请求代次；只允许最后发出的请求提交结果或清除加载状态。
    const hgRequestId = ++this.hgRecordsRequestId;
    this.hgRecordsBusy = true;
    this.setState({
      hgRecordsLoading: true,
      hgRecordsError: "",
      hgRecords: [],
      hgRecordsPage: hgPage,
      hgRecordsCursorHistory: hgCursorHistory,
      hgRecordsNextCursor: "",
      hgRecordsHasMore: false,
    });
    return HGWalletVM.getRechargeRecords(hgCursor, 50).then((hgResult) => {
      if (!this.hgMounted || hgRequestId !== this.hgRecordsRequestId) return;
      if (!Array.isArray(hgResult?.list) || typeof hgResult.hasMore !== "boolean" ||
          typeof hgResult.nextCursor !== "string" || (hgResult.hasMore &&
          (!hgResult.nextCursor || hgResult.nextCursor === hgCursor || hgResult.nextCursor === "0")))
        throw new Error("充值记录响应异常，请重试");
      this.setState({
        hgRecords: hgResult.list.slice(0, 50),
        hgRecordsNextCursor: hgResult.nextCursor,
        hgRecordsHasMore: hgResult.hasMore,
      });
    }).catch((hgError) => {
      if (this.hgMounted && hgRequestId === this.hgRecordsRequestId)
        this.setState({ hgRecordsError: HGWalletVM.errorMessage(hgError) });
    }).finally(() => {
      if (hgRequestId === this.hgRecordsRequestId) this.hgRecordsBusy = false;
      if (this.hgMounted && hgRequestId === this.hgRecordsRequestId)
        this.setState({ hgRecordsLoading: false });
    });
  };

  /** 错误重试沿用失败页的游标，不误跳回首页。 */
  hgRetryRecords = () => !this.hgRecordsBusy && this.hgLoadRecords(
    this.state.hgRecordsCursorHistory[this.state.hgRecordsPage - 1] || "",
    this.state.hgRecordsPage,
    this.state.hgRecordsCursorHistory
  );

  /** 下一页仅供独立记录页使用，原样透传服务端游标。 */
  hgLoadNextRecords = () => {
    // 当前页的分页快照；字段语义与 state 定义一致，不把游标转换为数字。
    const { hgRecordsNextCursor, hgRecordsPage, hgRecordsCursorHistory, hgRecordsLoading } = this.state;
    if (!this.props.hgPreview && !this.hgRecordsBusy && !hgRecordsLoading && this.state.hgRecordsHasMore && hgRecordsNextCursor)
      return this.hgLoadRecords(hgRecordsNextCursor, hgRecordsPage + 1, [...hgRecordsCursorHistory, hgRecordsNextCursor]);
  };

  /** 上一页只使用已访问页的游标，并丢弃其后的过期游标链。 */
  hgLoadPreviousRecords = () => {
    // 当前页码及已访问游标，读取同一状态快照以保证回退位置一致。
    const { hgRecordsPage, hgRecordsCursorHistory, hgRecordsLoading } = this.state;
    if (!this.props.hgPreview && !this.hgRecordsBusy && !hgRecordsLoading && hgRecordsPage > 1)
      return this.hgLoadRecords(hgRecordsCursorHistory[hgRecordsPage - 2] || "", hgRecordsPage - 1, hgRecordsCursorHistory.slice(0, -1));
  };

  /** paid 才表示已入账，其他订单状态按后端语义展示。 */
  getRecordStatus = (hgRecord) => ({
    pending: "待支付", expired: "已过期", paid: "已入账", cancelled: "已取消",
    processing: "处理中", refunding: "退款中", refunded: "已退款",
  }[hgRecord?.status] || "状态未知");

  /** 将服务端时间转换为本地时间，非法值明确展示为未知。 */
  formatRecordTime = (hgTime) => {
    // 当前记录时间的日期对象，仅用于展示，不参与排序或游标计算。
    const hgDate = new Date(hgTime);
    return Number.isFinite(hgDate.getTime()) ? hgDate.toLocaleString("zh-CN", { hour12: false }) : "时间未知";
  };

  /** 单条记录保持金额和币数的字符串精度；订单编号是稳定列表 key。 */
  renderRecord = (hgRecord) => (
    <article className={styles.recordRow} key={hgRecord.orderId}>
      <div className={styles.recordMain}>
        <strong>{hgRecord.title || "充值"}</strong>
        <small>订单号：{hgRecord.orderId}</small>
        <small>创建时间：{this.formatRecordTime(hgRecord.createdAt)}</small>
        {hgRecord.paidAt && <small>支付时间：{this.formatRecordTime(hgRecord.paidAt)}</small>}
        <small>{hgRecord.paymentMode === "platform_debug" ? "debug 模拟充值，不扣人民币" : "支付渠道不可用"}</small>
      </div>
      <div className={styles.recordCoin}>订单币数：{typeof hgRecord.totalCoin === "string" && /^\d+$/.test(hgRecord.totalCoin) ? hgRecord.totalCoin : "--"} M币</div>
      <div className={styles.recordAmount}>
        {hgRecord.currency === "CNY" ? `¥${formatHGYuanFromFen(hgRecord.payAmount)}` : "金额未知"}
        <small className={hgRecord.status === "paid" ? styles.paidStatus : styles.pendingStatus}>{this.getRecordStatus(hgRecord)}</small>
      </div>
    </article>
  );

  /** 分别展示错误、加载中、空页和记录列表，错误时保留原页重试入口。 */
  renderRecordsContent = () => {
    // 当前记录及请求展示状态，空数组与查询失败分开呈现。
    const { hgRecords, hgRecordsLoading, hgRecordsError } = this.state;
    if (hgRecordsError) return <div className={styles.emptyState} role="alert">
      <strong>充值记录加载失败</strong><p>{hgRecordsError}</p>
      <button type="button" className={styles.retryButton} onClick={this.hgRetryRecords}>重新加载</button>
    </div>;
    if (hgRecordsLoading) return <div className={styles.emptyState} role="status"><p>正在加载充值记录...</p></div>;
    if (hgRecords.length === 0) return <div className={styles.emptyState}>
      <div className={styles.emptyIcon} aria-hidden="true">◎</div>
      <strong>本页暂无充值记录</strong><p>这里展示充值订单，不代表所有订单均已入账</p>
    </div>;
    return <div className={styles.recordList}>{hgRecords.map(this.renderRecord)}</div>;
  };

  /** 只在独立页展示游标分页，空页也保留可用的上一页与下一页。 */
  renderPager = () => {
    if (this.props.hgPreview) return null;
    // 分页按钮所需的当前页、更多标志和加载状态，不推算总页数。
    const { hgRecordsPage, hgRecordsHasMore, hgRecordsLoading } = this.state;
    return <nav className={styles.recordPager} aria-label="充值记录分页">
      <button type="button" className={styles.pageButton} disabled={hgRecordsPage <= 1 || hgRecordsLoading} onClick={this.hgLoadPreviousRecords}>上一页</button>
      <span aria-live="polite">第 {hgRecordsPage} 页</span>
      <button type="button" className={styles.pageButton} disabled={!hgRecordsHasMore || hgRecordsLoading} onClick={this.hgLoadNextRecords}>下一页</button>
    </nav>;
  };

  /** 最近记录的“查看全部”是独立路由链接，保留浏览器后退及修饰键打开能力。 */
  renderTransactionRecords = () => (
    <section className={styles.recordsSection}>
      <div className={styles.sectionHeading}>
        <div><p className={styles.sectionEyebrow}>ACCOUNT ACTIVITY</p><h2>{this.props.hgPreview ? "充值记录" : "全部充值记录"}</h2></div>
        {this.props.hgPreview ? <Link className={styles.moreButton} to={ROUTE_PATH.WALLET_RECORDS}>
          查看全部 <span aria-hidden="true">›</span>
        </Link> : <button type="button" className={styles.retryButton} disabled={this.state.hgRecordsLoading} onClick={this.hgRefreshRecords}>刷新记录</button>}
      </div>
      <p className={styles.serviceNotice}>{this.props.hgPreview ? "最近充值记录，最多 50 条" : "全部充值记录，每页 50 条"}，时间为本地时间</p>
      {this.renderRecordsContent()}
      {this.renderPager()}
    </section>
  );

  /** 独立页提供明确的钱包返回链接，直接访问或刷新也可以返回。 */
  renderHeader = () => (
    <header className={styles.header}>
      <Link className={styles.backButton} to={ROUTE_PATH.WALLET}><span aria-hidden="true">‹</span>我的钱包</Link>
      <div className={styles.headerInner}>
        <div className={styles.brandMark} aria-hidden="true">M</div>
        <div><p className={styles.eyebrow}>MLC PAYMENT CENTER</p><h1>充值记录</h1></div>
      </div>
    </header>
  );

  /** 独立页仅承载记录；钱包余额与充值入口保留在钱包路由。 */
  renderMainContent = () => <main className={styles.main}>{this.renderTransactionRecords()}</main>;

  /** 预览作为钱包区块，默认则组合独立页面的页头和主体。 */
  render() {
    if (this.props.hgPreview) return this.renderTransactionRecords();
    return <div className={styles.page}>{this.renderHeader()}{this.renderMainContent()}</div>;
  }
}

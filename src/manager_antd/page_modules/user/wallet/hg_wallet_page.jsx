import React from "react";
import { PAGE } from "../../../../components/hg_navigation/hg_page_registry";
import { hgMessage } from "../../../../components/hg_message/hg_message_page";
import HGUserProfileStorage from "../../../storage/hg_user_profile_storage";
import styles from "./hg_wallet_page.module.css";
import HGWalletVM, { formatHGYuanFromFen } from "./hg_wallet_vm.js";

/**
 * 我的钱包页：展示当前用户的资产概览、充值入口和充值记录。
 */
class HGWalletPage extends React.Component {
  state = {
    hgBalance: null,
    hgBalanceError: "",
    hgRecords: [],
    hgRecordsMode: "recent",
    hgRecordsPage: 1,
    hgRecordsCursorHistory: [""],
    hgRecordsNextCursor: "",
    hgRecordsHasMore: false,
    hgRecordsLoading: false,
    hgRecordsError: "",
  };
  hgMounted = false;
  hgRecordsRequestId = 0;
  hgRecordsBusy = false;

  /** 读取权威币余额；请求链不支持外部取消，卸载时作废返回结果。 */
  componentDidMount() {
    this.hgMounted = true;
    this.hgRefreshBalance();
    window.addEventListener("pageshow", this.hgRefreshBalance);
    window.addEventListener("focus", this.hgRefreshBalance);
  }

  /** 返回路由或恢复浏览器页面时重读余额，旧请求不可覆盖后发请求。 */
  componentDidUpdate(hgPrevious) {
    if (hgPrevious.location?.key !== this.props.location?.key) this.hgRefreshBalance();
  }

  hgRefreshBalance = () => {
    if (!this.hgMounted) return;
    const hgRequest = this.hgRequest = {};
    this.setState({ hgBalanceError: "" });
    this.hgLoadRecords("", 1, [""]);
    HGWalletVM.getBalance().then((hgResult) => {
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgBalance: hgResult.balance });
    }).catch((hgError) => {
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgBalanceError: HGWalletVM.errorMessage(hgError) });
    });
  };

  /** 记录请求按代次提交，focus 或快速翻页时旧响应不能覆盖当前游标页。 */
  hgLoadRecords = (hgCursor = "", hgPage = 1, hgCursorHistory = [""]) => {
    if (!this.hgMounted) return;
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
    HGWalletVM.getRechargeRecords(hgCursor, 50).then((hgResult) => {
      if (!this.hgMounted || hgRequestId !== this.hgRecordsRequestId) return;
      if (!Array.isArray(hgResult?.list) || typeof hgResult.hasMore !== "boolean" ||
          typeof hgResult.nextCursor !== "string" || (hgResult.hasMore &&
          (!hgResult.nextCursor || hgResult.nextCursor === hgCursor || hgResult.nextCursor === "0")))
        throw new Error("充值记录响应异常，请重试");
      this.setState({
        hgRecords: hgResult.list.slice(0, 50),
        hgRecordsNextCursor: typeof hgResult?.nextCursor === "string" ? hgResult.nextCursor : "",
        hgRecordsHasMore: hgResult?.hasMore === true,
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

  hgRetryRecords = () => !this.hgRecordsBusy && this.hgLoadRecords(
    this.state.hgRecordsCursorHistory[this.state.hgRecordsPage - 1] || "",
    this.state.hgRecordsPage,
    this.state.hgRecordsCursorHistory
  );

  hgShowAllRecords = () => {
    const hgMode = this.state.hgRecordsMode === "all" ? "recent" : "all";
    this.setState({ hgRecordsMode: hgMode });
    this.hgLoadRecords("", 1, [""]);
  };

  hgLoadNextRecords = () => {
    const { hgRecordsNextCursor, hgRecordsPage, hgRecordsCursorHistory, hgRecordsLoading } = this.state;
    if (!this.hgRecordsBusy && !hgRecordsLoading && this.state.hgRecordsMode === "all" && this.state.hgRecordsHasMore && hgRecordsNextCursor)
      this.hgLoadRecords(hgRecordsNextCursor, hgRecordsPage + 1, [...hgRecordsCursorHistory, hgRecordsNextCursor]);
  };

  hgLoadPreviousRecords = () => {
    const { hgRecordsPage, hgRecordsCursorHistory, hgRecordsLoading } = this.state;
    if (!this.hgRecordsBusy && !hgRecordsLoading && hgRecordsPage > 1)
      this.hgLoadRecords(hgRecordsCursorHistory[hgRecordsPage - 2] || "", hgRecordsPage - 1, hgRecordsCursorHistory.slice(0, -1));
  };

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequest = null;
    this.hgRecordsRequestId += 1;
    window.removeEventListener("pageshow", this.hgRefreshBalance);
    window.removeEventListener("focus", this.hgRefreshBalance);
  }
  /**
   * 使用已有用户资料缓存展示名称，不将展示名称用作订单归属依据。
   */
  getUserDisplayName = () => {
    const profile = HGUserProfileStorage.getUserProfile() || {};
    return profile.nickname || profile.username || profile.userName || "用户";
  };

  /**
   * 返回账号设置页，保留用户从钱包回到个人中心的明确路径。
   */
  handleBack = () => {
    this.props.pageNavigator?.open({ page: PAGE.EDIT_USER_INFO });
  };

  /** 两个入口共用充值会话；回调只发全局通知，返回后由新挂载的钱包读取余额。 */
  handleRecharge = () => {
    this.props.pageNavigator?.open({
      page: PAGE.WALLET_RECHARGE,
      params: { source: "wallet" },
      onSuccess: () => hgMessage.success("充值成功，平台币已入账。"),
    });
  };

  /** 渲染钱包页头及返回入口。 */
  renderHeader = () => {
    const displayName = this.getUserDisplayName();
    return (
      <header className={styles.header}>
        <button type="button" className={styles.backButton} onClick={this.handleBack}>
          <span aria-hidden="true">‹</span>
          账号设置
        </button>
        <div className={styles.headerInner}>
          <div className={styles.brandMark} aria-hidden="true">
            M
          </div>
          <div>
            <p className={styles.eyebrow}>MLC PAYMENT CENTER</p>
            <h1>我的钱包</h1>
          </div>
          <div className={styles.userBadge}>
            <span className={styles.userDot} aria-hidden="true" />
            {displayName}
          </div>
        </div>
      </header>
    );
  };

  /** 余额单位是平台币，不能当成人民币元展示。 */
  renderBalanceCard = () => {
    return (
      <section className={styles.balanceCard}>
        <div className={styles.balanceCopy}>
          <p className={styles.cardLabel}>账户余额</p>
          <div className={styles.balanceValue}>
            {this.state.hgBalance ?? "--"}<span className={styles.currency}> M币</span>
          </div>
          <p className={styles.balanceHint}>{this.state.hgBalanceError || "平台币余额，以服务端记录为准"}</p>
        </div>
        <div className={styles.walletIllustration} aria-hidden="true">
          <span className={`${styles.coin} ${styles.coinOne}`}>M</span>
          <span className={`${styles.coin} ${styles.coinTwo}`}>M</span>
          <span className={styles.walletShape} />
        </div>
        <div className={styles.balanceActions}>
          <button type="button" className={styles.primaryButton} onClick={this.handleRecharge}>
            充值
          </button>
          <button type="button" className={styles.ghostButton} disabled>
            提现（暂未开放）
          </button>
          <button type="button" className={styles.ghostButton} onClick={this.hgRefreshBalance}>刷新余额与记录</button>
        </div>
      </section>
    );
  };

  /** 渲染钱包快捷服务入口。 */
  renderQuickServices = () => {
    return (
      <section className={styles.quickSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>QUICK ACCESS</p>
            <h2>快捷服务</h2>
          </div>
          <span className={styles.sectionNote}>安全、透明、便捷</span>
        </div>
        <div className={styles.quickGrid}>
          <button type="button" className={styles.quickCard} onClick={this.handleRecharge}>
            <span className={`${styles.quickIcon} ${styles.blueIcon}`}>＋</span>
            <span>
              <strong>充值中心</strong>
              <small>选择档位生成订单</small>
            </span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </button>
          <button type="button" className={styles.quickCard} disabled>
            <span className={`${styles.quickIcon} ${styles.purpleIcon}`}>↗</span>
            <span>
              <strong>消费记录</strong>
              <small>暂不可查询</small>
            </span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </button>
          <button type="button" className={styles.quickCard} disabled>
            <span className={`${styles.quickIcon} ${styles.orangeIcon}`}>?</span>
            <span>
              <strong>钱包帮助</strong>
              <small>使用规则待开放</small>
            </span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </button>
        </div>
      </section>
    );
  };

  /** 将后端状态转成用户可理解的短文案，paid 才显示已入账。 */
  getRecordStatus = (hgRecord) => ({
    pending: "待支付", expired: "已过期", paid: "已入账", cancelled: "已取消",
    processing: "处理中", refunding: "退款中", refunded: "已退款",
  }[hgRecord?.status] || "状态未知");

  /** 充值记录金额均来自字符串分值，不能先转 Number。 */
  getRecordAmount = (hgRecord) => formatHGYuanFromFen(hgRecord?.payAmount);

  formatRecordTime = (hgTime) => {
    const hgDate = new Date(hgTime);
    return Number.isFinite(hgDate.getTime()) ? hgDate.toLocaleString("zh-CN", { hour12: false }) : "时间未知";
  };

  /** 渲染充值记录、错误重试和无总数游标分页。 */
  renderTransactionRecords = () => {
    const { hgRecords, hgRecordsMode, hgRecordsLoading, hgRecordsError, hgRecordsPage, hgRecordsHasMore } = this.state;
    return (
      <section className={styles.recordsSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>ACCOUNT ACTIVITY</p>
            <h2>充值记录</h2>
          </div>
          <button type="button" className={styles.moreButton} onClick={this.hgShowAllRecords}>
            {hgRecordsMode === "recent" ? "查看全部" : "返回最近记录"} <span aria-hidden="true">›</span>
          </button>
        </div>
        <p className={styles.serviceNotice}>{hgRecordsMode === "recent" ? "最近充值记录，最多 50 条" : "全部充值记录，每页 50 条"}，时间为本地时间</p>
        {hgRecordsError ? <div className={styles.emptyState}>
          <strong>充值记录加载失败</strong>
          <p>{hgRecordsError}</p>
          <button type="button" className={styles.retryButton} onClick={this.hgRetryRecords}>重新加载</button>
        </div> : hgRecordsLoading ? <div className={styles.emptyState}><p>正在加载充值记录...</p></div> : hgRecords.length === 0 ? <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">◎</div>
          <strong>本页暂无充值记录</strong>
          <p>这里展示充值订单，不代表所有订单均已入账</p>
        </div> : <>
          <div className={styles.recordList}>
            {hgRecords.map((hgRecord) => <article className={styles.recordRow} key={hgRecord.orderId}>
              <div className={styles.recordMain}><strong>{hgRecord.title || "充值"}</strong><small>订单号：{hgRecord.orderId}</small><small>创建时间：{this.formatRecordTime(hgRecord.createdAt)}</small>{hgRecord.paidAt && <small>支付时间：{this.formatRecordTime(hgRecord.paidAt)}</small>}<small>{hgRecord.paymentMode === "platform_debug" ? "debug 模拟充值，不扣人民币" : "支付渠道不可用"}</small></div>
              <div className={styles.recordCoin}>订单币数：{typeof hgRecord.totalCoin === "string" && /^\d+$/.test(hgRecord.totalCoin) ? hgRecord.totalCoin : "--"} M币</div>
              <div className={styles.recordAmount}>{hgRecord.currency === "CNY" ? `¥${this.getRecordAmount(hgRecord)}` : "金额未知"}<small className={hgRecord.status === "paid" ? styles.paidStatus : styles.pendingStatus}>{this.getRecordStatus(hgRecord)}</small></div>
            </article>)}
          </div>
        </>}
        {hgRecordsMode === "all" && <div className={styles.recordPager}>
          <button type="button" className={styles.pageButton} disabled={hgRecordsPage <= 1 || hgRecordsLoading} onClick={this.hgLoadPreviousRecords}>上一页</button>
          <span>第 {hgRecordsPage} 页</span>
          <button type="button" className={styles.pageButton} disabled={!hgRecordsHasMore || hgRecordsLoading} onClick={this.hgLoadNextRecords}>下一页</button>
        </div>}
      </section>
    );
  };

  /** 渲染钱包主体内容，按业务区块调用独立渲染方法。 */
  renderMainContent = () => {
    return (
      <main className={styles.main}>
        <p className={styles.serviceNotice}>可查看余额、创建充值订单和充值记录。微信、支付宝未接入；仅后端显式开放的 debug 模拟充值会写入真实平台币，不扣人民币，仅限隔离测试。</p>
        {this.renderBalanceCard()}
        {this.renderQuickServices()}
        {this.renderTransactionRecords()}
      </main>
    );
  };

  /** 渲染钱包展示页；页面结构由各业务区块方法负责。 */
  render() {
    return (
      <div className={styles.page}>
        {this.renderHeader()}
        {this.renderMainContent()}
      </div>
    );
  }
}

export default HGWalletPage;

import React from "react";
import { Link } from "react-router-dom";
import { PAGE } from "../../../../components/hg_navigation/hg_page_registry";
import { ROUTE_PATH } from "../../../router/hg_router_path";
import { hgMessage } from "../../../../components/hg_message/hg_message_page";
import HGUserProfileStorage from "../../../storage/hg_user_profile_storage";
import styles from "./hg_wallet_page.module.css";
import HGWalletVM from "./hg_wallet_vm.js";
import HGWalletRecordsPage from "./hg_wallet_records_page.jsx";

/**
 * 我的钱包页：展示资产概览、充值入口及最近记录，全部记录由独立路由承载。
 * props.pageNavigator：由 WithNavigation 注入的站内导航器，无业务默认值。
 * props.location：由 WithNavigation 注入的路由位置，key 变化时刷新余额。
 */
class HGWalletPage extends React.Component {
  state = {
    hgBalance: null, // 当前 M币余额，保留服务端十进制字符串；null 表示尚未取得余额。
    hgBalanceError: "", // 余额查询错误文案；空字符串表示当前没有错误。
    hgRecordsRefreshKey: 0, // 手动刷新记录的递增版本；初始 0，由记录预览自行首次加载。
  };
  hgMounted = false; // 是否已挂载；默认 false，卸载后禁止异步响应更新 state。
  hgRequest = null; // 最新余额请求的身份标记；null 表示尚未请求或已卸载。

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

  /** 刷新余额并用请求身份隔离晚到响应，保持平台币字符串精度。 */
  hgRefreshBalance = () => {
    if (!this.hgMounted) return;
    // 本次余额请求的独立标记，只有仍为最新标记时才允许写入页面。
    const hgRequest = this.hgRequest = {};
    this.setState({ hgBalanceError: "" });
    HGWalletVM.getBalance().then((hgResult) => {
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgBalance: hgResult.balance });
    }).catch((hgError) => {
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgBalanceError: HGWalletVM.errorMessage(hgError) });
    });
  };

  /** 手动刷新同时更新余额与最近记录；记录组件通过版本变化重新请求首页。 */
  hgRefreshWallet = () => {
    if (!this.hgMounted) return;
    this.hgRefreshBalance();
    this.setState((hgPrevious) => ({ hgRecordsRefreshKey: hgPrevious.hgRecordsRefreshKey + 1 }));
  };

  /** 失效余额请求并移除浏览器监听；记录组件自行清理其请求与监听。 */
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequest = null;
    window.removeEventListener("pageshow", this.hgRefreshBalance);
    window.removeEventListener("focus", this.hgRefreshBalance);
  }
  /**
   * 使用已有用户资料缓存展示名称，不将展示名称用作订单归属依据。
   */
  getUserDisplayName = () => {
    // 仅用于展示的本地资料；缺失时使用空对象并回退到“用户”。
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
    // 页头展示名称，不参与订单归属或金额计算。
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
          <button type="button" className={styles.ghostButton} onClick={() => this.props.pageNavigator?.open({ page: PAGE.MALL })}>商城入口</button>
          <button type="button" className={styles.ghostButton} onClick={this.hgRefreshWallet}>刷新余额与记录</button>
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
          <Link to={ROUTE_PATH.WALLET_SPENDING} className={styles.quickCard}>
            <span className={`${styles.quickIcon} ${styles.purpleIcon}`}>↗</span>
            <span>
              <strong>消费记录</strong>
              <small>查看已支付商品订单</small>
            </span>
            <span className={styles.arrow} aria-hidden="true">›</span>
          </Link>
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

  /** 钱包仅嵌入最近记录预览；“查看全部”通过 Link 跳转到独立记录路由。 */
  renderTransactionRecords = () => {
    return (
      <HGWalletRecordsPage
        hgPreview
        hgRefreshKey={this.state.hgRecordsRefreshKey}
        location={this.props.location}
      />
    );
  };

  /** 渲染钱包主体内容，按业务区块调用独立渲染方法。 */
  renderMainContent = () => {
    return (
      <main className={styles.main}>
        <p className={styles.serviceNotice}>可查看余额、充值记录及已支付商品的消费记录。微信、支付宝未接入；仅后端显式开放的 debug 模拟充值会写入真实平台币，不扣人民币，仅限隔离测试。</p>
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

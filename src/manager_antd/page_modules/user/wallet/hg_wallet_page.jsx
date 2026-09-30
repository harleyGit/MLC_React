import React from "react";
import { ROUTE_PATH } from "../../../router/hg_router_path";
import HGUserProfileStorage from "../../../storage/hg_user_profile_storage";
import styles from "./hg_wallet_page.module.css";
import HGWalletVM from "./hg_wallet_vm.js";

/**
 * 我的钱包页：展示当前用户的资产概览和交易入口。
 * 余额与充值入口接入钱包接口，交易记录仍待后端接口开放。
 */
class HGWalletPage extends React.Component {
  state = { hgBalance: null, hgBalanceError: "" };

  /** 读取权威币余额；请求链不支持外部取消，卸载时作废返回结果。 */
  componentDidMount() {
    this.hgRefreshBalance();
    window.addEventListener("pageshow", this.hgRefreshBalance);
    window.addEventListener("focus", this.hgRefreshBalance);
  }

  /** 返回路由或恢复浏览器页面时重读余额，旧请求不可覆盖后发请求。 */
  componentDidUpdate(hgPrevious) {
    if (hgPrevious.location?.key !== this.props.location?.key) this.hgRefreshBalance();
  }

  hgRefreshBalance = () => {
    const hgRequest = this.hgRequest = {};
    this.setState({ hgBalanceError: "" });
    HGWalletVM.getBalance().then((hgResult) => {
      if (this.hgRequest === hgRequest) this.setState({ hgBalance: hgResult.balance });
    }).catch((hgError) => {
      if (this.hgRequest === hgRequest) this.setState({ hgBalanceError: HGWalletVM.errorMessage(hgError) });
    });
  };

  componentWillUnmount() {
    this.hgRequest = null;
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
    this.props.navigate?.(ROUTE_PATH.EDIT_USER_INFO);
  };

  /** 两个充值入口共用受保护路由。 */
  handleRecharge = () => {
    this.props.navigate?.(ROUTE_PATH.WALLET_RECHARGE);
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

  /** 渲染交易记录区及未接入接口时的空态。 */
  renderTransactionRecords = () => {
    return (
      <section className={styles.recordsSection}>
        <div className={styles.sectionHeading}>
          <div>
            <p className={styles.sectionEyebrow}>ACCOUNT ACTIVITY</p>
            <h2>交易记录</h2>
          </div>
          <button type="button" className={styles.moreButton} disabled>
            查看全部 <span aria-hidden="true">›</span>
          </button>
        </div>
        <div className={styles.emptyState}>
          <div className={styles.emptyIcon} aria-hidden="true">◎</div>
          <strong>交易记录暂不可查询</strong>
          <p>交易记录接口开放后，可在这里查看真实的账户明细</p>
        </div>
      </section>
    );
  };

  /** 渲染钱包主体内容，按业务区块调用独立渲染方法。 */
  renderMainContent = () => {
    return (
      <main className={styles.main}>
        <p className={styles.serviceNotice}>可查看余额和创建充值订单。微信、支付宝未接入；仅后端显式开放的 debug 模拟充值会写入真实平台币，不扣人民币，仅限隔离测试。提现与交易记录暂未开放。</p>
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

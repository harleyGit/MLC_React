import React from "react";
import { ROUTE_PATH } from "../../../router/hg_router_path";
import HGUserProfileStorage from "../../../storage/hg_user_profile_storage";
import styles from "./hg_wallet_page.module.css";

/**
 * 我的钱包页：展示当前用户的资产概览和交易入口。
 * 余额、充值及交易记录待后端钱包接口接入后替换为真实数据。
 */
class HGWalletPage extends React.Component {
  /**
   * 获取当前用户的展示名称，避免钱包页依赖不存在的资产接口。
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

  /** 渲染余额卡片；未接入资产接口时不推断真实余额。 */
  renderBalanceCard = () => {
    return (
      <section className={styles.balanceCard}>
        <div className={styles.balanceCopy}>
          <p className={styles.cardLabel}>账户余额</p>
          <div className={styles.balanceValue}>
            <span className={styles.currency}>¥</span>--
          </div>
          <p className={styles.balanceHint}>余额暂不可查询</p>
        </div>
        <div className={styles.walletIllustration} aria-hidden="true">
          <span className={`${styles.coin} ${styles.coinOne}`}>¥</span>
          <span className={`${styles.coin} ${styles.coinTwo}`}>¥</span>
          <span className={styles.walletShape} />
        </div>
        <div className={styles.balanceActions}>
          <button type="button" className={styles.primaryButton} disabled>
            充值（暂未开放）
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
          <button type="button" className={styles.quickCard} disabled>
            <span className={`${styles.quickIcon} ${styles.blueIcon}`}>＋</span>
            <span>
              <strong>充值中心</strong>
              <small>暂未开放</small>
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
          <p>钱包服务接入后，可在这里查看真实的账户明细</p>
        </div>
      </section>
    );
  };

  /** 渲染钱包主体内容，按业务区块调用独立渲染方法。 */
  renderMainContent = () => {
    return (
      <main className={styles.main}>
        <p className={styles.serviceNotice}>钱包服务尚未接入，余额与交易记录暂不可查询，充值及提现暂未开放。</p>
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

import React from "react";
import { Link } from "react-router-dom";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGUserProfileStorage from "../../../storage/hg_user_profile_storage";
import { ROUTE_PATH } from "../../../router/hg_router_path";
import HGWalletVM, {
  buildHGRechargeDetailURL, createHGRequestID, formatHGYuanFromFen,
  getHGRemainingSeconds, normalizeHGRechargeSKUs,
  encodeHGRechargeQR, isHGLocalOnlyOrigin,
} from "./hg_wallet_vm.js";
import styles from "./hg_wallet_recharge.module.css";

/** 充值目录与本人订单确认共用页面；创建和付款仅由显式用户操作触发。 */
export default class HGWalletRechargePage extends React.Component {
  state = {
    hgSKUs: [], hgCursor: "0", hgHasMore: false, hgSelected: "", hgOrder: null,
    hgLoading: false, hgBusy: false, hgError: "", hgNotice: "", hgNow: Date.now(),
    hgQR: "", hgQRError: "",
  };

  componentDidMount() {
    this.hgLoadRoute();
  }

  componentDidUpdate(hgPrevious) {
    if (hgPrevious.location.search !== this.props.location.search) this.hgLoadRoute();
  }

  componentWillUnmount() {
    this.hgGeneration = null;
    this.hgQRRequest = null;
    clearInterval(this.hgClock);
    clearTimeout(this.hgPoll);
  }

  /** 路由变化创建独立代次，防止旧详情、目录和付款请求覆盖新页面。 */
  hgLoadRoute = () => {
    clearInterval(this.hgClock);
    clearTimeout(this.hgPoll);
    this.hgGeneration = {};
    this.hgQRRequest = null;
    this.hgQRURL = "";
    this.hgCreating = false;
    this.hgRequestID = null;
    this.hgOffset = 0;
    const hgOrderId = new URLSearchParams(this.props.location.search).get("orderId");
    this.setState({ hgOrder: null, hgSKUs: [], hgSelected: "", hgError: "", hgNotice: "", hgBusy: false, hgQR: "", hgQRError: "" });
    this.hgClock = setInterval(() => this.setState({ hgNow: Date.now() + this.hgOffset }), 1000);
    if (hgOrderId !== null) this.hgLoadDetail(hgOrderId, this.hgGeneration);
    else this.hgLoadSKUs("0");
  };

  /** 目录采用手动游标分页，避免空过滤页导致误判结束或无限自动请求。 */
  hgLoadSKUs = async (hgCursor) => {
    const hgGeneration = this.hgGeneration;
    this.setState({ hgLoading: true, hgError: "" });
    try {
      const hgResult = await HGWalletVM.getRechargeSKUs(hgCursor);
      if (this.hgGeneration !== hgGeneration) return;
      this.setState({ hgSKUs: normalizeHGRechargeSKUs(hgResult), hgCursor: hgResult.nextCursor,
        hgHasMore: hgResult.hasMore === true, hgSelected: "" });
    } catch (hgError) {
      if (this.hgGeneration === hgGeneration) this.setState({ hgError: HGWalletVM.errorMessage(hgError) });
    } finally {
      if (this.hgGeneration === hgGeneration) this.setState({ hgLoading: false });
    }
  };

  /** 单飞轮询：请求完成后才安排下一次；过期、错误、卸载时停止。 */
  hgLoadDetail = async (hgOrderId, hgGeneration) => {
    this.setState({ hgLoading: true });
    try {
      const hgOrder = await HGWalletVM.getRechargeOrderDetail(hgOrderId);
      if (this.hgGeneration !== hgGeneration) return;
      this.hgApplyOrder(hgOrder);
      if (hgOrder.status === "pending" && getHGRemainingSeconds(hgOrder.expiresAt, Date.parse(hgOrder.serverTime)) > 0) {
        this.hgPoll = setTimeout(() => this.hgLoadDetail(hgOrderId, hgGeneration), 5000);
      }
      // 当前后端只有 pending/expired；未来成功状态契约明确后在此调用
      // HGWalletVM.refreshBalanceAfterConfirmedPayment()，不能将 pay 的 200 当成入账。
    } catch (hgError) {
      if (this.hgGeneration === hgGeneration) this.setState({ hgError: HGWalletVM.errorMessage(hgError) });
    } finally {
      if (this.hgGeneration === hgGeneration) this.setState({ hgLoading: false });
    }
  };

  /** 使用服务端时钟差计算剩余时间，不在每次轮询时重置为十分钟。 */
  hgApplyOrder = (hgOrder) => {
    const hgServerTime = Date.parse(hgOrder.serverTime);
    this.hgOffset = Number.isFinite(hgServerTime) ? hgServerTime - Date.now() : 0;
    this.setState({ hgOrder, hgNow: Date.now() + this.hgOffset });
    if (!new URLSearchParams(this.props.location.search).has("orderId")) {
      const hgURL = buildHGRechargeDetailURL(hgOrder.orderId);
      if (hgURL !== this.hgQRURL) this.hgEncodeQR(hgURL);
    }
  };

  /** 按订单 URL 缓存编码尝试，轮询不重编码；代次检查阻止旧 PNG 覆盖新订单。 */
  hgEncodeQR = async (hgURL) => {
    this.hgQRURL = hgURL;
    const hgRequest = this.hgQRRequest = {};
    this.setState({ hgQR: "", hgQRError: "" });
    try {
      const hgQR = await encodeHGRechargeQR(hgURL);
      if (this.hgQRRequest === hgRequest) this.setState({ hgQR });
    } catch {
      if (this.hgQRRequest === hgRequest) this.setState({ hgQRError: "二维码生成失败，请重试或使用订单链接" });
    }
  };

  /** 切档只变更选择；创建失败重试保留幂等键，防止网络超时重复建单。 */
  hgSelect = (hgSelected) => {
    if (hgSelected === this.state.hgSelected || this.hgCreating) return;
    this.hgRequestID = null;
    this.setState({ hgSelected, hgError: "" });
  };

  hgCreate = async () => {
    if (this.hgCreating || !this.state.hgSelected) return;
    this.hgCreating = true;
    const hgGeneration = this.hgGeneration;
    this.hgRequestID ||= createHGRequestID();
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgOrder = await HGWalletVM.createRechargeOrder(this.state.hgSelected, this.hgRequestID);
      if (this.hgGeneration !== hgGeneration) return;
      this.hgApplyOrder(hgOrder);
      this.hgPoll = setTimeout(() => this.hgLoadDetail(hgOrder.orderId, hgGeneration), 5000);
    } catch (hgError) {
      if (this.hgGeneration === hgGeneration) this.setState({ hgError: HGWalletVM.errorMessage(hgError) });
    } finally {
      if (this.hgGeneration === hgGeneration) {
        this.hgCreating = false;
        this.setState({ hgBusy: false });
      }
    }
  };

  /** 支付能力关闭时 VM 直接拒绝，不调用 pay，也不修改订单状态或余额。 */
  hgPay = async () => {
    const hgOrder = this.state.hgOrder;
    if (this.hgPaying || !hgOrder || hgOrder.status !== "pending" || !getHGRemainingSeconds(hgOrder.expiresAt, this.state.hgNow)) return;
    const hgGeneration = this.hgGeneration;
    this.hgPaying = true;
    this.setState({ hgBusy: true, hgNotice: "" });
    try {
      await HGWalletVM.payOrderIfAvailable(this.state.hgOrder);
      if (this.hgGeneration === hgGeneration) this.setState({ hgNotice: "付款请求已提交，请等待服务端确认，尚未确认入账" });
    } catch (hgError) {
      if (this.hgGeneration === hgGeneration) this.setState({ hgNotice: HGWalletVM.errorMessage(hgError) });
    } finally {
      this.hgPaying = false;
      if (this.hgGeneration === hgGeneration) this.setState({ hgBusy: false });
    }
  };

  /** 重试只读详情，不重复创建订单；目录错误重新加载首页。 */
  hgRetry = () => {
    clearTimeout(this.hgPoll);
    this.setState({ hgError: "" });
    const hgOrderId = this.state.hgOrder?.orderId || new URLSearchParams(this.props.location.search).get("orderId");
    if (hgOrderId !== null) this.hgLoadDetail(hgOrderId, this.hgGeneration);
    else this.hgLoadSKUs("0");
  };

  /** 在现有 Modal 内约束键盘焦点，Escape 返回充值中心，不改公共组件契约。 */
  hgModalKeyDown = (hgEvent) => {
    if (hgEvent.key === "Escape") this.props.navigate(ROUTE_PATH.WALLET_RECHARGE);
    if (hgEvent.key !== "Tab") return;
    const hgControls = hgEvent.currentTarget.querySelectorAll("button:not(:disabled), a[href]");
    const hgFirst = hgControls[0];
    const hgLast = hgControls[hgControls.length - 1];
    if (hgEvent.shiftKey && document.activeElement === hgFirst) {
      hgEvent.preventDefault();
      hgLast?.focus();
    } else if (!hgEvent.shiftKey && document.activeElement === hgLast) {
      hgEvent.preventDefault();
      hgFirst?.focus();
    }
  };

  renderSKUs() {
    const { hgSKUs, hgSelected, hgLoading, hgBusy, hgOrder, hgHasMore, hgCursor } = this.state;
    if (new URLSearchParams(this.props.location.search).has("orderId")) return null;
    return <section className={styles.panel}>
      <h2>选择充值档位</h2><p>金额与到账币数以服务端档位为准，不固定按 1:1 换算。</p>
      <div className={styles.grid}>
        {hgSKUs.map((hgSKU) => <button type="button" key={hgSKU.skuId}
          className={hgSelected === hgSKU.skuId ? styles.selected : styles.sku}
          aria-pressed={hgSelected === hgSKU.skuId}
          disabled={hgBusy || !!hgOrder || hgSKU.supported !== true || hgSKU.currency !== "CNY"}
          onClick={() => this.hgSelect(hgSKU.skuId)}>
          <strong>{hgSKU.totalCoin}<small> M币</small></strong>
          <span>人民币 {formatHGYuanFromFen(hgSKU.payAmount)} 元</span>
          <span>{hgSKU.title}</span>
          {hgSKU.supported !== true && <span>该档位暂不支持</span>}
          {hgSKU.currency !== "CNY" && <span>暂不支持此币种</span>}
        </button>)}
      </div>
      {!hgLoading && !hgSKUs.length && <p>本页暂无可用档位{hgHasMore ? "，可继续查看下一页" : ""}。</p>}
      {!hgOrder && <div className={styles.actions}>
        <button type="button" className={styles.primary} disabled={!hgSelected || hgBusy || hgLoading} onClick={this.hgCreate}>
          {hgBusy ? "正在创建订单..." : "继续 / 生成二维码"}
        </button>
        {hgHasMore && <button type="button" disabled={hgLoading || hgBusy} onClick={() => this.hgLoadSKUs(hgCursor)}>下一页档位</button>}
      </div>}
    </section>;
  }

  renderOrder() {
    const { hgOrder, hgNow } = this.state;
    if (!hgOrder) return null;
    const hgSeconds = getHGRemainingSeconds(hgOrder.expiresAt, hgNow);
    const hgCountdown = `${String(Math.floor(hgSeconds / 60)).padStart(2, "0")}:${String(hgSeconds % 60).padStart(2, "0")}`;
    return <div className={styles.order}>
      <p className={styles.amount}>{formatHGYuanFromFen(hgOrder.payAmount)}<small> {hgOrder.currency === "CNY" ? "元" : hgOrder.currency}</small></p>
      <dl><dt>充值用户</dt><dd>{hgOrder.displayName}</dd>
        <dt>订单币数</dt><dd>{hgOrder.totalCoin} M币（未确认入账）</dd>
        <dt>订单号</dt><dd>{hgOrder.orderId}</dd>
        <dt>订单标题</dt><dd>{hgOrder.title}</dd>
        <dt>订单描述</dt><dd>{hgOrder.description}</dd>
        <dt>订单状态</dt><dd>{hgOrder.status === "expired" || !hgSeconds ? "已过期，请重新选择档位创建订单" : hgOrder.status === "pending" ? "待付款，尚未入账" : "状态暂不支持，未确认入账"}</dd>
        <dt>剩余时间</dt><dd role="timer">{hgCountdown}（订单有效期 10 分钟）</dd></dl>
    </div>;
  }

  renderDetailLink() {
    const { hgOrder, hgQR, hgQRError } = this.state;
    if (!hgOrder || new URLSearchParams(this.props.location.search).has("orderId")) return null;
    const hgURL = buildHGRechargeDetailURL(hgOrder.orderId);
    return <section className={styles.panel}>
      <h2>订单已创建，尚未付款</h2>
      {this.renderOrder()}
      <div className={styles.linkArea}>
        <div className={styles.qrArea}>
          {hgQR ? <img className={styles.qrImage} src={hgQR} alt="扫描打开本人订单确认页，非第三方支付码" /> : <p role="status">{hgQRError || "正在生成二维码..."}</p>}
          {hgQRError && <button type="button" onClick={() => this.hgEncodeQR(hgURL)}>重新生成二维码</button>}
        </div>
        <div><h3>手机扫码查看订单</h3><p>这是订单确认页二维码，不是第三方支付码。支付渠道暂未配置。手机必须登录创建订单的同一 MLC 用户，二维码不包含登录凭证。</p>
          <a href={hgURL}>{hgURL}</a>
          <p>可长按或选择链接复制；手机需能访问当前站点，并与开发电脑处于可互通网络。</p>
          {isHGLocalOnlyOrigin() && <p role="alert" className={styles.warning}>当前为本机地址，手机扫码无法访问电脑。请先用手机可达的局域网域名或 IP（开发端口 5174）打开前端，再生成二维码；确认防火墙放行。二维码始终保持当前页面同源，不会自动替换主机。</p>}
          <p>开发环境 /api/v1 由 Vite 代理到电脑的 8080 后端；生产环境需部署对应 API 及详情路由回退。普通局域网 HTTP 可能不支持请求签名使用的 Web Crypto，建议使用可信 HTTPS。</p>
          <Link to={`${ROUTE_PATH.WALLET_RECHARGE}?orderId=${encodeURIComponent(hgOrder.orderId)}`}>在当前设备确认付款</Link>
        </div>
      </div>
      <button type="button" onClick={this.hgLoadRoute}>重新选择档位</button>
    </section>;
  }

  renderPaymentModal() {
    const { hgOrder, hgBusy, hgNotice, hgNow, hgError, hgLoading } = this.state;
    if (!hgOrder || !new URLSearchParams(this.props.location.search).has("orderId")) return null;
    return <HGModalPage visible title={`你正在为MLC用户：${hgOrder.displayName} 付款`} closable={false} footer={null}>
      <section className={styles.confirm} role="dialog" aria-modal="true" aria-label={`你正在为MLC用户：${hgOrder.displayName} 付款`} onKeyDown={this.hgModalKeyDown}>
        {this.renderOrder()}
        <p>请确认是你本人创建的订单。支付渠道暂未配置，不会扣款或入账。</p>
        {this.renderTerms()}
        {hgNotice && <p role="alert" className={styles.warning}>{hgNotice}</p>}
        {hgError && <p role="alert" className={styles.warning}>{hgError} <button type="button" disabled={hgLoading} onClick={this.hgRetry}>重新查询</button></p>}
        <div className={styles.actions}>
          <button type="button" autoFocus className={styles.primary} disabled={hgBusy || hgOrder.status !== "pending" || !getHGRemainingSeconds(hgOrder.expiresAt, hgNow)} onClick={this.hgPay}>{hgBusy ? "请稍候..." : "付款"}</button>
          <Link autoFocus={hgOrder.status !== "pending" || !getHGRemainingSeconds(hgOrder.expiresAt, hgNow)} to={ROUTE_PATH.WALLET_RECHARGE}>返回充值中心</Link>
        </div>
      </section>
    </HGModalPage>;
  }

  /** 页面与付款弹窗复用须知，避免遮罩遮住关键交易限制。 */
  renderTerms() {
    return <section className={styles.terms}><h2>交易须知</h2>
      <p>1. M币为 MLC 平台币，实际金额、币数与赠币以订单快照为准。</p>
      <p>2. 订单自创建起有效 10 分钟，过期需重新创建；刷新或扫描链接不会延长有效期。</p>
      <p>3. 本人订单仅限同一账号查看与确认，请勿向他人提供登录凭证。</p>
      <p>4. 当前支付服务未配置，请勿向任何个人账户转账。只有服务端确认入账才可更新余额。</p>
    </section>;
  }

  render() {
    const hgProfile = HGUserProfileStorage.getUserProfile() || {};
    return <main className={styles.page}>
      <header className={styles.header}><Link to={ROUTE_PATH.WALLET}>返回我的钱包</Link>
        <p className={styles.eyebrow}>MLC / RECHARGE</p><h1>M币充值中心</h1>
        <p>当前用户：{hgProfile.nickname || hgProfile.username || hgProfile.userName || "用户"}</p>
      </header>
      <p className={styles.warning}>支付渠道暂未配置。创建订单不代表付款成功，不会增加余额。</p>
      {this.state.hgError && <div role="alert" className={styles.warning}>{this.state.hgError} <button type="button" disabled={this.state.hgLoading || this.state.hgBusy} onClick={this.hgRetry}>重新查询</button></div>}
      {this.state.hgLoading && !this.state.hgOrder && <p role="status">正在读取钱包数据...</p>}
      {this.renderSKUs()}{this.renderDetailLink()}
      {this.renderTerms()}
      {this.renderPaymentModal()}
    </main>;
  }
}

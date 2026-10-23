import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import HGWalletVM, {
  formatHGYuanFromFen,
  normalizeHGRechargeSKUs,
} from "../../manager_antd/page_modules/user/wallet/hg_wallet_vm.js";
import HGWalletRecordsPage from "../../manager_antd/page_modules/user/wallet/hg_wallet_records_page.jsx";
import { HGFormatCoin } from "./hg_mall_amount.js";
import HGMallCatalog from "./hg_mall_catalog.jsx";
import styles from "./hg_mall_page.module.css";

/** 商城入口展示服务端商品目录、商家工作台、资产和充值记录；不推算支付结果。 */
export default class HGMallPage extends React.Component {
  state = {
    hgBalance: null, // 余额原始十进制字符串；null 表示尚未读取，不能当作零余额。
    hgBalanceError: "", // 余额读取错误；空字符串表示本次查询无错误。
    hgSKUs: [], // 当前游标页的有效充值档位；每页最多 20 条，初始为空。
    hgSKUPage: 1, // 当前档位页展示序号，从 1 开始，不代表全站总页数。
    hgCursorHistory: ["0"], // 已浏览页的请求游标；首页使用字符串 0，不转成 JS 数字。
    hgNextCursor: "", // 下一页服务端游标；空字符串表示不可继续。
    hgHasMore: false, // 是否可加载下一页，仅以服务端 hasMore 为准。
    hgSKUsLoading: false, // 是否正在读取档位；默认 false，加载中禁止并发翻页。
    hgSKUsError: "", // 目录请求错误；空字符串表示无错误。
    hgTab: "products", // 当前栏目：products、recharge 或 orders；默认展示真实商品目录。
  };

  hgMounted = false; // 挂载标志；卸载后不得提交请求结果。
  hgBalanceRequest = null; // 最近一次余额请求身份；null 表示当前没有有效请求。
  hgSKURequest = null; // 最近一次目录请求身份；null 表示当前没有有效请求。
  hgSKUFlight = false; // 同步翻页门闩，防止 setState 前快速连点产生重复请求。

  /** 首屏并行读取两个只读接口，购买能力不以本地数据模拟。 */
  componentDidMount() {
    this.hgMounted = true;
    this.hgRefreshBalance();
    this.hgLoadSKUs("0", 1, ["0"]);
    window.addEventListener("focus", this.hgRefreshBalance);
  }

  /** 作废晚到响应并移除监听，不保留卸载后轮询。 */
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgBalanceRequest = null;
    this.hgSKURequest = null;
    window.removeEventListener("focus", this.hgRefreshBalance);
  }

  /** 每次聚焦重读权威余额，过期结果不能覆盖后发请求。 */
  hgRefreshBalance = async () => {
    if (!this.hgMounted) return;
    const hgRequest = this.hgBalanceRequest = {};
    this.setState({ hgBalanceError: "" });
    try {
      const hgResult = await HGWalletVM.getBalance();
      if (this.hgMounted && this.hgBalanceRequest === hgRequest) {
        if (typeof hgResult?.balance !== "string" || !/^\d+$/.test(hgResult.balance))
          throw new Error("余额响应异常，请重试");
        this.setState({ hgBalance: hgResult.balance });
      }
    } catch (hgError) {
      if (this.hgMounted && this.hgBalanceRequest === hgRequest)
        this.setState({ hgBalanceError: HGWalletVM.errorMessage(hgError) });
    }
  };

  /** 单页 20 条且仅手动翻页，避免在海量目录上自动追索或累积无限客户端数据。 */
  hgLoadSKUs = async (hgCursor, hgPage, hgHistory) => {
    if (!this.hgMounted || this.hgSKUFlight) return;
    this.hgSKUFlight = true;
    const hgRequest = this.hgSKURequest = {};
    this.setState({ hgSKUsLoading: true, hgSKUsError: "" });
    try {
      const hgResult = await HGWalletVM.getRechargeSKUs(hgCursor);
      if (!this.hgMounted || this.hgSKURequest !== hgRequest) return;
      if (typeof hgResult?.hasMore !== "boolean" ||
          typeof hgResult.nextCursor !== "string" ||
          (hgResult.hasMore && (!hgResult.nextCursor || hgResult.nextCursor === hgCursor)))
        throw new Error("充值档位响应异常，请重试");
      this.setState({
        hgSKUs: normalizeHGRechargeSKUs(hgResult).filter((hgSKU) => hgSKU.currency === "CNY"),
        hgSKUPage: hgPage,
        hgCursorHistory: hgHistory,
        hgNextCursor: hgResult.nextCursor,
        hgHasMore: hgResult.hasMore,
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgSKURequest === hgRequest)
        this.setState({ hgSKUsError: HGWalletVM.errorMessage(hgError) });
    } finally {
      if (this.hgSKURequest === hgRequest) {
        this.hgSKUFlight = false;
        if (this.hgMounted) this.setState({ hgSKUsLoading: false });
      }
    }
  };

  /** 下一页复用服务端不透明游标，不构造 offset 或总数。 */
  hgNextPage = () => {
    const { hgNextCursor, hgSKUPage, hgCursorHistory, hgHasMore } = this.state;
    if (hgHasMore && hgNextCursor)
      this.hgLoadSKUs(hgNextCursor, hgSKUPage + 1, [...hgCursorHistory, hgNextCursor]);
  };

  /** 上一页用原始游标重新查询；目录变化时仍按服务端当前结果展示。 */
  hgPreviousPage = () => {
    const { hgSKUPage, hgCursorHistory } = this.state;
    if (hgSKUPage > 1)
      this.hgLoadSKUs(hgCursorHistory[hgSKUPage - 2], hgSKUPage - 1, hgCursorHistory.slice(0, -1));
  };

  /** 原型风格的导航与实时余额展示；余额错误可单独重试。 */
  renderHeader() {
    return (
      <header className={styles.header}>
        <Link className={styles.brand} to={ROUTE_PATH.MALL}><span className={styles.mark}>M</span> MLC 商城</Link>
        <nav aria-label="商城导航" className={styles.nav}>
          <button type="button" aria-pressed={this.state.hgTab === "products"} onClick={() => this.setState({ hgTab: "products" })}>首页 · 商品</button>
          <button type="button" aria-pressed={this.state.hgTab === "recharge"} onClick={() => this.setState({ hgTab: "recharge" })}>充值中心</button>
          <button type="button" aria-pressed={this.state.hgTab === "orders"} onClick={() => this.setState({ hgTab: "orders" })}>我的充值订单</button>
          <Link to={ROUTE_PATH.WALLET}>我的钱包</Link>
        </nav>
        <div className={styles.balance}>
          <span>可用 M币 {this.state.hgBalance === null ? "--" : HGFormatCoin(this.state.hgBalance)}</span>
          <button type="button" onClick={this.hgRefreshBalance} aria-label="刷新余额">↻</button>
        </div>
      </header>
    );
  }

  /** 档位价格和赠币完全使用服务端快照，创建订单交给已有带幂等键的充值流程。 */
  renderSKUs() {
    const { hgSKUs, hgSKUsLoading, hgSKUsError, hgSKUPage, hgHasMore, hgCursorHistory } = this.state;
    return (
      <section aria-labelledby="hg-mall-skus" className={styles.section}>
        <div className={styles.sectionTitle}>
          <div><h2 id="hg-mall-skus">选择充值档位</h2><p>支付金额、基础币和赠币以服务端档位为准。</p></div>
          <Link to={ROUTE_PATH.WALLET_RECHARGE}>进入充值流程 →</Link>
        </div>
        {hgSKUsError && <p role="alert" className={styles.error}>{hgSKUsError} <button type="button" onClick={() => this.hgLoadSKUs(hgCursorHistory[hgSKUPage - 1], hgSKUPage, hgCursorHistory)}>重试</button></p>}
        {hgSKUsLoading && <p role="status">正在读取充值档位...</p>}
        {!hgSKUsLoading && !hgSKUsError && !hgSKUs.length && <p>本页暂无生效档位{hgHasMore ? "，可查看下一页" : "。"}</p>}
        {!hgSKUsLoading && !hgSKUsError && (
          <div className={styles.grid}>
            {hgSKUs.map((hgSKU) => (
              <article key={hgSKU.skuId} className={styles.sku}>
                {hgSKU.bonusCoin > 0 && <span className={styles.bonus}>赠 {HGFormatCoin(hgSKU.bonusCoin)} M币</span>}
                <span className={styles.price}>¥{formatHGYuanFromFen(hgSKU.payAmount)}</span>
                <strong>{HGFormatCoin(hgSKU.totalCoin)} M币</strong>
                <small>基础 {HGFormatCoin(hgSKU.coinAmount)} · {hgSKU.title}</small>
                <span className={styles.availability}>{hgSKU.paymentAvailable ? "仅支持隔离环境 debug 模拟充值" : "当前无可用支付渠道"}</span>
              </article>
            ))}
          </div>
        )}
        <div className={styles.pager} aria-label="充值档位分页">
          <button type="button" disabled={hgSKUPage === 1 || hgSKUsLoading || this.hgSKUFlight} onClick={this.hgPreviousPage}>上一页</button>
          <span>第 {hgSKUPage} 页</span>
          <button type="button" disabled={!hgHasMore || hgSKUsLoading || this.hgSKUFlight} onClick={this.hgNextPage}>下一页</button>
        </div>
        <Link className={styles.cta} to={ROUTE_PATH.WALLET_RECHARGE}>前往充值中心，选择档位并创建订单</Link>
      </section>
    );
  }

  /** 使用现成的本人记录组件获取有界游标页，明确区分充值订单与商品订单。 */
  renderOrders() {
    return (
      <section className={styles.section}>
        <p className={styles.notice}>这里仅展示本人充值订单。商品交易和退款接口尚未接入，不会展示虚构订单或付款结果。</p>
        <HGWalletRecordsPage />
      </section>
    );
  }

  /** 首页按原型展示商品、充值和账户入口，交易状态只能来自真实接口。 */
  render() {
    return (
      <main className={styles.page}>
        {this.renderHeader()}
        <div className={styles.content}>
          <section className={styles.hero}>
           <div><p>MLC · MALL</p><h1>探索 MLC 商城</h1><p>数码影音、家用电器、服饰、美妆与会员商品。商品和价格来自服务端，经管理员审核后展示。</p>
               <button className={styles.heroButton} type="button" onClick={() => this.setState({ hgTab: "recharge" })}>进入充值中心</button></div>
            <div className={styles.heroBalance}><span>当前可用余额</span><strong>{this.state.hgBalance === null ? "--" : HGFormatCoin(this.state.hgBalance)}</strong><span>M币 · 以服务端余额为准</span></div>
          </section>
          {this.state.hgBalanceError && <p role="alert" className={styles.error}>余额读取失败：{this.state.hgBalanceError} <button type="button" onClick={this.hgRefreshBalance}>重试</button></p>}
           <p className={styles.notice}>商品购买、退款、库存与会员权益尚未接入；目前可浏览经审核的真实商品并提交商家入驻与商品发布。微信、支付宝及混合支付不可用。隔离环境模拟充值不会扣人民币。</p>
           {this.state.hgTab === "products" ? <HGMallCatalog /> : this.state.hgTab === "recharge" ? this.renderSKUs() : this.renderOrders()}
        </div>
      </main>
    );
  }
}

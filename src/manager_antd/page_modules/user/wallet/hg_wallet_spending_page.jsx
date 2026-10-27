import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../../router/hg_router_path";
import HGMallVM from "../../../../pages/mall/hg_mall_vm.js";
import { HGFormatCoin } from "../../../../pages/mall/hg_mall_amount.js";
import styles from "./hg_wallet_page.module.css";

/** 钱包消费记录只展示本人已付款商品，待支付预留未发生扣币、不计入消费。 */
export default class HGWalletSpendingPage extends React.Component {
  state = {
    hgOrders: [], // 当前页最多 20 笔已付款商品订单，不累积含收件地址的历史页。
    hgHistory: [""], // 最近最多 64 页的请求游标；首项空字符串表示第一页。
    hgHistoryBase: 0, // 已舍弃的旧游标数量；初始 0，仅用于展示页码。
    hgNext: "", // 服务端返回的下页游标；空字符串表示已到末页。
    hgLoading: false, // 当前页查询中为 true，禁止并发翻页。
    hgError: "", // 当前页查询失败文案；空字符串代表无错误。
  };
  hgMounted = false; // 卸载后不再写入订单及收货快照。
  hgRequest = 0; // 请求代次；离开页后忽略迟到的结果。
  hgFlight = false; // 同步翻页门闩，避免点击快于 setState。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadOrders("", [""], 0);
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequest += 1;
  }

  /** 每次只加载服务端有界游标页；失败保留当前游标供人工重试。 */
  hgLoadOrders = async (hgCursor, hgHistory, hgHistoryBase) => {
    if (!this.hgMounted || this.hgFlight) return;
    this.hgFlight = true;
    const hgRequest = ++this.hgRequest; // 当前分页查询标识，防止卸载后的异步写入。
    this.setState({ hgLoading: true, hgError: "", hgOrders: [], hgNext: "", hgHistory, hgHistoryBase });
    try {
      const hgPage = await HGMallVM.orders(hgCursor); // 本人已支付实物订单；不将充值订单混入消费记录。
      if (!this.hgMounted || this.hgRequest !== hgRequest) return;
      if (!Array.isArray(hgPage?.list) || hgPage.list.length > 20 || typeof hgPage.hasMore !== "boolean" || typeof hgPage.nextCursor !== "string" || (hgPage.hasMore && (!hgPage.nextCursor || hgPage.nextCursor === hgCursor))) throw new Error("消费记录响应异常，请重试");
      this.setState({ hgOrders: hgPage.list, hgNext: hgPage.hasMore ? hgPage.nextCursor : "" });
    } catch (hgError) {
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgError: hgError?.message || "消费记录加载失败" });
    } finally {
      if (this.hgRequest === hgRequest) this.hgFlight = false;
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgLoading: false });
    }
  };

  /** 保存至多 64 个游标，更多历史仍可从最新页重新向后翻页。 */
  hgNextPage = () => {
    if (!this.state.hgNext || this.hgFlight) return;
    const hgHistory = [...this.state.hgHistory, this.state.hgNext]; // 新页的服务端原始游标。
    const hgBase = this.state.hgHistoryBase + Math.max(0, hgHistory.length - 64); // 舍弃最早页时维持页码。
    this.hgLoadOrders(this.state.hgNext, hgHistory.slice(-64), hgBase);
  };

  hgPreviousPage = () => {
    if (this.state.hgHistory.length < 2 || this.hgFlight) return;
    const hgHistory = this.state.hgHistory.slice(0, -1); // 上页游标仍在本地有界历史中。
    this.hgLoadOrders(hgHistory[hgHistory.length - 1], hgHistory, this.state.hgHistoryBase);
  };

  /** 只显示真实发生扣币的实物订单；退款订单保留历史但明确标识已退款。 */
  renderOrders() {
    if (this.state.hgError) return <div className={styles.emptyState} role="alert"><p>{this.state.hgError}</p><button type="button" className={styles.retryButton} onClick={() => this.hgLoadOrders(this.state.hgHistory.at(-1), this.state.hgHistory, this.state.hgHistoryBase)}>重试当前页</button></div>;
    if (this.state.hgLoading) return <p role="status">正在加载消费记录...</p>;
    if (!this.state.hgOrders.length) return <div className={styles.emptyState}><strong>当前页暂无已支付商品</strong><p>待支付订单未扣 M币，请在商城商品订单中查看。</p></div>;
    return <div className={styles.recordList}>{this.state.hgOrders.map((hgOrder) => <article className={styles.recordRow} key={hgOrder.orderId}>
      <div className={styles.recordMain}>
        <strong>{hgOrder.title}</strong>
        <small>规格：{hgOrder.skuTitle} · 数量：{hgOrder.quantity} 件</small>
        <small>订单号：{hgOrder.orderId}</small>
        <Link className={styles.recordLink} to={ROUTE_PATH.MALL_ORDER_DETAIL.replace(":orderId", encodeURIComponent(hgOrder.orderId))}>查看商品订单详情</Link>
      </div>
      <div className={styles.recordAmount}>
        {hgOrder.shippingStatus === 3 ? "已全额退款" : `支出 ${HGFormatCoin(hgOrder.amount)} M币`}
        <small>{hgOrder.shippingStatus === 3 ? "订单已关闭" : hgOrder.shippingStatus === 2 ? "已确认收货" : hgOrder.shippingStatus === 1 ? "已发货" : "已支付，待发货"}</small>
      </div>
    </article>)}</div>;
  }

  render() {
    return <div className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.backButton} to={ROUTE_PATH.WALLET}>‹ 我的钱包</Link>
        <div className={styles.headerInner}><div className={styles.brandMark} aria-hidden="true">M</div><h1>消费记录</h1></div>
      </header>
      <main className={styles.main}>
        <section className={styles.recordsSection} aria-label="已支付商品订单">
          <p className={styles.serviceNotice}>全部已付款实物商品，每页最多 20 单；退款订单仍保留并标记为已退款。待支付商品请到 <Link to={ROUTE_PATH.USER_CENTER}>我的商品订单</Link> 查看。</p>
          {this.renderOrders()}
          <nav className={styles.recordPager} aria-label="消费记录分页">
            <button className={styles.pageButton} type="button" disabled={this.state.hgHistory.length < 2 || this.state.hgLoading} onClick={this.hgPreviousPage}>上一页</button>
            <span>第 {this.state.hgHistoryBase + this.state.hgHistory.length} 页</span>
            <button className={styles.pageButton} type="button" disabled={!this.state.hgNext || this.state.hgLoading} onClick={this.hgNextPage}>下一页</button>
          </nav>
        </section>
      </main>
    </div>;
  }
}

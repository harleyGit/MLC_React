import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import HGCollectionView from "../../components/hg_collection_view/hg_collection_view";
import { HGFormatCoin } from "./hg_mall_amount.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_mall_page.module.css";

const hgPendingBuyKey = "mlc.mall.pending-buy"; // 与商城下单流程共用的会话键；核对订单后才能清除。

/**
 * 本人待支付与超时取消订单页，对应个人中心「我的订单 → 待付款」。
 * 约束：订单与收件信息只来自服务端授权接口，不跨用户缓存；离开菜单即卸载，不保留后台轮询。
 */
export default class HGMallPendingOrdersPage extends React.Component {
  state = {
    hgOrders: [], // 本人已加载的待支付及超时订单；仅在本页挂载期间保留。
    hgNextCursor: "", // 下一页的服务端原始游标；空字符串表示首屏或末页。
    hgHasMore: false, // 是否还有下一页；只依据服务端 hasMore。
    hgLoading: false, // 列表请求中；刷新与追加加载互斥。
    hgResetKey: 0, // 重新读取首屏的序号；变化时滚动视图回到顶部并清除测量缓存。
    hgError: "", // 加载或写操作错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
    hgBusy: false, // 支付写操作门闩，防止快速重复提交。
    hgPendingBuy: false, // 会话内存在结果未知的购买请求时为 true，须核对订单或重试原请求。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 列表请求序号；写操作刷新时忽略旧页响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。
  hgLoadFlight = false; // 同步加载门闩，防止同一游标被滚动事件重复请求。

  componentDidMount() {
    this.hgMounted = true;
    try {
      this.setState({ hgPendingBuy: !!sessionStorage.getItem(hgPendingBuyKey) });
    } catch {
      /* 禁用会话存储时仍保留组件内的待确认状态。 */
    }
    this.hgRefreshOrders();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
    this.hgLoadFlight = false; // 严格模式重新挂载时允许发起新首屏读取。
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 从服务端读取本人有界订单页；刷新丢弃旧游标，追加只使用服务端下一页游标。 */
  hgLoadOrders = async (hgAppend = false) => {
    if (this.hgLoadFlight) return;
    if (hgAppend && !this.state.hgHasMore) return;
    this.hgLoadFlight = true;
    const hgSeq = ++this.hgSeq; // 本次查询身份，忽略卸载或刷新后的旧响应。
    this.setState({ hgLoading: true });
    try {
      const hgPageData = await HGMallVM.pendingOrders(hgAppend ? this.state.hgNextCursor : "");
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPageData?.list) ||
        typeof hgPageData?.hasMore !== "boolean" ||
        typeof hgPageData?.nextCursor !== "string"
      )
        throw new Error("待支付订单响应异常");
      if (hgAppend && !hgPageData.list.length) {
        this.setState({ hgHasMore: false, hgError: "" });
        return;
      }
      if (hgPageData.hasMore && (!hgPageData.nextCursor ||
        (hgAppend && hgPageData.nextCursor === this.state.hgNextCursor)))
        throw new Error("待支付订单游标异常");
      this.setState((state) => ({
        hgOrders: hgAppend ? [...state.hgOrders, ...hgPageData.list] : hgPageData.list,
        hgNextCursor: hgPageData.hasMore ? hgPageData.nextCursor : "",
        hgHasMore: hgPageData.hasMore,
        hgError: "",
      }));
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgSeq === hgSeq) {
        this.hgLoadFlight = false;
        if (this.hgMounted) this.setState({ hgLoading: false });
      }
    }
  };

  /** 刷新后旧页数据立即失效，重新从首屏读取，避免与旧游标混用。 */
  hgRefreshOrders = (hgForce = false) => {
    if (this.hgLoadFlight && !hgForce) return;
    if (hgForce) {
      this.hgSeq += 1; // 写操作后的刷新废弃尚在途中的旧页响应。
      this.hgLoadFlight = false;
    }
    this.setState((state) => ({
      hgOrders: [], hgNextCursor: "", hgHasMore: false, hgResetKey: state.hgResetKey + 1,
      hgError: "",
    }));
    return this.hgLoadOrders(false);
  };

  /** 下滑追加下一页，不重取已加载订单。 */
  hgLoadMore = () => this.hgLoadOrders(true);

  /**
   * 页面内写操作串行执行；成功后重新读取第一页并通知余额订阅者刷新。
   * 约束：409 表示订单状态被其他端改变，刷新后仍保留错误反馈。
   */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await hgAction();
      this.props.hgOnBalanceChange?.();
      if (this.hgMounted) {
        this.setState({ hgNotice: hgSuccess });
        await this.hgRefreshOrders(true);
      }
    } catch (hgError) {
      if (this.hgMounted) {
        if (hgError?.status === 409) await this.hgRefreshOrders(true);
        if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
      }
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 支付只提交订单 ID，余额、订单价格和15分钟截止时间以服务端为准。 */
  hgPay = (hgOrderId) =>
    this.hgWrite(async () => {
      await HGMallVM.pay(hgOrderId);
    }, "订单已支付 M币，请等待商家发货");

  /** 核对订单后清除会话内待确认购买标记；仅影响提示，不改变服务端订单。 */
  hgClearPendingBuy = () => {
    try {
      sessionStorage.removeItem(hgPendingBuyKey);
    } catch {
      /* 会话存储不可用时仅清理本页状态。 */
    }
    this.setState({ hgPendingBuy: false });
  };

  /** 待支付/超时订单的交易状态文案；仅覆盖本期实物订单状态。 */
  hgTradeStatusText = (hgOrder) =>
    hgOrder.tradeStatus === 1 ? "待支付" : "超时取消，库存已释放";

  /** 订单详情链接；路由参数只携带订单号，归属校验在服务端。 */
  hgDetailLink = (hgOrder) => (
    <Link
      to={ROUTE_PATH.MALL_ORDER_DETAIL.replace(
        ":orderId",
        encodeURIComponent(hgOrder.orderId)
      )}
    >
      查看订单详情
    </Link>
  );

  /** 卡片高度交由内容自然撑开；支付权限和状态仍以服务端为准。 */
  renderOrderCard = (hgOrder) => (
    <article className={`${styles.orderCard} ${styles.orderListCard}`}>
      <h3>{hgOrder.title}</h3>
      <p>数量：{hgOrder.quantity} · 金额：{HGFormatCoin(hgOrder.amount)} M币</p>
      <p>订单号：{hgOrder.orderId}</p>
      <p>状态：{this.hgTradeStatusText(hgOrder)}</p>
      <p>支付截止（UTC）：{hgOrder.expiresAt}</p>
      <div className={styles.orderActions}>
        {this.hgDetailLink(hgOrder)}
        {hgOrder.tradeStatus === 1 && <button type="button" disabled={this.state.hgBusy}
          onClick={() => this.hgPay(hgOrder.orderId)}>继续支付 M币</button>}
      </div>
    </article>
  );

  /** 渲染待确认购买提示；核对前不隐藏真实订单状态。 */
  renderPendingBuyNotice = () => {
    if (!this.state.hgPendingBuy) return null;
    return (
      <>
        <p className={styles.notice}>
          有一笔购买结果尚未确认；请先核对订单记录。若未出现订单，可用原商品与相同收货信息重试。
        </p>
        <button type="button" onClick={this.hgClearPendingBuy}>
          我已核对订单，清除待确认请求
        </button>
      </>
    );
  };

  /** 渲染加载或写操作错误，允许对失败的下一游标人工重试。 */
  renderError = () => {
    if (!this.state.hgError) return null;
    return (
      <p role="alert" className={styles.error}>
        {this.state.hgError}{" "}
        <button type="button" onClick={this.state.hgOrders.length && this.state.hgHasMore
          ? this.hgLoadMore : () => this.hgRefreshOrders()}>
          重试
        </button>
      </p>
    );
  };

  render() {
    return (
      <section className={styles.section} aria-label="待支付与超时取消">
        <h2>待付款</h2>
        {this.renderPendingBuyNotice()}
        {this.renderError()}
        {this.state.hgNotice && (
          <p role="status" className={styles.notice}>
            {this.state.hgNotice}
          </p>
        )}
        <HGCollectionView
          items={this.state.hgOrders}
          getKey={(hgOrder) => hgOrder.orderId}
          renderCell={this.renderOrderCard}
          loading={this.state.hgLoading}
          hasMore={this.state.hgHasMore}
          resetKey={this.state.hgResetKey}
          onLoadMore={this.hgLoadMore}
          onRefresh={() => this.hgRefreshOrders()}
          ariaLabel="待付款订单"
        />
      </section>
    );
  }
}

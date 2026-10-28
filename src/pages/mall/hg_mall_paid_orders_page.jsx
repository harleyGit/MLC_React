import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import HGCollectionView from "../../components/hg_collection_view/hg_collection_view";
import { HGFormatCoin } from "./hg_mall_amount.js";
import { hgSecureRequestId } from "./hg_mall_security.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_mall_page.module.css";

/**
 * 本人已支付商品订单页，对应个人中心「我的订单 → 评价」。
 * 约束：订单与收件信息只来自服务端授权接口，不跨用户缓存；离开菜单即卸载，不保留后台轮询。
 */
export default class HGMallPaidOrdersPage extends React.Component {
  state = {
    hgOrders: [], // 本人已加载的已支付订单；离开页面即释放，不跨用户保存收件信息。
    hgNextCursor: "", // 服务端下一页游标；空字符串表示首屏或末页。
    hgHasMore: false, // 服务端是否有下一页。
    hgLoading: false, // 刷新或追加请求中；同一时刻只读一页。
    hgResetKey: 0, // 首屏重读次数；变化时清理列表高度缓存并回到顶部。
    hgError: "", // 加载或写操作错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
    hgBusy: false, // 退款/收货写操作门闩，防止快速重复提交。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 列表请求序号；写操作刷新时忽略旧页响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。
  hgRefundRequestIds = new Map(); // 各订单退款幂等键；失败后复用，成功后移除。
  hgLoadFlight = false; // 同步读取门闩，阻止滚动事件重复请求游标。

  componentDidMount() {
    this.hgMounted = true;
    this.hgRefreshOrders();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
    this.hgLoadFlight = false; // 严格模式重新挂载时允许发起新首屏读取。
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 只读取本人有界已支付订单页；追加使用服务端游标，过期响应不可覆盖新结果。 */
  hgLoadOrders = async (hgAppend = false) => {
    if (this.hgLoadFlight) return;
    if (hgAppend && !this.state.hgHasMore) return;
    this.hgLoadFlight = true;
    const hgSeq = ++this.hgSeq; // 本次查询身份，忽略卸载或刷新后的旧响应。
    this.setState({ hgLoading: true });
    try {
      const hgPageData = await HGMallVM.orders(hgAppend ? this.state.hgNextCursor : "");
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPageData?.list) ||
        typeof hgPageData?.hasMore !== "boolean" ||
        typeof hgPageData?.nextCursor !== "string"
      )
        throw new Error("商品订单响应异常");
      if (hgAppend && !hgPageData.list.length) {
        this.setState({ hgHasMore: false, hgError: "" });
        return;
      }
      if (hgPageData.hasMore && (!hgPageData.nextCursor ||
        (hgAppend && hgPageData.nextCursor === this.state.hgNextCursor)))
        throw new Error("商品订单游标异常");
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

  /** 手动或写操作后清空旧快照，重新获取第一页以免使用失效游标。 */
  hgRefreshOrders = (hgForce = false) => {
    if (this.hgLoadFlight && !hgForce) return;
    if (hgForce) {
      this.hgSeq += 1; // 写操作之后废弃尚未完成的列表查询。
      this.hgLoadFlight = false;
    }
    this.setState((state) => ({
      hgOrders: [], hgNextCursor: "", hgHasMore: false, hgResetKey: state.hgResetKey + 1,
      hgError: "",
    }));
    return this.hgLoadOrders(false);
  };

  /** 触底时追加下一页，保留已加载订单的滚动位置。 */
  hgLoadMore = () => this.hgLoadOrders(true);

  /**
   * 页面内写操作串行执行；成功后重读首屏并通知余额订阅者刷新。
   * 约束：409 表示订单状态被其他端改变，重读后仍保留错误反馈。
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

  /** 未发货订单退款使用稳定的幂等键；失败后复用，成功后移除。 */
  hgRefund = (hgOrderId) => {
    if (!this.hgRefundRequestIds.has(hgOrderId)) {
      try {
        this.hgRefundRequestIds.set(hgOrderId, hgSecureRequestId());
      } catch (hgError) {
        this.setState({ hgError: this.hgMessage(hgError) });
        return;
      }
    }
    const hgRequestId = this.hgRefundRequestIds.get(hgOrderId);
    this.hgWrite(async () => {
      await HGMallVM.refund(hgOrderId, hgRequestId);
      this.hgRefundRequestIds.delete(hgOrderId);
    }, "未发货订单已全额退还 M币并释放库存");
  };

  /** 确认收货只提交订单 ID；结算金额与状态以服务端为准。 */
  hgReceive = (hgOrderId) =>
    this.hgWrite(async () => {
      await HGMallVM.receive(hgOrderId);
    }, "已确认收货，商家 M币已结算");

  /** 已支付订单的履约状态文案；退款优先于发货状态展示。 */
  hgShippingStatusText = (hgOrder) =>
    hgOrder.shippingStatus === 3
      ? "未发货已退款"
      : hgOrder.shippingStatus === 2
      ? "已确认收货并结算"
      : hgOrder.shippingStatus === 1
      ? "已发货"
      : "已支付，待发货";

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

  /** 卡片随收件信息自然换行；退款、收货按钮只显示服务端允许的当前状态。 */
  renderOrderCard = (hgOrder) => (
    <article className={`${styles.orderCard} ${styles.orderListCard}`}>
      <h3>{hgOrder.title}</h3>
      <p>数量：{hgOrder.quantity} · 金额：{HGFormatCoin(hgOrder.amount)} M币</p>
      <p>订单号：{hgOrder.orderId}</p>
      <p>状态：{this.hgShippingStatusText(hgOrder)}</p>
      <p>运单：{hgOrder.shippingStatus >= 1 && hgOrder.shippingStatus <= 2
        ? `${hgOrder.carrier} · ${hgOrder.trackingNumber}（商家录入，非快递轨迹）` : "—"}</p>
      <p>收件信息：{hgOrder.receiverName} · {hgOrder.receiverPhone} · {hgOrder.receiverAddress}</p>
      <div className={styles.orderActions}>
        {this.hgDetailLink(hgOrder)}
        {hgOrder.shippingStatus === 0 && <button type="button" disabled={this.state.hgBusy}
          onClick={() => this.hgRefund(hgOrder.orderId)}>未发货全额退款</button>}
        {hgOrder.shippingStatus === 1 && <button type="button" disabled={this.state.hgBusy}
          onClick={() => this.hgReceive(hgOrder.orderId)}>确认收货</button>}
      </div>
    </article>
  );

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
      <section className={styles.section} aria-label="已支付商品">
        <h2>已支付商品</h2>
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
          ariaLabel="已支付订单"
        />
      </section>
    );
  }
}

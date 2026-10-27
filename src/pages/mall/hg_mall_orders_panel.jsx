import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import { HGFormatCoin } from "./hg_mall_amount.js";
import { hgSecureRequestId } from "./hg_mall_security.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_mall_page.module.css";

const hgPendingBuyKey = "mlc.mall.pending-buy"; // 与商城下单流程共用的会话键；核对订单后才能清除。

/**
 * 本人商品订单面板：从商城目录迁入用户中心，承载待支付、已支付订单及支付、退款、确认收货。
 * 约束：订单与收件信息只来自服务端授权接口，不跨用户缓存；切出菜单即卸载，不保留后台轮询。
 */
export default class HGMallOrdersPanel extends React.Component {
  state = {
    hgOrders: [], // 本人最多 20 笔当前页已支付订单，不累计历史页。
    hgOrdersCursor: "", // 当前页查询游标；空字符串为第一页。
    hgOrdersNext: "", // 下一页游标；空字符串表示结束。
    hgPendingOrders: [], // 本人当前页待支付及已过期取消订单；不跨用户保存收件信息。
    hgPendingCursor: "", // 待支付记录当前页游标；空字符串代表第一页。
    hgPendingNext: "", // 待支付记录下一页游标；空字符串表示结束。
    hgPendingError: "", // 待支付列表独立的加载错误；不覆盖已支付订单的错误提示。
    hgPendingBuy: false, // 会话内存在结果未知的购买请求时为 true，须核对订单或重试原请求。
    hgBusy: false, // 支付/退款/收货写操作门闩，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgOrdersSeq = 0; // 本人订单请求序号；后发请求覆盖先发请求。
  hgPendingSeq = 0; // 待支付订单请求序号；快速翻页只接受最后一次响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。
  hgRefundRequestIds = new Map(); // 各订单退款幂等键；失败后复用，成功后移除。

  componentDidMount() {
    this.hgMounted = true;
    try {
      this.setState({
        hgPendingBuy: !!sessionStorage.getItem(hgPendingBuyKey),
      });
    } catch {
      /* 禁用存储时仍保留面板内的待确认状态。 */
    }
    this.hgLoadOrders();
    this.hgLoadPending();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgOrdersSeq += 1;
    this.hgPendingSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 只读取本人有界已支付订单页，过期响应不可覆盖新结果。 */
  hgLoadOrders = async (hgCursor = "") => {
    const hgSeq = ++this.hgOrdersSeq;
    try {
      const hgPage = await HGMallVM.orders(hgCursor);
      if (!this.hgMounted || this.hgOrdersSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPage?.list) ||
        typeof hgPage?.hasMore !== "boolean" ||
        typeof hgPage?.nextCursor !== "string"
      )
        throw new Error("商品订单响应异常");
      this.setState({
        hgOrders: hgPage.list,
        hgOrdersCursor: hgCursor,
        hgOrdersNext: hgPage.hasMore ? hgPage.nextCursor : "",
        hgError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgOrdersSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  /** 仅从服务端读取本人有界待支付页；过期状态和支付权限均由后端确定。 */
  hgLoadPending = async (hgCursor = "") => {
    const hgSeq = ++this.hgPendingSeq; // 本次待支付页查询身份，忽略卸载后的旧响应。
    try {
      const hgPage = await HGMallVM.pendingOrders(hgCursor); // 本人订单的收件信息来自鉴权接口。
      if (!this.hgMounted || this.hgPendingSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPage?.list) ||
        typeof hgPage.hasMore !== "boolean" ||
        typeof hgPage.nextCursor !== "string"
      )
        throw new Error("待支付订单响应异常");
      this.setState({
        hgPendingOrders: hgPage.list,
        hgPendingCursor: hgCursor,
        hgPendingNext: hgPage.hasMore ? hgPage.nextCursor : "",
        hgPendingError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgPendingSeq === hgSeq)
        this.setState({ hgPendingError: this.hgMessage(hgError) });
    }
  };

  /**
   * 面板内写操作串行执行；成功后重读两个订单列表并通知余额订阅者刷新。
   * 约束：409 表示订单状态被其他端改变，重取当前待支付页后如实展示错误。
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
        await this.hgLoadOrders();
        await this.hgLoadPending();
      }
    } catch (hgError) {
      if (this.hgMounted) {
        this.setState({ hgError: this.hgMessage(hgError) });
        if (hgError?.status === 409)
          await this.hgLoadPending(this.state.hgPendingCursor);
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
      /* 会话存储不可用时仅清理面板状态。 */
    }
    this.setState({ hgPendingBuy: false });
  };

  /**
   * 渲染待支付与超时取消区块。
   * @returns {React.ReactNode} 待支付订单列表 JSX。
   */
  renderPendingOrders = () => {
    return (
      <section aria-label="我的待支付商品">
        <h3>待支付与超时取消</h3>
        {this.state.hgPendingError && (
          <p role="alert" className={styles.error}>
            {this.state.hgPendingError}{" "}
            <button
              type="button"
              onClick={() => this.hgLoadPending(this.state.hgPendingCursor)}
            >
              重试
            </button>
          </p>
        )}
        {!this.state.hgPendingOrders.length && (
          <p>当前页暂无待支付商品。</p>
        )}
        {this.state.hgPendingOrders.map((hgOrder) => (
          <article className={styles.orderCard} key={hgOrder.orderId}>
            <h4>
              {hgOrder.title} · {hgOrder.quantity} 件 ·{" "}
              {HGFormatCoin(hgOrder.amount)} M币
            </h4>
            <p>
              订单 {hgOrder.orderId} ·{" "}
              {hgOrder.tradeStatus === 1
                ? "待支付"
                : "超时取消，库存已释放"}{" "}
              · 支付截止（UTC）{hgOrder.expiresAt}
            </p>
            <p>
              收件：{hgOrder.receiverName} · {hgOrder.receiverPhone} ·{" "}
              {hgOrder.receiverAddress}
            </p>
            <Link
              to={ROUTE_PATH.MALL_ORDER_DETAIL.replace(
                ":orderId",
                encodeURIComponent(hgOrder.orderId)
              )}
            >
              查看订单详情
            </Link>
            {hgOrder.tradeStatus === 1 && (
              <button
                type="button"
                disabled={this.state.hgBusy}
                onClick={() => this.hgPay(hgOrder.orderId)}
              >
                继续支付 M币
              </button>
            )}
          </article>
        ))}
        <div className={styles.pager}>
          <button
            type="button"
            disabled={!this.state.hgPendingCursor || this.state.hgBusy}
            onClick={() => this.hgLoadPending()}
          >
            最新订单
          </button>
          <button
            type="button"
            disabled={!this.state.hgPendingNext || this.state.hgBusy}
            onClick={() => this.hgLoadPending(this.state.hgPendingNext)}
          >
            下一页待支付记录
          </button>
        </div>
      </section>
    );
  };

  /**
   * 渲染已支付订单卡片列表。
   * @returns {React.ReactNode} 已支付订单 JSX。
   */
  renderPaidOrders = () => {
    return (
      <>
        {!this.state.hgOrders.length && <p>当前页暂无已支付订单。</p>}
        {this.state.hgOrders.map((hgOrder) => (
          <article className={styles.orderCard} key={hgOrder.orderId}>
            <h3>
              {hgOrder.title} · {hgOrder.quantity} 件 ·{" "}
              {HGFormatCoin(hgOrder.amount)} M币
            </h3>
            <p>
              订单 {hgOrder.orderId} ·{" "}
              {hgOrder.shippingStatus === 3
                ? "未发货已退款"
                : hgOrder.shippingStatus === 2
                ? "已确认收货并结算"
                : hgOrder.shippingStatus === 1
                ? "已发货"
                : "已支付，待发货"}
            </p>
            <p>
              收件：{hgOrder.receiverName} · {hgOrder.receiverPhone} ·{" "}
              {hgOrder.receiverAddress}
            </p>
            <Link
              to={ROUTE_PATH.MALL_ORDER_DETAIL.replace(
                ":orderId",
                encodeURIComponent(hgOrder.orderId)
              )}
            >
              查看订单详情
            </Link>
            {hgOrder.shippingStatus >= 1 && hgOrder.shippingStatus <= 2 && (
              <p>
                承运商：{hgOrder.carrier} · 运单号：{hgOrder.trackingNumber}
                （商家录入，非快递轨迹）
              </p>
            )}
            {hgOrder.shippingStatus === 0 && (
              <button
                type="button"
                disabled={this.state.hgBusy}
                onClick={() => this.hgRefund(hgOrder.orderId)}
              >
                未发货全额退款
              </button>
            )}
            {hgOrder.shippingStatus === 1 && (
              <button
                type="button"
                disabled={this.state.hgBusy}
                onClick={() =>
                  this.hgWrite(async () => {
                    await HGMallVM.receive(hgOrder.orderId);
                  }, "已确认收货，商家 M币已结算")
                }
              >
                确认收货
              </button>
            )}
          </article>
        ))}
        <div className={styles.pager}>
          <button
            type="button"
            disabled={!this.state.hgOrdersCursor || this.state.hgBusy}
            onClick={() => this.hgLoadOrders()}
          >
            回到最新订单
          </button>
          <button
            type="button"
            disabled={!this.state.hgOrdersNext || this.state.hgBusy}
            onClick={() => this.hgLoadOrders(this.state.hgOrdersNext)}
          >
            下一页订单
          </button>
        </div>
      </>
    );
  };

  /**
   * 组件主渲染：组装待确认提示、错误与两个订单区块。
   * @returns {React.ReactNode} 面板根节点 JSX。
   */
  render() {
    return (
      <section className={styles.section} aria-label="我的商品订单">
        <h2>我的商品订单</h2>
        {this.state.hgPendingBuy && (
          <p className={styles.notice}>
            有一笔购买结果尚未确认；请先核对订单记录。若未出现订单，可用原商品与相同收货信息重试。
          </p>
        )}
        {this.state.hgPendingBuy && (
          <button type="button" onClick={this.hgClearPendingBuy}>
            我已核对订单，清除待确认请求
          </button>
        )}
        {this.state.hgError && (
          <p role="alert" className={styles.error}>
            {this.state.hgError}{" "}
            <button
              type="button"
              onClick={() => {
                this.hgLoadOrders(this.state.hgOrdersCursor);
                this.hgLoadPending(this.state.hgPendingCursor);
              }}
            >
              重试
            </button>
          </p>
        )}
        {this.state.hgNotice && (
          <p role="status" className={styles.notice}>
            {this.state.hgNotice}
          </p>
        )}
        {this.renderPendingOrders()}
        <h3>已支付商品</h3>
        {this.renderPaidOrders()}
      </section>
    );
  }
}

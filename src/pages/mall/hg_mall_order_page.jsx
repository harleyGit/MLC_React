import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import { HGFormatCoin } from "./hg_mall_amount.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_mall_page.module.css";

/** 独立商品订单详情页；路由只传订单号，地址与价格按登录身份从服务端读取。 */
export default class HGMallOrderPage extends React.Component {
  state = {
    hgOrder: null, // 当前本人或本店订单快照；null 表示尚未读取或读取失败。
    hgLoading: false, // 详情请求进行中为 true；初始 false，由挂载触发首次查询。
    hgBusy: false, // 本人支付请求进行中为 true；同一订单禁止重复提交。
    hgError: "", // 详情或支付错误文案；空字符串表示没有错误。
    hgNotice: "", // 服务端支付成功后的提示；空字符串表示没有提示。
  };
  hgMounted = false; // 页面是否仍挂载，卸载后禁止更新收货隐私快照。
  hgRequest = 0; // 递增查询代次，参数变化或卸载后丢弃旧订单结果。
  hgPaying = false; // 同步支付门闩，避免等待 setState 时重复点击。
  hgPayRequest = 0; // 支付请求代次；路由改变后旧请求不得解除新订单的门闩。

  /** 商家模式由查询参数选择，真实权限仍由服务端商家详情接口校验。 */
  hgIsMerchant = () => this.props.location?.search === "?merchant=1";

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadOrder();
  }

  componentDidUpdate(hgPrevious) {
    if (hgPrevious.params?.orderId !== this.props.params?.orderId || hgPrevious.location?.search !== this.props.location?.search) {
      this.hgRequest += 1;
      this.hgPayRequest += 1;
      this.hgPaying = false;
      this.setState({ hgOrder: null, hgError: "", hgNotice: "", hgBusy: false });
      this.hgLoadOrder();
    }
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgRequest += 1;
    this.hgPayRequest += 1;
  }

  /** 点查本人订单；待支付与过期快照由买家详情接口返回，商家仅查询已支付履约单。 */
  hgLoadOrder = async () => {
    const hgRequest = ++this.hgRequest; // 本次读取身份；旧响应不得覆盖新路由订单。
    const hgOrderId = this.props.params?.orderId; // 路由订单号，仅服务端决定归属与可见字段。
    const hgMerchant = this.hgIsMerchant(); // 本次详情读取的买家或商家入口。
    this.setState({ hgLoading: true, hgError: "" });
    try {
      const hgOrder = hgMerchant ? await HGMallVM.merchantOrderDetail(hgOrderId) : await HGMallVM.orderDetail(hgOrderId); // 服务端权威快照，不使用列表缓存。
      if (this.hgMounted && this.hgRequest === hgRequest) {
        if (!hgOrder || hgOrder.orderId !== hgOrderId) throw new Error("订单详情响应异常");
        this.setState({ hgOrder });
      }
    } catch (hgError) {
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgError: hgError?.message || "订单详情加载失败" });
    } finally {
      if (this.hgMounted && this.hgRequest === hgRequest) this.setState({ hgLoading: false });
    }
  };

  /** 支付只提交本人订单号；成功或冲突后重取详情，不能用本地响应猜测付款结果。 */
  hgPay = async () => {
    if (this.hgPaying || this.hgIsMerchant() || this.state.hgOrder?.tradeStatus !== 1) return;
    this.hgPaying = true;
    const hgPayRequest = ++this.hgPayRequest; // 本次支付的路由代次，离开页面后仅服务端结果仍有效。
    const hgOrderId = this.props.params.orderId; // 提交当前 URL 的订单号，禁止支付旧路由的订单。
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await HGMallVM.pay(hgOrderId);
      if (this.hgMounted && this.hgPayRequest === hgPayRequest) {
        await this.hgLoadOrder();
        if (this.state.hgOrder?.tradeStatus !== 1 && !this.state.hgError) this.setState({ hgNotice: "订单已支付 M币，可在消费记录中查看" });
      }
    } catch (hgError) {
      if (this.hgMounted && this.hgPayRequest === hgPayRequest) {
        await this.hgLoadOrder();
        if (this.state.hgOrder?.tradeStatus !== 1 && this.state.hgOrder && !this.state.hgError) this.setState({ hgNotice: "订单状态已更新，请核对消费记录" });
        else if (!this.state.hgError) this.setState({ hgError: hgError?.message || "支付结果待确认，请刷新订单后重试" });
      }
    } finally {
      if (this.hgPayRequest === hgPayRequest) {
        this.hgPaying = false;
        if (this.hgMounted) this.setState({ hgBusy: false });
      }
    }
  };

  /** 服务端状态决定支付和物流文案，金额与商品名来自下单快照。 */
  renderOrder() {
    const hgOrder = this.state.hgOrder; // 当前授权的订单快照，缺失时由加载/错误区块展示。
    if (!hgOrder) return null;
    const hgStatus = hgOrder.tradeStatus === 1 ? "待支付" : hgOrder.tradeStatus === 5 ? "超时取消，库存已释放" : hgOrder.shippingStatus === 3 ? "未发货已退款" : hgOrder.shippingStatus === 2 ? "已确认收货并结算" : hgOrder.shippingStatus === 1 ? "已发货" : "已支付，待发货"; // 本期实物订单状态。
    return <article className={styles.orderCard}>
      <h2>{hgOrder.title}</h2>
      <p>订单号：{hgOrder.orderId} · {hgStatus}</p>
      <p>商品规格：{hgOrder.skuTitle} · 单价 {HGFormatCoin(hgOrder.unitAmount)} M币 · 数量 {hgOrder.quantity} 件</p>
      <p>订单金额：<strong>{HGFormatCoin(hgOrder.amount)} M币</strong></p>
      {hgOrder.expiresAt && <p>支付截止（UTC）：{hgOrder.expiresAt}</p>}
      <p>收件人：{hgOrder.receiverName}</p>
      <p>联系电话：{hgOrder.receiverPhone}</p>
      <p>收货地址：{hgOrder.receiverAddress}</p>
      {hgOrder.shippingStatus >= 1 && hgOrder.shippingStatus <= 2 && <p>承运商：{hgOrder.carrier} · 运单号：{hgOrder.trackingNumber}（商家录入，非快递轨迹）</p>}
      {!this.hgIsMerchant() && hgOrder.tradeStatus === 1 && <button type="button" disabled={this.state.hgBusy || this.state.hgLoading} onClick={this.hgPay}>继续支付 M币</button>}
    </article>;
  }

  /** 返回保留浏览器链接语义；直接访问和刷新详情页也能回到商品订单。 */
  render() {
    return <main className={styles.page}>
      <div className={styles.content}>
        <Link to={this.hgIsMerchant() ? `${ROUTE_PATH.MALL}?view=merchant` : `${ROUTE_PATH.EDIT_USER_INFO}?menu=orders`}>← 返回商品订单</Link>
        <section className={styles.section} aria-label="商品订单详情">
          <h1>商品订单详情</h1>
          {this.state.hgLoading && <p role="status">正在加载订单详情...</p>}
          {this.state.hgError && <p role="alert" className={styles.error}>{this.state.hgError} <button type="button" onClick={this.hgLoadOrder}>刷新订单</button></p>}
          {this.state.hgNotice && <p role="status" className={styles.notice}>{this.state.hgNotice}</p>}
          {this.renderOrder()}
        </section>
      </div>
    </main>;
  }
}

import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path.jsx";
import { hgSecureRequestId } from "./hg_mall_security.js";
import HGMallCNYVM from "./hg_mall_cny_vm.jsx";
import styles from "./hg_mall_cny_page.module.css";

/** 服务端返回整数分，界面仅作展示格式化，金额决策一律以后端试算为准。 */
const hgYuan = (fen) => `¥${(Number(fen || 0) / 100).toFixed(2)}`;
const hgOrderState = ["待模拟付款", "已付待发货", "等待成团", "已取消", "已模拟退款"];
const hgPendingKey = "mlc.mall.cny.pending"; // 会话内仅保存摘要及幂等键，不保存地址。

/** 人民币沙箱交易页；独立于 M币商城，所有金额以人民币分显示并经服务端确认。 */
export default class HGMallCNYPage extends React.Component {
  state = {
    products: [], // 当前人民币目录页；空表示未获取或没有商品。
    next: "", // 下一页游标；空表示结束。
    detail: null, // 当前商品；null 表示目录页或未加载。
    coupons: [], // 当前商品最多 20 张可领券；切换商品清空。
    groups: [], // 当前商品最多 20 个招募团；切换商品清空。
    orders: [], // 本人当前最多 20 单；只在目录页展示。
    order: null, // 订单详情；null 表示未获取。
    sandbox: false, // 当前后端进程是否显式启用 debug 模拟交易。
    quantity: "1", // 购买件数文本，服务端仅接受 1-10。
    purchaseType: "single", // single、group_create 或 group_join。
    groupId: "", // 参团 ID；单买或开团时为空。
    couponId: "", // 本人已领券 ID；仅单买可选。
    address: "", // 本次收货地址，仅保存在组件内存；空时禁止下单。
    quote: null, // 服务端报价；任一报价要素变化时置空。
    publish: { title: "", description: "", skuTitle: "", priceFen: "", groupPriceFen: "", groupMembers: "0", stock: "" }, // 商家沙箱商品草稿，金额输入为整数分。
    couponDraft: { thresholdFen: "", discountFen: "", quantity: "", expiresAt: "" }, // 商家新券草稿；时间为本地 datetime-local。
    busy: false, // 写入/报价请求进行中时锁定重复提交。
    loading: false, // 当前页面请求进行中。
    error: "", // 最近请求的错误提示；空为无错误。
    notice: "", // 最近写操作成功提示；空为无提示。
  };
  hgMounted = false; // 异步完成后判断组件是否仍挂载。
  hgSequence = 0; // 路由切换时忽略旧请求响应。
  hgFlight = false; // 写请求同步门闩，不依赖 setState 生效时机。

  componentDidMount() { this.hgMounted = true; this.hgLoad(); }
  componentDidUpdate(prev) {
    if (prev.params?.productId !== this.props.params?.productId || prev.params?.orderId !== this.props.params?.orderId || prev.location?.pathname !== this.props.location?.pathname) this.hgLoad();
  }
  componentWillUnmount() { this.hgMounted = false; this.hgSequence += 1; }

  /** 路由驱动单一数据来源，旧详情请求不覆盖新路由。 */
  async hgLoad() {
    const sequence = ++this.hgSequence;
    const { productId, orderId } = this.props.params || {};
    this.setState({ loading: true, error: "", detail: null, order: null, quote: null, coupons: [], groups: [] });
    try {
      const capabilities = await HGMallCNYVM.capabilities();
      if (!this.hgMounted || sequence !== this.hgSequence) return;
      this.setState({ sandbox: Boolean(capabilities.sandbox) });
      if (!capabilities.sandbox) { this.setState({ loading: false, products: [], orders: [] }); return; }
      if (orderId) {
        const order = await HGMallCNYVM.order(orderId);
        if (this.hgMounted && sequence === this.hgSequence) this.setState({ order, loading: false });
      } else if (productId) {
        const [detail, coupons, groups] = await Promise.all([HGMallCNYVM.detail(productId), HGMallCNYVM.coupons(productId), HGMallCNYVM.groups(productId)]);
        if (this.hgMounted && sequence === this.hgSequence) this.setState({ detail, coupons, groups, loading: false, quantity: "1", purchaseType: "single", groupId: "", couponId: "", address: "" });
      } else {
        const [page, orders] = await Promise.all([HGMallCNYVM.products(), HGMallCNYVM.orders()]);
        if (this.hgMounted && sequence === this.hgSequence) this.setState({ products: page.list || [], next: page.nextCursor || "", orders: orders.list || [], loading: false });
      }
    } catch (error) {
      if (this.hgMounted && sequence === this.hgSequence) this.setState({ error: error.message || "人民币商城加载失败", loading: false });
    }
  }

  /** 网络错误不清除原幂等键；同请求摘要重试必须返回同订单。 */
  async hgRun(action, notice = "操作成功") {
    if (this.hgFlight) return null;
    this.hgFlight = true;
    this.setState({ busy: true, error: "", notice: "" });
    try {
      const result = await action();
      if (this.hgMounted) this.setState({ notice });
      return result;
    } catch (error) {
      if (this.hgMounted) this.setState({ error: error.message || "请求失败，请稍后重试" });
      return null;
    } finally {
      this.hgFlight = false;
      if (this.hgMounted) this.setState({ busy: false });
    }
  }

  hgSet(field, value) { this.setState({ [field]: value, quote: null }); }
  hgBaseRequest() {
    const { detail, quantity, purchaseType, groupId, couponId } = this.state;
    return { productId: detail.productId, skuId: detail.skuId, quantity: Number(quantity), purchaseType, groupId: purchaseType === "group_join" ? groupId : "", couponId: purchaseType === "single" ? couponId : "" };
  }
  hgPreview = async () => {
    const quote = await this.hgRun(() => HGMallCNYVM.preview(this.hgBaseRequest()), "报价已刷新；报价不预留库存");
    if (quote && this.hgMounted) this.setState({ quote });
  };
  hgBuy = async () => {
    if (!this.state.quote || !this.state.quote.available || !this.state.address.trim()) { this.setState({ error: "请先填写地址并刷新可用报价" }); return; }
    const request = { ...this.hgBaseRequest(), address: this.state.address.trim(), expectedPayableFen: this.state.quote.payableFen };
    try {
      const { default: net } = await import("../../api/HttpManagerV1.js");
      const digest = await net.sha256Hex(JSON.stringify(request));
      const pending = JSON.parse(sessionStorage.getItem(hgPendingKey) || "null");
      const requestId = pending?.digest === digest ? pending.requestId : hgSecureRequestId();
      sessionStorage.setItem(hgPendingKey, JSON.stringify({ digest, requestId }));
      const order = await this.hgRun(() => HGMallCNYVM.buy({ ...request, requestId }), "已预留库存，请在支付时限内完成模拟付款");
      if (order) { sessionStorage.removeItem(hgPendingKey); this.props.navigate(ROUTE_PATH.MALL_CNY_ORDER.replace(":orderId", encodeURIComponent(order.orderId))); }
    } catch (error) {
      if (this.hgMounted) this.setState({ error: error.message || "无法安全保存幂等键，请勿发起交易" });
    }
  };

  hgOrderAction = async (type) => {
    const { order } = this.state;
    const updated = await this.hgRun(() => HGMallCNYVM[type](order.orderId), "订单状态已更新");
    if (updated && this.hgMounted) this.setState({ order: updated });
  };
  hgClaim = async (couponId) => {
    if (await this.hgRun(() => HGMallCNYVM.claim(this.state.detail.productId, couponId), "已领取，请选券重新试算")) this.hgSet("couponId", couponId);
  };
  hgPublish = async () => {
    const p = this.state.publish;
    const body = { title: p.title.trim(), description: p.description.trim(), imageUrl: "", skuTitle: p.skuTitle.trim(), priceFen: Number(p.priceFen), groupPriceFen: p.groupMembers === "0" ? null : Number(p.groupPriceFen), groupMembers: Number(p.groupMembers), stock: Number(p.stock) };
    if (await this.hgRun(() => HGMallCNYVM.publish(body), "人民币商品发布成功")) this.hgLoad();
  };
  hgCreateCoupon = async () => {
    const p = this.state.couponDraft;
    if (!Number.isFinite(new Date(p.expiresAt).getTime())) { this.setState({ error: "请输入有效的优惠券截止时间" }); return; }
    const body = { productId: this.state.detail.productId, thresholdFen: Number(p.thresholdFen), discountFen: Number(p.discountFen), quantity: Number(p.quantity), expiresAt: new Date(p.expiresAt).toISOString() };
    if (await this.hgRun(() => HGMallCNYVM.createCoupon(body), "优惠券已创建")) this.hgLoad();
  };

  renderCatalog() {
    const { products, orders, next, sandbox, publish: p, busy } = this.state;
    return <>
      <header className={styles.hero}><span className={styles.tag}>独立人民币 · 模拟交易</span><h1>发现好物，轻松拼单</h1><p>商品单价、优惠试算和拼团金额均由服务端计算；不扣 M币，也不进行真实支付宝收款。</p></header>
      {!sandbox && <p className={styles.warning}>当前未启用 debug 沙箱，付款、退款、下单及发布均不可用。</p>}
      <h2>人民币商品</h2><div className={styles.grid}>{products.map((item) => <Link key={item.productId} className={styles.card} to={ROUTE_PATH.MALL_CNY_DETAIL.replace(":productId", encodeURIComponent(item.productId))}><div className={styles.placeholder}>精选好物</div><h3>{item.title}</h3><p>{item.shopName} · {item.skuTitle}</p><strong>{hgYuan(item.priceFen)}</strong>{item.groupPriceFen != null && <small>拼单 {hgYuan(item.groupPriceFen)} · {item.groupMembers} 人成团</small>}</Link>)}</div>
      {!products.length && <p className={styles.empty}>暂无独立人民币商品，商家可在下方创建沙箱商品。</p>}
      {next && <button disabled={busy} onClick={async () => { const page = await this.hgRun(() => HGMallCNYVM.products(next), "已加载下一页"); if (page) this.setState({ products: page.list || [], next: page.nextCursor || "" }); }}>下一页</button>}
      <h2>我的人民币订单</h2><div className={styles.orders}>{orders.map((order) => <Link key={order.orderId} to={ROUTE_PATH.MALL_CNY_ORDER.replace(":orderId", encodeURIComponent(order.orderId))}>{order.title} · {hgYuan(order.payableFen)} · {hgOrderState[order.status]}</Link>)}</div>
      {sandbox && <section className={styles.panel}><h2>已审核商家 · 沙箱发布</h2><p>金额直接输入整数分；图片暂不支持绑定，发布后不能伪造他店图片。</p><div className={styles.form}>{[ ["title", "商品名称"], ["skuTitle", "规格"], ["priceFen", "单买价（分）"], ["groupPriceFen", "拼单价（分）"], ["groupMembers", "成团人数（0 为不拼团）"], ["stock", "库存（件）"] ].map(([field,label]) => <label key={field}>{label}<input value={p[field]} onChange={(event) => this.setState({ publish: { ...p, [field]: event.target.value } })} /></label>)}<label>商品介绍<textarea value={p.description} onChange={(event) => this.setState({ publish: { ...p, description: event.target.value } })} /></label></div><button disabled={busy} onClick={this.hgPublish}>发布人民币商品</button></section>}
    </>;
  }

  renderDetail() {
    const { detail: product, coupons, groups, sandbox, quantity, purchaseType, groupId, couponId, address, quote, busy, couponDraft: draft } = this.state;
    return <><Link to={ROUTE_PATH.MALL_CNY}>← 人民币商品列表</Link><div className={styles.detail}><div className={styles.placeholder}>独立 CNY 商品</div><div><span className={styles.tag}>{product.shopName}</span><h1>{product.title}</h1><p>{product.description}</p><p>{product.skuTitle} · 库存 {product.available} 件</p><strong>{hgYuan(product.priceFen)}</strong>{product.groupPriceFen != null && <p>拼单价 {hgYuan(product.groupPriceFen)} · {product.groupMembers} 人成团</p>}</div></div>
      <section className={styles.panel}><h2>优惠券与拼团</h2><div className={styles.grid}>{coupons.map((coupon) => <div className={styles.card} key={coupon.couponId}><strong>满 {hgYuan(coupon.thresholdFen)} 减 {hgYuan(coupon.discountFen)}</strong><p>到期 {new Date(coupon.expiresAt).toLocaleString()}</p><button disabled={!sandbox || busy} onClick={() => this.hgClaim(coupon.couponId)}>领取并选用</button></div>)}</div><p>优惠券仅限单买；拼单不叠券。领取失败请核对是否已领取或已到期。</p><div className={styles.orders}>{groups.map((group) => <button key={group.groupId} disabled={!sandbox || busy} onClick={() => this.setState({ purchaseType: "group_join", groupId: group.groupId, couponId: "", quote: null })}>参团 · 已付 {group.paidMembers}/{group.targetMembers} · 截止 {new Date(group.expiresAt).toLocaleString()}</button>)}</div></section>
      {sandbox && <section className={styles.panel}><h2>确认价格与下单</h2><div className={styles.form}><label>购买方式<select value={purchaseType} onChange={(event) => this.setState({ purchaseType: event.target.value, groupId: "", couponId: "", quote: null })}><option value="single">单买</option>{product.groupPriceFen != null && <option value="group_create">发起拼团</option>}{product.groupPriceFen != null && <option value="group_join">加入拼团</option>}</select></label>{purchaseType === "group_join" && <label>拼团编号<input value={groupId} onChange={(event) => this.hgSet("groupId", event.target.value)} /></label>}<label>数量（1-10 件）<input type="number" min="1" max="10" value={quantity} onChange={(event) => this.hgSet("quantity", event.target.value)} /></label>{purchaseType === "single" && <label>本人优惠券编号（领取后自动选中）<input value={couponId} onChange={(event) => this.hgSet("couponId", event.target.value)} /></label>}<label>收货地址（仅本次订单）<textarea value={address} maxLength={512} onChange={(event) => this.hgSet("address", event.target.value)} /></label></div><button disabled={busy} onClick={this.hgPreview}>获取服务端报价</button>{quote && <p>小计 {hgYuan(quote.totalFen)} · 优惠 {hgYuan(quote.discountFen)} · 应付 <strong>{hgYuan(quote.payableFen)}</strong> {quote.available ? "库存快照可售" : "库存不足"}</p>}<button className={styles.primary} disabled={busy || !quote?.available || !address.trim()} onClick={this.hgBuy}>确认并创建待付款订单</button></section>}
      {sandbox && <section className={styles.panel}><h2>已审核商家 · 创建本商品优惠券</h2><div className={styles.form}>{[["thresholdFen","门槛（分）"],["discountFen","优惠（分）"],["quantity","发券数量"]].map(([field,label]) => <label key={field}>{label}<input value={draft[field]} onChange={(event) => this.setState({ couponDraft: { ...draft, [field]: event.target.value } })} /></label>)}<label>截止时间<input type="datetime-local" value={draft.expiresAt} onChange={(event) => this.setState({ couponDraft: { ...draft, expiresAt: event.target.value } })} /></label></div><button disabled={busy} onClick={this.hgCreateCoupon}>创建优惠券</button></section>}
    </>;
  }

  renderOrder() {
    const { order, sandbox, busy } = this.state;
    return <><Link to={ROUTE_PATH.MALL_CNY}>← 返回人民币商城</Link><section className={styles.panel}><span className={styles.tag}>模拟支付宝 · 非真实收款</span><h1>订单 {order.orderId}</h1><p>{order.title} · {order.quantity} 件 · {order.purchaseType}</p><p>{hgOrderState[order.status]} · 应付 {hgYuan(order.payableFen)} · 优惠 {hgYuan(order.discountFen)}</p><p>付款截止 {new Date(order.expiresAt).toLocaleString()}</p>{order.groupId && <p>拼团编号 {order.groupId} · 失败团由后台自动退款</p>}{sandbox && <div className={styles.actions}>{order.status === 0 && <><button disabled={busy} className={styles.primary} onClick={() => this.hgOrderAction("pay")}>模拟支付宝付款</button><button disabled={busy} onClick={() => this.hgOrderAction("cancel")}>取消并释放库存</button></>}{order.status === 1 && <button disabled={busy} onClick={() => this.hgOrderAction("refund")}>申请模拟全额退款</button>}{order.status === 2 && <button disabled={busy} onClick={() => this.hgOrderAction("refund")}>团失败后模拟退款</button>}</div>}</section></>;
  }

  render() {
    const { loading, error, notice, detail, order, sandbox } = this.state;
    return <main className={styles.page} aria-label="独立人民币沙箱商城">{error && <p role="alert" className={styles.warning}>{error}</p>}{notice && <p role="status" className={styles.notice}>{notice}</p>}{loading ? <p role="status">正在加载人民币商城...</p> : !sandbox ? <p className={styles.warning}>当前环境未开启独立人民币沙箱，模拟商品和交易接口不可用。<Link to={ROUTE_PATH.PRODUCTS}>返回 M币商城</Link></p> : order ? this.renderOrder() : detail ? this.renderDetail() : this.props.params?.productId || this.props.params?.orderId ? <p>未找到商品或订单，请返回 <Link to={ROUTE_PATH.MALL_CNY}>人民币目录</Link></p> : this.renderCatalog()}</main>;
  }
}

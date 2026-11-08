import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path.jsx";
import HGCommerceVM from "./hg_commerce_vm.js";
import { hgCentToYuan } from "./hg_commerce_amount.js";
import { hgSecureRequestId } from "./hg_mall_security.js";
import styles from "./hg_merchant_center.module.css";

/** 仅在 Vite debug 模式展示隔离 SIMULATED 操作；后端仍独立校验环境、JWT、IAM 与订单归属。 */
export default class HGCommerceDebugTradePage extends React.Component {
  state = {
    hgProduct: null, // 查询到的线上商品详情；null 表示无商品或尚未加载。
    hgSKU: "", // 待试算的线上 SKU ID；空时不可下单。
    hgQuantity: "1", // 买家输入的件数文本，提交时限制为1-10。
    hgAddresses: [], // 本人最多20条地址；空表示未登记或尚未读取。
    hgAddress: "", // 本人选定地址业务 ID；空时不能提交。
    hgQuote: null, // 服务端报价；null 表示尚未确认或输入已变化。
    hgOrders: [], // 本人最多20笔订单；默认空。
    hgSellerOrders: [], // 本店最多20笔已付订单；仅手动查询，空不表示无商家权限。
    hgMerchantProduct: "", // 盘点所需本店商品 ID，默认空。
    hgMerchantSKU: "", // 盘点所需 SKU 编码，默认空。
    hgStock: null, // 本店权威库存与版本；null 表示尚未按 SKU 查询。
    hgDelta: "", // 人工盘点的有符号整数件数文本，空时不可提交。
    hgReason: "", // 人工盘点依据，空时不可提交。
    hgOrderID: "", // 管理员按单模拟收款/对账的订单 ID，默认空。
    hgReconciliation: null, // 单订单只读对账结果；null 表示尚未查询。
    hgCarrier: "", // 商家人工承运商文本，空时禁止发货。
    hgTracking: "", // 商家人工运单号，空时禁止发货。
    hgBusy: false, // 当前写请求门闩；true 时禁止重复提交。
    hgError: "", // 当前操作错误文案，空表示无错误。
    hgNotice: "", // 当前成功反馈，空表示无成功提示。
  };
  hgMounted = false; // 卸载后不再写入 React state。
  hgFlight = false; // 同步写门闩，不依赖异步 setState 阻止重复点击。
  hgPendingCreate = null; // 结果未知时保留原正文与幂等键供原样重试；成功后清除。

  componentDidMount() {
    this.hgMounted = true;
    if (import.meta.env.MODE !== "debug") return;
    this.hgLoadBuyer();
  }
  componentWillUnmount() { this.hgMounted = false; }

  /** 只自动读取本人资料；商家/管理员权限数据均由对应按钮明确请求。 */
  hgLoadBuyer = async () => {
    try {
      const hgProductID = new URLSearchParams(this.props.location?.search || "").get("productId"); // 路由注入的可选商品 ID；空表示只看订单。
      const [hgAddresses, hgPage, hgProduct] = await Promise.all([
        HGCommerceVM.addresses(), HGCommerceVM.orders(), hgProductID ? HGCommerceVM.detail(hgProductID) : Promise.resolve(null),
      ]);
      if (!this.hgMounted) return;
      this.setState({
        hgAddresses: Array.isArray(hgAddresses) ? hgAddresses : [],
        hgAddress: (Array.isArray(hgAddresses) ? hgAddresses.find((hgItem) => hgItem.isDefault) || hgAddresses[0] : null)?.addressId || "",
        hgOrders: hgPage?.list || [], hgProduct, hgSKU: hgProduct?.skus?.[0]?.skuId || "",
      });
    } catch (hgError) { if (this.hgMounted) this.setState({ hgError: hgError?.message || "debug 交易资料读取失败" }); }
  };

  /** 写动作仅复用有签名/JWT 的 VM；失败保留草稿和幂等键，允许用户原样重试。 */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgFlight) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      const hgResult = await hgAction(); // 操作成功才允许展示结果；模拟入账结果由服务端返回。
      if (this.hgMounted) this.setState({ hgNotice: typeof hgSuccess === "function" ? hgSuccess(hgResult) : hgSuccess });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: hgError?.message || "操作失败，请核对订单状态后重试" });
    } finally {
      this.hgFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  hgRefreshOrders = async () => {
    const hgPage = await HGCommerceVM.orders(); // 仅刷新本人最新20笔订单。
    if (this.hgMounted) this.setState({ hgOrders: hgPage?.list || [] });
  };

  hgQuoteOrder = () => this.hgWrite(async () => {
    const hgQuantity = Number(this.state.hgQuantity); // 文本数量仅在符合有界整数时转换。
    if (!this.state.hgQuantity.trim() || !Number.isInteger(hgQuantity) || hgQuantity < 1 || hgQuantity > 10 || !this.state.hgProduct || !this.state.hgAddress || !this.state.hgSKU) throw new Error("请选择规格与本人地址，并输入1-10件");
    const hgBody = { productId: this.state.hgProduct.productId, skuId: this.state.hgSKU, addressId: this.state.hgAddress, quantity: hgQuantity, expectedCent: 1, requestId: hgSecureRequestId() }; // 试算协议要求有效字段；金额由服务端返回。
    const hgQuote = await HGCommerceVM.quote(hgBody); // 返回金额后必须再次明确下单。
    if (this.hgMounted) this.setState({ hgQuote });
  }, "服务端报价已返回；这不是已锁库存或已支付");

  hgCreateOrder = () => this.hgWrite(async () => {
    if (!this.state.hgQuote && !this.hgPendingCreate) throw new Error("请先读取服务端报价");
    if (!this.hgPendingCreate) {
      const hgQuote = this.state.hgQuote; // 只有服务端响应的整数分金额可参与建单。
      if (!Number.isSafeInteger(hgQuote.totalCent) || hgQuote.totalCent <= 0) throw new Error("报价格式无效，请重新试算");
      this.hgPendingCreate = { productId: hgQuote.productId, skuId: hgQuote.skuId, quantity: hgQuote.quantity, addressId: this.state.hgAddress, expectedCent: hgQuote.totalCent, requestId: hgSecureRequestId() };
    }
    await HGCommerceVM.order(this.hgPendingCreate);
    this.hgPendingCreate = null;
    if (this.hgMounted) this.setState({ hgQuote: null });
    await this.hgRefreshOrders();
  }, "已预占库存；待模拟渠道确认，不代表真实付款");

  /** 输入变化立即作废报价；创建结果未知时冻结输入，防止同一请求键对应不同订单正文。 */
  hgSetOrderInput = (hgKey, hgValue) => {
    if (this.hgPendingCreate) return;
    this.setState({ [hgKey]: hgValue, hgQuote: null, hgError: "" });
  };

  hgOrderAction = (hgOrder, hgAction) => this.hgWrite(async () => {
    if (hgAction === "payment") await HGCommerceVM.pay(hgOrder.orderId);
    else if (hgAction === "cancel") await HGCommerceVM.cancel(hgOrder.orderId);
    else if (hgAction === "refund") await HGCommerceVM.refund(hgOrder.orderId);
    await this.hgRefreshOrders();
  }, hgAction === "payment" ? "仅创建待回调的模拟支付尝试，请管理员再确认模拟收款" : "订单状态已更新");

  hgLoadStock = () => this.hgWrite(async () => {
    const hgStock = await HGCommerceVM.stock(this.state.hgMerchantProduct.trim(), this.state.hgMerchantSKU.trim()); // 版本来自本店权威库存。
    if (this.hgMounted) this.setState({ hgStock });
  }, "已读取本店库存与版本");

  hgAdjustStock = () => this.hgWrite(async () => {
    const hgDelta = Number(this.state.hgDelta); // 仅接受有界整数件数，不读取建议库存。
    if (!this.state.hgDelta.trim() || !Number.isInteger(hgDelta) || hgDelta === 0 || Math.abs(hgDelta) > 100000 || !this.state.hgStock || !this.state.hgReason.trim()) throw new Error("请输入盘点件数、依据并先查询库存版本");
    await HGCommerceVM.adjustStock({ productId: this.state.hgMerchantProduct.trim(), skuCode: this.state.hgMerchantSKU.trim(), delta: hgDelta, expectedVersion: this.state.hgStock.version, reason: this.state.hgReason.trim() });
    const hgStock = await HGCommerceVM.stock(this.state.hgMerchantProduct.trim(), this.state.hgMerchantSKU.trim()); // 重新读取权威版本。
    if (this.hgMounted) this.setState({ hgStock, hgDelta: "", hgReason: "" });
  }, "库存盘点与审计已提交");

  hgLoadSeller = () => this.hgWrite(async () => {
    const hgPage = await HGCommerceVM.sellerOrders(); // 未获本店订单读取权时由服务端拒绝。
    if (this.hgMounted) this.setState({ hgSellerOrders: hgPage?.list || [] });
  }, "已刷新本店已付订单");

  hgShip = (hgOrderID) => this.hgWrite(async () => {
    await HGCommerceVM.ship({ orderId: hgOrderID, carrier: this.state.hgCarrier.trim(), trackingNumber: this.state.hgTracking.trim() });
    const hgPage = await HGCommerceVM.sellerOrders(); // 发货后刷新最新状态，避免重复操作。
    if (this.hgMounted) this.setState({ hgSellerOrders: hgPage?.list || [], hgCarrier: "", hgTracking: "" });
  }, "已登记模拟已付款订单的物流；真实支付未开放");

  hgSettle = () => this.hgWrite(
    () => HGCommerceVM.settle(this.state.hgOrderID.trim()), // 服务端签名，前端永不接触模拟密钥。
    (hgResult) => `模拟渠道处理结果：${hgResult.result}；请查询订单对账结果`
  );

  hgReconcile = () => this.hgWrite(async () => {
    const hgReconciliation = await HGCommerceVM.reconcile(this.state.hgOrderID.trim()); // 只读检测，不覆盖库存或订单。
    if (this.hgMounted) this.setState({ hgReconciliation });
  }, "模拟账本对账已完成");

  renderBuyer() {
    const { hgProduct,hgSKU,hgQuantity,hgAddress,hgAddresses,hgQuote,hgOrders,hgBusy } = this.state;
    return <section className={styles.sectionCard}><div className={styles.sectionHead}><h2>买家 · debug 订单</h2></div><div className={styles.sectionBody}>
      {hgProduct && <><h3>{hgProduct.title}</h3><label htmlFor="commerce-debug-sku">规格</label><select id="commerce-debug-sku" disabled={hgBusy || !!this.hgPendingCreate} value={hgSKU} onChange={(hgEvent) => this.hgSetOrderInput("hgSKU", hgEvent.target.value)}>{hgProduct.skus?.map((hgItem) => <option key={hgItem.skuId} value={hgItem.skuId}>{hgItem.skuCode} · {hgCentToYuan(hgItem.priceCent)}</option>)}</select>
        <label htmlFor="commerce-debug-qty">件数（1-10）</label><input id="commerce-debug-qty" type="number" min="1" max="10" value={hgQuantity} disabled={hgBusy || !!this.hgPendingCreate} onChange={(hgEvent) => this.hgSetOrderInput("hgQuantity", hgEvent.target.value)} />
        <label htmlFor="commerce-debug-address">本人地址</label><select id="commerce-debug-address" value={hgAddress} disabled={hgBusy || !!this.hgPendingCreate} onChange={(hgEvent) => this.hgSetOrderInput("hgAddress", hgEvent.target.value)}><option value="">请选择已登记地址</option>{hgAddresses.map((hgItem) => <option key={hgItem.addressId} value={hgItem.addressId}>{hgItem.region} · {hgItem.detailAddress}</option>)}</select>
        <div className={styles.actions}><button type="button" className={styles.btnGhost} disabled={hgBusy || !!this.hgPendingCreate} onClick={this.hgQuoteOrder}>获取服务端报价</button><button type="button" className={styles.btn} disabled={hgBusy || (!hgQuote && !this.hgPendingCreate)} onClick={this.hgCreateOrder}>{this.hgPendingCreate ? "原样重试建单" : "确认预占库存"}</button></div>
        {hgQuote && <p role="status">报价 {hgCentToYuan(hgQuote.totalCent)}；库存可能随时变化，确认后才创建待支付订单。</p>}
      </>}
      <div className={styles.actions}><Link to={ROUTE_PATH.COMMERCE_PRODUCTS}>选择人民币商品</Link><button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={this.hgRefreshOrders}>刷新本人订单</button></div>
      {hgOrders.map((hgOrder) => <article key={hgOrder.orderId} className={styles.pendingPanel}><strong>{hgOrder.title} · {hgOrder.orderId}</strong><p>{hgCentToYuan(hgOrder.totalCent)} · 状态 {hgOrder.status}（1待支付 / 2模拟已付 / 3已发货 / 5取消 / 6模拟退款）</p>
        <div className={styles.actions}>{hgOrder.status===1 && <><button type="button" className={styles.btn} disabled={hgBusy} onClick={() => this.hgOrderAction(hgOrder,"payment")}>创建模拟支付尝试</button><button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={() => this.hgOrderAction(hgOrder,"cancel")}>取消预占</button></>}{hgOrder.status===2 && <button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={() => this.hgOrderAction(hgOrder,"refund")}>模拟未发货退款</button>}</div>
      </article>)}
    </div></section>;
  }

  renderMerchant() {
    const {hgMerchantProduct,hgMerchantSKU,hgStock,hgDelta,hgReason,hgSellerOrders,hgCarrier,hgTracking,hgBusy}=this.state;
    return <section className={styles.sectionCard}><div className={styles.sectionHead}><h2>商家 · 库存与发货</h2></div><div className={styles.sectionBody}>
      <label htmlFor="commerce-debug-product">本店商品 ID</label><input id="commerce-debug-product" value={hgMerchantProduct} onChange={(e)=>this.setState({hgMerchantProduct:e.target.value,hgStock:null})} />
      <label htmlFor="commerce-debug-sku-code">当前公开 SKU 编码</label><input id="commerce-debug-sku-code" value={hgMerchantSKU} onChange={(e)=>this.setState({hgMerchantSKU:e.target.value,hgStock:null})} />
      <button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={this.hgLoadStock}>读取本人库存版本</button>
      {hgStock && <p>可售 {hgStock.available} 件 · 预占 {hgStock.reserved} 件 · 已售 {hgStock.sold} 件 · 版本 {hgStock.version}</p>}
      <label htmlFor="commerce-debug-delta">盘点增减件数</label><input id="commerce-debug-delta" type="number" value={hgDelta} onChange={(e)=>this.setState({hgDelta:e.target.value})} />
      <label htmlFor="commerce-debug-reason">盘点依据（审计）</label><input id="commerce-debug-reason" maxLength="256" value={hgReason} onChange={(e)=>this.setState({hgReason:e.target.value})} />
      <button type="button" className={styles.btn} disabled={hgBusy || !hgStock} onClick={this.hgAdjustStock}>按版本确认盘点</button>
      <button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={this.hgLoadSeller}>读取本店已付订单</button>
      <label htmlFor="commerce-debug-carrier">承运商</label><input id="commerce-debug-carrier" maxLength="64" value={hgCarrier} onChange={(e)=>this.setState({hgCarrier:e.target.value})} />
      <label htmlFor="commerce-debug-tracking">运单号</label><input id="commerce-debug-tracking" maxLength="128" value={hgTracking} onChange={(e)=>this.setState({hgTracking:e.target.value})} />
      {hgSellerOrders.map((hgOrder)=><article key={hgOrder.orderId} className={styles.pendingPanel}><strong>{hgOrder.title} · {hgOrder.orderId}</strong><p>状态 {hgOrder.status} · {hgCentToYuan(hgOrder.totalCent)}</p>{hgOrder.status===2 && <button type="button" className={styles.btn} disabled={hgBusy || !hgCarrier.trim() || !hgTracking.trim()} onClick={()=>this.hgShip(hgOrder.orderId)}>确认模拟付款订单发货</button>}</article>)}
    </div></section>;
  }

  renderAdmin() {
    const {hgOrderID,hgReconciliation,hgBusy}=this.state;
    return <section className={styles.sectionCard}><div className={styles.sectionHead}><h2>审核员 · 隔离模拟渠道</h2></div><div className={styles.sectionBody}>
      <p>仅拥有审核权限的账号可触发服务器端签名模拟收款；无需也不得在浏览器输入回调密钥。此流程与支付宝、微信无关。</p>
      <label htmlFor="commerce-debug-order-id">待操作订单 ID</label><input id="commerce-debug-order-id" value={hgOrderID} onChange={(e)=>this.setState({hgOrderID:e.target.value,hgReconciliation:null})} />
      <div className={styles.actions}><button type="button" className={styles.btn} disabled={hgBusy || !hgOrderID.trim()} onClick={this.hgSettle}>模拟收款并验签入账</button><button type="button" className={styles.btnGhost} disabled={hgBusy || !hgOrderID.trim()} onClick={this.hgReconcile}>只读对账</button></div>
      {hgReconciliation && <p role="status">订单 {hgReconciliation.orderId}：{hgReconciliation.drift ? "检测到漂移，请人工排查" : "模拟账本未检测到漂移"}；订单状态 {hgReconciliation.orderStatus}，退款状态 {hgReconciliation.refundStatus}。</p>}
    </div></section>;
  }

  render() {
    if (import.meta.env.MODE!=="debug") return <main className={styles.page}>隔离模拟交易仅在 debug 构建中可用，正式渠道尚未开放。</main>;
    const {hgError,hgNotice}=this.state; // 操作反馈只展示文本，不包含用户或渠道秘密。
    return <main className={styles.page} aria-label="生产人民币 debug 隔离交易"><section className={styles.panel}><div className={styles.head}><h1>人民币商品 · debug 模拟交易</h1></div><p className={styles.desc}>仅隔离测试：SIMULATED 不是真实支付宝/微信支付，pre/prod 不开放。订单金额均由服务端重算。</p>
      {hgError && <p role="alert" className={styles.errorBar}>{hgError}</p>}{hgNotice && <p role="status" className={styles.noticeBar}>{hgNotice}</p>}
      {this.renderBuyer()}{this.renderMerchant()}{this.renderAdmin()}
    </section></main>;
  }
}

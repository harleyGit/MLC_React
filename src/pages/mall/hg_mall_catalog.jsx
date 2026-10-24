import React from "react";
import HGMallVM from "./hg_mall_vm.js";
import { HGFormatCoin } from "./hg_mall_amount.js";
import { HGAdvanceMallPage } from "./hg_mall_cursor.js";
import styles from "./hg_mall_page.module.css";

const hgCategories = [
  ["", "全部商品"], ["digital", "数码影音"], ["appliance", "家用电器"],
  ["clothing", "服饰"], ["beauty", "美妆个护"], ["membership", "会员"],
]; // 与 Go 服务端类目白名单对齐，不从原型构造商品记录。

const hgPendingBuyKey = "mlc.mall.pending-buy"; // 仅在会话内保存幂等键和请求摘要，不落盘收件隐私明文。

/** 摘要绑定同一次购买的商品、数量及地址；失败后的未知结果只能使用原幂等键重试。 */
async function hgPurchaseDigest(hgRequest) {
  const { default: hgNet } = await import("../../api/HttpManagerV1.js");
  return hgNet.sha256Hex(JSON.stringify(hgRequest)); // 复用局域网 HTTP 环境的 SHA-256 降级实现。
}

/** 用安全随机字节生成可重试的订单请求标识；无随机源时拒绝交易而非退化为 Math.random。 */
function hgSecureRequestId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  if (!globalThis.crypto?.getRandomValues) throw new Error("浏览器不支持安全随机数，无法发起交易");
  return Array.from(globalThis.crypto.getRandomValues(new Uint8Array(16)), (hgValue) => hgValue.toString(16).padStart(2, "0")).join("");
}

/** 商城目录和商家工作台；全部商品、审核及发布结果来自服务端。 */
export default class HGMallCatalog extends React.Component {
  state = {
    hgView: "catalog", // catalog、merchant、orders、review 四种视图，默认展示已审核目录。
    hgCategory: "", // 空字符串为全部类目，其他值必须来自服务端白名单。
    hgItems: [], // 当前目录页，初始为空，不缓存无限历史页面。
    hgCursor: "", // 当前请求游标；空字符串代表第一页。
    hgNext: "", // 下一页游标；空字符串意味着不能继续翻页。
    hgHistory: [], // 当前类目最近最多 64 页的旧游标，限制亿级目录下前端内存使用。
    hgHistoryBase: 0, // 被丢弃的更早返回游标数量；换类目时归零，仍可准确显示当前页码。
    hgDetail: null, // 正在查看的商品详情；null 为目录视图。
    hgMerchant: null, // 本人商家申请；null 代表尚未申请或尚未加载。
    hgMine: [], // 本店至多 20 件商品，默认空。
    hgMerchantNext: "", // 本店下页游标；空为没有后续页。
    hgPendingMerchants: [], // 审核员当前页商家申请，未授权时为空。
    hgPendingProducts: [], // 审核员当前页商品，未授权时为空。
    hgReviewCursor: "", // 待审商家当前页游标。
    hgReviewNext: "", // 待审商家下一页游标。
    hgProductReviewCursor: "", // 待审商品当前页游标。
    hgProductReviewNext: "", // 待审商品下一页游标。
    hgCanReview: false, // 仅审核 API 返回成功才显示审核入口。
    hgShopName: "", // 用户输入的店铺名；提交前无默认值。
    hgDraft: { type: "PHYSICAL_PRODUCT", category: "digital", title: "", summary: "", skuTitle: "", amount: "" }, // 商品草稿输入；金额为用户输入的整币文本。
    hgStock: "", // 新发布实物商品初始库存文本；会员不填，服务端校验 1-100000。
    hgBuyForm: { quantity: "1", receiverName: "", receiverPhone: "", receiverAddress: "" }, // 当前商品一次性收货快照；不可当作地址簿复用。
    hgOrders: [], // 本人最多 20 笔当前页实物订单，不累计历史页。
    hgOrdersCursor: "", // 本人当前页查询游标；空字符串为第一页。
    hgOrdersNext: "", // 本人订单下一页游标；空字符串表示结束。
    hgSellerOrders: [], // 本店最多 20 笔当前页订单，商家身份服务端校验。
    hgSellerCursor: "", // 本店当前页查询游标；空字符串为第一页。
    hgSellerNext: "", // 本店订单下一页游标；空字符串表示结束。
    hgShipping: { orderId: "", carrier: "", trackingNumber: "" }, // 当前填写的待发货运单；未选择订单时 ID 为空。
    hgLoading: false, // 目录或详情请求是否正在加载。
    hgBusy: false, // 审核/申请/发布写操作门闩，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
    hgPendingBuy: false, // 本会话有结果未知的购买请求时为 true；须核对订单或重试原请求。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 目录与详情读操作递增序号，忽略旧请求。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。
  hgBuyRequestId = ""; // 当前一次购买尝试的幂等键；失败后保持，修改请求内容时作废。
  hgRefundRequestIds = new Map(); // 各订单退款幂等键；失败后复用，成功后移除。
  hgOrdersSeq = 0; // 本人订单请求序号；后发请求覆盖先发请求。
  hgSellerSeq = 0; // 本店订单请求序号；切换视图后不提交旧响应。
  hgMerchantSeq = 0; // 本店商品页请求序号；快速翻页只接受最后一次响应。
  hgReviewSeq = 0; // 审核双列表请求序号；不同游标响应不可相互覆盖。

  componentDidMount() {
    this.hgMounted = true;
    try { this.setState({ hgPendingBuy: !!sessionStorage.getItem(hgPendingBuyKey) }); } catch { /* 禁用存储时仍保留当前组件内的幂等键。 */ }
    this.hgLoadCatalog("", "", []);
    this.hgLoadReviewAccess();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
    this.hgOrdersSeq += 1;
    this.hgSellerSeq += 1;
    this.hgMerchantSeq += 1;
    this.hgReviewSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 仅加载单个有界游标页，切换类目/翻页时旧响应不可覆盖新结果。 */
  hgLoadCatalog = async (hgCategory, hgCursor, hgHistory, hgHistoryBase = 0) => {
    const hgSeq = ++this.hgSeq;
    this.setState({ hgLoading: true, hgError: "", hgDetail: null, hgCategory, hgItems: [], hgNext: "", hgCursor, hgHistory, hgHistoryBase });
    try {
      const hgPage = await HGMallVM.products(hgCategory, hgCursor);
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (!Array.isArray(hgPage?.list) || typeof hgPage.hasMore !== "boolean" || typeof hgPage.nextCursor !== "string" || (hgPage.hasMore && (!hgPage.nextCursor || hgPage.nextCursor === hgCursor)))
        throw new Error("商品目录响应异常，请重试");
      this.setState({ hgItems: hgPage.list, hgCursor, hgHistory, hgHistoryBase, hgNext: hgPage.hasMore ? hgPage.nextCursor : "" });
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgSeq === hgSeq) this.setState({ hgLoading: false });
    }
  };

  hgShowDetail = async (hgProductId) => {
    const hgSeq = ++this.hgSeq;
    this.setState({ hgLoading: true, hgError: "", hgDetail: null });
    try {
      const hgItem = await HGMallVM.detail(hgProductId);
      if (this.hgMounted && this.hgSeq === hgSeq) this.setState({ hgDetail: hgItem });
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgSeq === hgSeq) this.setState({ hgLoading: false });
    }
  };

  hgLoadMerchant = async (hgCursor = "") => {
    const hgSeq = ++this.hgMerchantSeq; // 本次本店商品游标请求身份，过期响应不得覆盖新页。
    try {
      const [hgMerchant, hgMine] = await Promise.all([HGMallVM.merchant(), HGMallVM.mine(hgCursor)]);
      if (this.hgMounted && this.state.hgView === "merchant" && hgSeq === this.hgMerchantSeq) this.setState({ hgMerchant, hgMine: hgMine.list, hgMerchantNext: hgMine.hasMore ? hgMine.nextCursor : "", hgError: "" });
    } catch (hgError) {
      if (this.hgMounted && this.state.hgView === "merchant" && hgSeq === this.hgMerchantSeq) this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  /** 只替换当前游标页，订单和收货地址不跨用户缓存；商家列表走独立的授权接口。 */
  hgLoadOrders = async (hgCursor = "", hgMerchant = false) => {
    const hgSeq = hgMerchant ? ++this.hgSellerSeq : ++this.hgOrdersSeq;
    try {
      const hgPage = hgMerchant ? await HGMallVM.merchantOrders(hgCursor) : await HGMallVM.orders(hgCursor);
      if (!this.hgMounted || this.state.hgView !== (hgMerchant ? "merchant" : "orders") || (hgMerchant ? this.hgSellerSeq : this.hgOrdersSeq) !== hgSeq) return;
      if (!Array.isArray(hgPage?.list) || typeof hgPage?.hasMore !== "boolean" || typeof hgPage?.nextCursor !== "string") throw new Error("商品订单响应异常");
      this.setState(hgMerchant
        ? { hgSellerOrders: hgPage.list, hgSellerCursor: hgCursor, hgSellerNext: hgPage.hasMore ? hgPage.nextCursor : "", hgError: "" }
        : { hgOrders: hgPage.list, hgOrdersCursor: hgCursor, hgOrdersNext: hgPage.hasMore ? hgPage.nextCursor : "", hgError: "" });
    } catch (hgError) {
      if (this.hgMounted && this.state.hgView === (hgMerchant ? "merchant" : "orders") && (hgMerchant ? this.hgSellerSeq : this.hgOrdersSeq) === hgSeq) this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  /** 审核入口由服务端 RBAC 读接口决定；403 只隐藏入口，不将任意登录者当管理员。 */
  hgLoadReviewAccess = async () => {
    try {
      await HGMallVM.pendingMerchants();
      if (this.hgMounted) this.setState({ hgCanReview: true });
    } catch {
      if (this.hgMounted) this.setState({ hgCanReview: false });
    }
  };

  hgLoadReview = async (hgMerchantCursor = "", hgProductCursor = "") => {
    const hgSeq = ++this.hgReviewSeq; // 同一审核视图可并发翻页，只提交最后一组游标结果。
    try {
      const [hgMerchants, hgProducts] = await Promise.all([
        HGMallVM.pendingMerchants(hgMerchantCursor), HGMallVM.pendingProducts(hgProductCursor),
      ]);
      if (this.hgMounted && this.state.hgView === "review" && hgSeq === this.hgReviewSeq) this.setState({
        hgPendingMerchants: hgMerchants.list, hgPendingProducts: hgProducts.list,
        hgReviewCursor: hgMerchantCursor, hgReviewNext: hgMerchants.hasMore ? hgMerchants.nextCursor : "",
        hgProductReviewCursor: hgProductCursor, hgProductReviewNext: hgProducts.hasMore ? hgProducts.nextCursor : "",
        hgError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.state.hgView === "review" && hgSeq === this.hgReviewSeq) this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  hgSelectView = (hgView) => {
    ++this.hgSeq;
    ++this.hgOrdersSeq;
    ++this.hgSellerSeq;
    ++this.hgMerchantSeq;
    ++this.hgReviewSeq;
    this.setState({ hgView, hgDetail: null, hgError: "", hgNotice: "" });
    if (hgView === "merchant") { this.hgLoadMerchant(); this.hgLoadOrders("", true); }
    if (hgView === "orders") this.hgLoadOrders();
    if (hgView === "review") this.hgLoadReview();
    if (hgView === "catalog") this.hgLoadCatalog(this.state.hgCategory, "", []);
  };

  /** 网络失败保留表单以便人工重试；同次点击不产生并发写请求。 */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await hgAction();
      if (this.hgMounted) this.setState({ hgNotice: hgSuccess });
      if (this.hgMounted && this.state.hgView === "merchant") { await this.hgLoadMerchant(); await this.hgLoadOrders("", true); }
      if (this.hgMounted && this.state.hgView === "orders") await this.hgLoadOrders();
      if (this.hgMounted && this.state.hgView === "review") await this.hgLoadReview();
    } catch (hgError) {
      if (this.hgMounted && this.state.hgView === "review" && hgError?.status === 409) {
        // 审核条件被其他操作改变时重新取当前页；服务器仍以条件更新防止重复审核。
        this.setState({ hgError: "审核状态已变化，正在刷新待审列表..." });
        await this.hgLoadReview(this.state.hgReviewCursor, this.state.hgProductReviewCursor);
      } else if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  hgPublish = (hgEvent) => {
    hgEvent.preventDefault();
    const hgDraft = this.state.hgDraft;
    const hgAmount = Number(hgDraft.amount);
    if (!Number.isSafeInteger(hgAmount) || hgAmount <= 0) {
      this.setState({ hgError: "请输入有效的正整数 M币价格" });
      return;
    }
    const hgStock = hgDraft.type === "MEMBERSHIP" ? 0 : Number(this.state.hgStock);
    if (hgDraft.type === "PHYSICAL_PRODUCT" && (!Number.isSafeInteger(hgStock) || hgStock < 1 || hgStock > 100000)) {
      this.setState({ hgError: "实物商品初始库存须为 1-100000 件" });
      return;
    }
    this.hgWrite(() => HGMallVM.publish({ ...hgDraft, amount: hgAmount, stock: hgStock }), "商品草稿已提交审核，通过后进入目录");
  };

  /** 购买响应未知时保持同一 requestId 重试；更改商品或收货信息则生成全新的键。 */
  hgBuy = async (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgWriteFlight) return;
    const { hgDetail, hgBuyForm } = this.state;
    const hgQuantity = Number(hgBuyForm.quantity);
    if (!hgDetail || hgDetail.type !== "PHYSICAL_PRODUCT" || !Number.isInteger(hgQuantity) || hgQuantity < 1 || hgQuantity > 10 || hgQuantity > hgDetail.available || hgDetail.amount * hgQuantity > 100000) {
      this.setState({ hgError: "库存不足或订单金额超过 100000 M币，请调整数量" });
      return;
    }
    const hgRequest = { productId: hgDetail.productId, quantity: hgQuantity, receiverName: hgBuyForm.receiverName.trim(),
      receiverPhone: hgBuyForm.receiverPhone.trim(), receiverAddress: hgBuyForm.receiverAddress.trim() }; // 仅用于本次签名请求，不持久化收件资料。
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgDigest = await hgPurchaseDigest(hgRequest);
      let hgPending = null;
      try { hgPending = JSON.parse(sessionStorage.getItem(hgPendingBuyKey)); } catch { /* 会话存储不可用时回退到当前实例。 */ }
      if (hgPending && hgPending.digest !== hgDigest) throw new Error("存在结果未知的购买请求，请先在商品订单中核对，再清除待确认请求");
      const hgRequestId = hgPending?.id || this.hgBuyRequestId || hgSecureRequestId();
      this.hgBuyRequestId = hgRequestId;
      try { sessionStorage.setItem(hgPendingBuyKey, JSON.stringify({ id: hgRequestId, digest: hgDigest })); } catch { /* 仅保留实例级重试键。 */ }
      this.setState({ hgPendingBuy: true });
      try {
        await HGMallVM.buy({ ...hgRequest, requestId: hgRequestId });
      } catch (hgError) {
        // 明确拒绝的 4xx 不会扣款；超时、5xx 与网络断开时绝不替换幂等键。
        if (hgError?.status >= 400 && hgError.status < 500 && hgError.status !== 429) {
          try { sessionStorage.removeItem(hgPendingBuyKey); } catch { /* 实例键仍可被复用。 */ }
          this.setState({ hgPendingBuy: false });
          this.hgBuyRequestId = "";
        }
        throw hgError;
      }
      try { sessionStorage.removeItem(hgPendingBuyKey); } catch { /* 下次页面加载时可查询订单确认。 */ }
      this.hgBuyRequestId = "";
      if (this.hgMounted) {
        this.props.hgOnBalanceChange?.();
        this.setState({ hgPendingBuy: false, hgNotice: "订单已支付 M币，请等待商家发货", hgView: "orders", hgDetail: null,
          hgBuyForm: { quantity: "1", receiverName: "", receiverPhone: "", receiverAddress: "" } }, () => this.hgLoadOrders());
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  hgRefund = (hgOrderId) => {
    if (!this.hgRefundRequestIds.has(hgOrderId)) {
      try { this.hgRefundRequestIds.set(hgOrderId, hgSecureRequestId()); }
      catch (hgError) { this.setState({ hgError: this.hgMessage(hgError) }); return; }
    }
    const hgRequestId = this.hgRefundRequestIds.get(hgOrderId);
    this.hgWrite(async () => {
      await HGMallVM.refund(hgOrderId, hgRequestId);
      this.hgRefundRequestIds.delete(hgOrderId);
      this.props.hgOnBalanceChange?.();
    }, "未发货订单已全额退还 M币并释放库存");
  };

  renderTabs() {
    return <nav className={styles.categoryNav} aria-label="商城功能">
      <button type="button" aria-pressed={this.state.hgView === "catalog"} onClick={() => this.hgSelectView("catalog")}>商品目录</button>
      <button type="button" aria-pressed={this.state.hgView === "merchant"} onClick={() => this.hgSelectView("merchant")}>商家入驻与发布</button>
      <button type="button" aria-pressed={this.state.hgView === "orders"} onClick={() => this.hgSelectView("orders")}>我的商品订单</button>
      {this.state.hgCanReview && <button type="button" aria-pressed={this.state.hgView === "review"} onClick={() => this.hgSelectView("review")}>商品与商家审核</button>}
    </nav>;
  }

  renderCatalog() {
    const { hgCategory, hgItems, hgDetail, hgLoading, hgCursor, hgNext, hgHistory, hgHistoryBase } = this.state;
    if (hgDetail) return <article className={styles.detail}>
      <button type="button" className={styles.secondary} onClick={() => this.setState({ hgDetail: null })}>← 返回商品目录</button>
      <div className={styles.detailGrid}><div className={styles.imagePlaceholder} aria-label="商品暂未上传图片">{hgCategories.find(([hgCode]) => hgCode === hgDetail.category)?.[1]}</div>
        <div><small>{hgDetail.shopName} · {hgDetail.category === "membership" ? "会员" : "实物商品"}</small><h2>{hgDetail.title}</h2>
          <strong className={styles.coinPrice}>{HGFormatCoin(hgDetail.amount)} M币</strong><p>{hgDetail.summary}</p><p>规格：{hgDetail.skuTitle}</p>
          {hgDetail.type === "PHYSICAL_PRODUCT" ? <><p>可售库存：{hgDetail.available} 件 · 单笔最高 100000 M币</p>
            <form className={styles.workspace} onSubmit={this.hgBuy}>
              <label>购买数量 <input required type="number" min="1" max="10" step="1" value={this.state.hgBuyForm.quantity} onChange={(hgEvent) => this.hgUpdateBuy("quantity", hgEvent.target.value)} /></label>
              <label>收件人 <input required maxLength={64} value={this.state.hgBuyForm.receiverName} onChange={(hgEvent) => this.hgUpdateBuy("receiverName", hgEvent.target.value)} /></label>
              <label>手机号 <input required inputMode="tel" maxLength={20} value={this.state.hgBuyForm.receiverPhone} onChange={(hgEvent) => this.hgUpdateBuy("receiverPhone", hgEvent.target.value)} /></label>
              <label>详细收货地址 <textarea required maxLength={512} value={this.state.hgBuyForm.receiverAddress} onChange={(hgEvent) => this.hgUpdateBuy("receiverAddress", hgEvent.target.value)} /></label>
          <p className={styles.notice}>商品标价含配送费；提交后立即扣除 M币并占用库存。未发货可全额退款，发货后尚未开放退货退款；运单由商家人工录入。</p>
              <button type="submit" disabled={this.state.hgBusy || hgDetail.available < 1 || hgDetail.amount > 100000}>确认购买并支付 M币</button>
            </form></> : <p className={styles.notice}>会员权益尚未接入，仅展示商品，暂不可购买。</p>}</div></div>
    </article>;
    return <>
      <div className={styles.categoryNav} role="group" aria-label="筛选商品类目">{hgCategories.map(([hgCode, hgLabel]) =>
        <button key={hgCode} type="button" aria-pressed={hgCategory === hgCode} onClick={() => this.hgLoadCatalog(hgCode, "", [])}>{hgLabel}</button>)}</div>
      {hgLoading && <p role="status">正在加载商品...</p>}
      {!hgLoading && !hgItems.length && <p>该类目暂无已审核商品。</p>}
      <div className={styles.productGrid}>{hgItems.map((hgItem) => <article key={hgItem.productId} className={styles.product}>
        <div className={styles.productImage}>{hgCategories.find(([hgCode]) => hgCode === hgItem.category)?.[1] || "商品"}</div>
        <div className={styles.productBody}><small>{hgItem.shopName}</small><h3>{hgItem.title}</h3><p>{hgItem.skuTitle}</p>
          <strong className={styles.coinPrice}>{HGFormatCoin(hgItem.amount)} M币</strong><small>{hgItem.type === "MEMBERSHIP" ? "会员仅展示" : `可售 ${hgItem.available} 件`}</small><button type="button" onClick={() => { this.hgBuyRequestId = ""; this.hgShowDetail(hgItem.productId); }}>查看详情</button></div>
      </article>)}</div>
      <div className={styles.pager}><button type="button" disabled={!hgHistory.length || hgLoading} onClick={() => this.hgLoadCatalog(hgCategory, hgHistory[hgHistory.length - 1], hgHistory.slice(0, -1), hgHistoryBase)}>上一页</button>
        <span>第 {hgHistoryBase + hgHistory.length + 1} 页{hgHistoryBase > 0 && " · 仅可返回最近 64 页"}</span><button type="button" disabled={!hgNext || hgLoading} onClick={() => {
          const hgPage = HGAdvanceMallPage(hgHistory, hgHistoryBase, hgCursor); // 目录翻页历史保持有界，不影响服务端游标。
          this.hgLoadCatalog(hgCategory, hgNext, hgPage.history, hgPage.base);
        }}>下一页</button></div>
    </>;
  }

  hgUpdateBuy = (hgKey, hgValue) => {
    this.hgBuyRequestId = "";
    this.setState((hgState) => ({ hgBuyForm: { ...hgState.hgBuyForm, [hgKey]: hgValue } }));
  };

  renderMerchant() {
    const { hgMerchant, hgMine, hgShopName, hgDraft, hgBusy, hgMerchantNext } = this.state;
    return <div className={styles.workspace}>
      <section><h2>商家入驻</h2><p>申请由管理员审核，通过后可发布单规格商品；商品再次审核通过才公开。</p>
        {hgMerchant ? <p>店铺：<strong>{hgMerchant.shopName}</strong> · {hgMerchant.status === 1 ? "审核通过" : hgMerchant.status === 2 ? "审核未通过，可重新提交" : "等待审核"}</p> : <p>尚未提交申请。</p>}
        {(!hgMerchant || hgMerchant.status === 2) && <form onSubmit={(hgEvent) => { hgEvent.preventDefault(); this.hgWrite(() => HGMallVM.apply(hgShopName.trim()), "申请已提交，请等待审核"); }}>
          <label>店铺名称 <input required maxLength={128} value={hgShopName} onChange={(hgEvent) => this.setState({ hgShopName: hgEvent.target.value })} /></label>
          <button type="submit" disabled={hgBusy}>提交入驻申请</button></form>}
      </section>
      {hgMerchant?.status === 1 && <section><h2>发布商品</h2><p>发布后等待审核；实物商品使用 M币购买并占用库存，由商家手工发货；会员仅展示，不发放权益。</p>
        <form className={styles.draftForm} onSubmit={this.hgPublish}>
          <label>类型 <select value={hgDraft.type} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, type: hgEvent.target.value, category: hgEvent.target.value === "MEMBERSHIP" ? "membership" : "digital" } })}>
            <option value="PHYSICAL_PRODUCT">实物商品</option><option value="MEMBERSHIP">会员卡</option></select></label>
          <label>类目 <select value={hgDraft.category} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, category: hgEvent.target.value } })}>
            {hgCategories.filter(([hgCode]) => hgCode && (hgDraft.type === "MEMBERSHIP" ? hgCode === "membership" : hgCode !== "membership")).map(([hgCode, hgLabel]) => <option key={hgCode} value={hgCode}>{hgLabel}</option>)}</select></label>
          <label>商品名称 <input required maxLength={128} value={hgDraft.title} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, title: hgEvent.target.value } })} /></label>
          <label>简介（纯文本） <textarea required maxLength={512} value={hgDraft.summary} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, summary: hgEvent.target.value } })} /></label>
          <label>规格 <input required maxLength={128} value={hgDraft.skuTitle} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, skuTitle: hgEvent.target.value } })} /></label>
          <label>价格（整数 M币；实物不超过100000） <input required type="number" min="1" max={hgDraft.type === "PHYSICAL_PRODUCT" ? "100000" : "9007199254740991"} step="1" value={hgDraft.amount} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, amount: hgEvent.target.value } })} /></label>
          {hgDraft.type === "PHYSICAL_PRODUCT" && <label>初始可售库存（件） <input required type="number" min="1" max="100000" step="1" value={this.state.hgStock} onChange={(hgEvent) => this.setState({ hgStock: hgEvent.target.value })} /></label>}
          <button type="submit" disabled={hgBusy}>提交商品审核</button>
        </form><h3>我的商品</h3>{hgMine.map((hgItem) => <p key={hgItem.productId}>{hgItem.title} · {HGFormatCoin(hgItem.amount)} M币 · {hgItem.status === 1 ? "已上架" : hgItem.status === 2 ? "未通过" : "待审核"}</p>)}
        <button type="button" disabled={!hgMerchantNext || hgBusy} onClick={() => this.hgLoadMerchant(hgMerchantNext)}>下一页商品</button></section>}
      {hgMerchant?.status === 1 && this.renderPhysicalOrders(true)}
    </div>;
  }

  /** 订单、收件信息和人工运单只来自服务端授权的本人/本店列表。 */
  renderPhysicalOrders(hgMerchant = false) {
    const hgItems = hgMerchant ? this.state.hgSellerOrders : this.state.hgOrders;
    const hgNext = hgMerchant ? this.state.hgSellerNext : this.state.hgOrdersNext;
    return <section className={styles.section} aria-label={hgMerchant ? "本店实物订单" : "我的实物订单"}>
      <h2>{hgMerchant ? "本店实物订单与发货" : "我的商品订单"}</h2>
      {!hgMerchant && this.state.hgPendingBuy && <p className={styles.notice}>有一笔购买结果尚未确认；请先核对订单记录。若未出现订单，可用原商品与相同收货信息重试。</p>}
      {!hgMerchant && this.state.hgPendingBuy && <button type="button" onClick={() => {
        try { sessionStorage.removeItem(hgPendingBuyKey); } catch { /* 会话存储不可用。 */ }
        this.hgBuyRequestId = "";
        this.setState({ hgPendingBuy: false });
      }}>我已核对订单，清除待确认请求</button>}
      {!hgItems.length && <p>当前页暂无订单。</p>}
      {hgItems.map((hgOrder) => <article className={styles.orderCard} key={hgOrder.orderId}>
        <h3>{hgOrder.title} · {hgOrder.quantity} 件 · {HGFormatCoin(hgOrder.amount)} M币</h3>
        <p>订单 {hgOrder.orderId} · {hgOrder.shippingStatus === 3 ? "未发货已退款" : hgOrder.shippingStatus === 2 ? "已确认收货并结算" : hgOrder.shippingStatus === 1 ? "已发货" : "已支付，待发货"}</p>
        <p>收件：{hgOrder.receiverName} · {hgOrder.receiverPhone} · {hgOrder.receiverAddress}</p>
        {hgOrder.shippingStatus >= 1 && hgOrder.shippingStatus <= 2 && <p>承运商：{hgOrder.carrier} · 运单号：{hgOrder.trackingNumber}（商家录入，非快递轨迹）</p>}
        {!hgMerchant && hgOrder.shippingStatus === 0 && <button type="button" disabled={this.state.hgBusy} onClick={() => this.hgRefund(hgOrder.orderId)}>未发货全额退款</button>}
        {!hgMerchant && hgOrder.shippingStatus === 1 && <button type="button" disabled={this.state.hgBusy} onClick={() => this.hgWrite(async () => {
          await HGMallVM.receive(hgOrder.orderId); this.props.hgOnBalanceChange?.();
        }, "已确认收货，商家 M币已结算")}>确认收货</button>}
        {hgMerchant && hgOrder.shippingStatus === 0 && <form className={styles.workspace} onSubmit={(hgEvent) => {
          hgEvent.preventDefault(); this.hgWrite(() => HGMallVM.ship(hgOrder.orderId, this.state.hgShipping.carrier.trim(), this.state.hgShipping.trackingNumber.trim()), "运单已登记，请等待买家确认收货");
        }}>
          <label>承运商 <input required maxLength={64} value={this.state.hgShipping.orderId === hgOrder.orderId ? this.state.hgShipping.carrier : ""} onChange={(hgEvent) => this.setState({ hgShipping: { orderId: hgOrder.orderId, carrier: hgEvent.target.value, trackingNumber: this.state.hgShipping.orderId === hgOrder.orderId ? this.state.hgShipping.trackingNumber : "" } })} /></label>
          <label>运单号 <input required maxLength={128} value={this.state.hgShipping.orderId === hgOrder.orderId ? this.state.hgShipping.trackingNumber : ""} onChange={(hgEvent) => this.setState({ hgShipping: { orderId: hgOrder.orderId, carrier: this.state.hgShipping.orderId === hgOrder.orderId ? this.state.hgShipping.carrier : "", trackingNumber: hgEvent.target.value } })} /></label>
          <button type="submit" disabled={this.state.hgBusy}>确认发货</button>
        </form>}
      </article>)}
      <div className={styles.pager}>
        <button type="button" disabled={!(hgMerchant ? this.state.hgSellerCursor : this.state.hgOrdersCursor) || this.state.hgBusy} onClick={() => this.hgLoadOrders("", hgMerchant)}>回到最新订单</button>
        <button type="button" disabled={!hgNext || this.state.hgBusy} onClick={() => this.hgLoadOrders(hgNext, hgMerchant)}>下一页订单</button>
      </div>
    </section>;
  }

  renderReview() {
    const { hgPendingMerchants, hgPendingProducts, hgReviewNext, hgProductReviewNext, hgBusy } = this.state;
    return <div className={styles.workspace}>
      <section><h2>待审核商家</h2><p>本人商家申请不可自审，需由其他具有审核权限的管理员处理。</p>{!hgPendingMerchants.length && <p>当前页无可审核申请。</p>}
        {hgPendingMerchants.map((hgItem) => <div className={styles.reviewRow} key={hgItem.merchantId}><span>{hgItem.shopName} · {hgItem.userId}</span>
          <button type="button" disabled={hgBusy} onClick={() => this.hgWrite(() => HGMallVM.reviewMerchant(hgItem.merchantId, true), "商家已通过审核")}>通过</button>
          <button type="button" disabled={hgBusy} onClick={() => this.hgWrite(() => HGMallVM.reviewMerchant(hgItem.merchantId, false), "商家申请已拒绝")}>拒绝</button></div>)}
        <button type="button" disabled={!hgReviewNext || hgBusy} onClick={() => this.hgLoadReview(hgReviewNext, this.state.hgProductReviewCursor)}>下一页商家</button></section>
      <section><h2>待审核商品</h2>{!hgPendingProducts.length && <p>当前页无待审商品。</p>}
        {hgPendingProducts.map((hgItem) => <div className={styles.reviewRow} key={hgItem.productId}><span>{hgItem.title} · {hgItem.shopName} · {hgItem.summary} · {HGFormatCoin(hgItem.amount)} M币</span>
          <button type="button" disabled={hgBusy} onClick={() => this.hgWrite(() => HGMallVM.reviewProduct(hgItem.productId, true), "商品已上架")}>通过</button>
          <button type="button" disabled={hgBusy} onClick={() => this.hgWrite(() => HGMallVM.reviewProduct(hgItem.productId, false), "商品已拒绝")}>拒绝</button></div>)}
        <button type="button" disabled={!hgProductReviewNext || hgBusy} onClick={() => this.hgLoadReview(this.state.hgReviewCursor, hgProductReviewNext)}>下一页商品</button></section>
    </div>;
  }

  render() {
    return <section className={styles.section} aria-label="商城商品与商家工作台">
      {this.renderTabs()}
      {this.state.hgError && <p role="alert" className={styles.error}>{this.state.hgError} <button type="button" onClick={() => this.hgSelectView(this.state.hgView)}>重试</button></p>}
      {this.state.hgNotice && <p role="status" className={styles.notice}>{this.state.hgNotice}</p>}
      {this.state.hgView === "catalog" ? this.renderCatalog() : this.state.hgView === "merchant" ? this.renderMerchant() : this.state.hgView === "orders" ? this.renderPhysicalOrders() : this.renderReview()}
    </section>;
  }
}

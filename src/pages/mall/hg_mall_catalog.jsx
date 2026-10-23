import React from "react";
import HGMallVM from "./hg_mall_vm.js";
import { HGFormatCoin } from "./hg_mall_amount.js";
import styles from "./hg_mall_page.module.css";

const hgCategories = [
  ["", "全部商品"], ["digital", "数码影音"], ["appliance", "家用电器"],
  ["clothing", "服饰"], ["beauty", "美妆个护"], ["membership", "会员"],
]; // 与 Go 服务端类目白名单对齐，不从原型构造商品记录。

/** 商城目录和商家工作台；全部商品、审核及发布结果来自服务端。 */
export default class HGMallCatalog extends React.Component {
  state = {
    hgView: "catalog", // catalog、merchant、review 三种视图，默认展示已审核目录。
    hgCategory: "", // 空字符串为全部类目，其他值必须来自服务端白名单。
    hgItems: [], // 当前目录页，初始为空，不缓存无限历史页面。
    hgCursor: "", // 当前请求游标；空字符串代表第一页。
    hgNext: "", // 下一页游标；空字符串意味着不能继续翻页。
    hgHistory: [], // 当前类目已访问的旧游标，仅保留本次会话的导航历史。
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
    hgLoading: false, // 目录或详情请求是否正在加载。
    hgBusy: false, // 审核/申请/发布写操作门闩，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 目录与详情读操作递增序号，忽略旧请求。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadCatalog("", "", []);
    this.hgLoadReviewAccess();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 仅加载单个有界游标页，切换类目/翻页时旧响应不可覆盖新结果。 */
  hgLoadCatalog = async (hgCategory, hgCursor, hgHistory) => {
    const hgSeq = ++this.hgSeq;
    this.setState({ hgLoading: true, hgError: "", hgDetail: null, hgCategory });
    try {
      const hgPage = await HGMallVM.products(hgCategory, hgCursor);
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (!Array.isArray(hgPage?.list) || typeof hgPage.hasMore !== "boolean" || typeof hgPage.nextCursor !== "string" || (hgPage.hasMore && (!hgPage.nextCursor || hgPage.nextCursor === hgCursor)))
        throw new Error("商品目录响应异常，请重试");
      this.setState({ hgItems: hgPage.list, hgCursor, hgHistory, hgNext: hgPage.hasMore ? hgPage.nextCursor : "" });
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
    try {
      const [hgMerchant, hgMine] = await Promise.all([HGMallVM.merchant(), HGMallVM.mine(hgCursor)]);
      if (this.hgMounted) this.setState({ hgMerchant, hgMine: hgMine.list, hgMerchantNext: hgMine.hasMore ? hgMine.nextCursor : "", hgError: "" });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
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
    try {
      const [hgMerchants, hgProducts] = await Promise.all([
        HGMallVM.pendingMerchants(hgMerchantCursor), HGMallVM.pendingProducts(hgProductCursor),
      ]);
      if (this.hgMounted) this.setState({
        hgPendingMerchants: hgMerchants.list, hgPendingProducts: hgProducts.list,
        hgReviewCursor: hgMerchantCursor, hgReviewNext: hgMerchants.hasMore ? hgMerchants.nextCursor : "",
        hgProductReviewCursor: hgProductCursor, hgProductReviewNext: hgProducts.hasMore ? hgProducts.nextCursor : "",
        hgError: "",
      });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  hgSelectView = (hgView) => {
    ++this.hgSeq;
    this.setState({ hgView, hgDetail: null, hgError: "", hgNotice: "" });
    if (hgView === "merchant") this.hgLoadMerchant();
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
      if (this.state.hgView === "merchant") await this.hgLoadMerchant();
      if (this.state.hgView === "review") await this.hgLoadReview();
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
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
    this.hgWrite(() => HGMallVM.publish({ ...hgDraft, amount: hgAmount }), "商品草稿已提交审核，通过后进入目录");
  };

  renderTabs() {
    return <nav className={styles.categoryNav} aria-label="商城功能">
      <button type="button" aria-pressed={this.state.hgView === "catalog"} onClick={() => this.hgSelectView("catalog")}>商品目录</button>
      <button type="button" aria-pressed={this.state.hgView === "merchant"} onClick={() => this.hgSelectView("merchant")}>商家入驻与发布</button>
      {this.state.hgCanReview && <button type="button" aria-pressed={this.state.hgView === "review"} onClick={() => this.hgSelectView("review")}>商品与商家审核</button>}
    </nav>;
  }

  renderCatalog() {
    const { hgCategory, hgItems, hgDetail, hgLoading, hgCursor, hgNext, hgHistory } = this.state;
    if (hgDetail) return <article className={styles.detail}>
      <button type="button" className={styles.secondary} onClick={() => this.setState({ hgDetail: null })}>← 返回商品目录</button>
      <div className={styles.detailGrid}><div className={styles.imagePlaceholder} aria-label="商品暂未上传图片">{hgCategories.find(([hgCode]) => hgCode === hgDetail.category)?.[1]}</div>
        <div><small>{hgDetail.shopName} · {hgDetail.category === "membership" ? "会员" : "实物商品"}</small><h2>{hgDetail.title}</h2>
          <strong className={styles.coinPrice}>{HGFormatCoin(hgDetail.amount)} M币</strong><p>{hgDetail.summary}</p><p>规格：{hgDetail.skuTitle}</p>
          <p className={styles.notice}>仅展示已审核的真实商品信息。库存、配送和会员权益尚未接入，目前不可下单。</p>
          <button type="button" disabled>暂不可购买</button></div></div>
    </article>;
    return <>
      <div className={styles.categoryNav} role="group" aria-label="筛选商品类目">{hgCategories.map(([hgCode, hgLabel]) =>
        <button key={hgCode} type="button" aria-pressed={hgCategory === hgCode} onClick={() => this.hgLoadCatalog(hgCode, "", [])}>{hgLabel}</button>)}</div>
      {hgLoading && <p role="status">正在加载商品...</p>}
      {!hgLoading && !hgItems.length && <p>该类目暂无已审核商品。</p>}
      <div className={styles.productGrid}>{hgItems.map((hgItem) => <article key={hgItem.productId} className={styles.product}>
        <div className={styles.productImage}>{hgCategories.find(([hgCode]) => hgCode === hgItem.category)?.[1] || "商品"}</div>
        <div className={styles.productBody}><small>{hgItem.shopName}</small><h3>{hgItem.title}</h3><p>{hgItem.skuTitle}</p>
          <strong className={styles.coinPrice}>{HGFormatCoin(hgItem.amount)} M币</strong><button type="button" onClick={() => this.hgShowDetail(hgItem.productId)}>查看详情</button></div>
      </article>)}</div>
      <div className={styles.pager}><button type="button" disabled={!hgHistory.length || hgLoading} onClick={() => this.hgLoadCatalog(hgCategory, hgHistory[hgHistory.length - 1], hgHistory.slice(0, -1))}>上一页</button>
        <span>第 {hgHistory.length + 1} 页</span><button type="button" disabled={!hgNext || hgLoading} onClick={() => this.hgLoadCatalog(hgCategory, hgNext, [...hgHistory, hgCursor])}>下一页</button></div>
    </>;
  }

  renderMerchant() {
    const { hgMerchant, hgMine, hgShopName, hgDraft, hgBusy, hgMerchantNext } = this.state;
    return <div className={styles.workspace}>
      <section><h2>商家入驻</h2><p>申请由管理员审核，通过后可发布单规格商品；商品再次审核通过才公开。</p>
        {hgMerchant ? <p>店铺：<strong>{hgMerchant.shopName}</strong> · {hgMerchant.status === 1 ? "审核通过" : hgMerchant.status === 2 ? "审核未通过，可重新提交" : "等待审核"}</p> : <p>尚未提交申请。</p>}
        {(!hgMerchant || hgMerchant.status === 2) && <form onSubmit={(hgEvent) => { hgEvent.preventDefault(); this.hgWrite(() => HGMallVM.apply(hgShopName.trim()), "申请已提交，请等待审核"); }}>
          <label>店铺名称 <input required maxLength={128} value={hgShopName} onChange={(hgEvent) => this.setState({ hgShopName: hgEvent.target.value })} /></label>
          <button type="submit" disabled={hgBusy}>提交入驻申请</button></form>}
      </section>
      {hgMerchant?.status === 1 && <section><h2>发布商品</h2><p>发布后等待审核。本期支持实物及会员目录，不支持付款、库存、自动发货或权益发放。</p>
        <form className={styles.draftForm} onSubmit={this.hgPublish}>
          <label>类型 <select value={hgDraft.type} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, type: hgEvent.target.value, category: hgEvent.target.value === "MEMBERSHIP" ? "membership" : "digital" } })}>
            <option value="PHYSICAL_PRODUCT">实物商品</option><option value="MEMBERSHIP">会员卡</option></select></label>
          <label>类目 <select value={hgDraft.category} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, category: hgEvent.target.value } })}>
            {hgCategories.filter(([hgCode]) => hgCode && (hgDraft.type === "MEMBERSHIP" ? hgCode === "membership" : hgCode !== "membership")).map(([hgCode, hgLabel]) => <option key={hgCode} value={hgCode}>{hgLabel}</option>)}</select></label>
          <label>商品名称 <input required maxLength={128} value={hgDraft.title} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, title: hgEvent.target.value } })} /></label>
          <label>简介（纯文本） <textarea required maxLength={512} value={hgDraft.summary} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, summary: hgEvent.target.value } })} /></label>
          <label>规格 <input required maxLength={128} value={hgDraft.skuTitle} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, skuTitle: hgEvent.target.value } })} /></label>
          <label>价格（整数 M币） <input required type="number" min="1" max="9007199254740991" step="1" value={hgDraft.amount} onChange={(hgEvent) => this.setState({ hgDraft: { ...hgDraft, amount: hgEvent.target.value } })} /></label>
          <button type="submit" disabled={hgBusy}>提交商品审核</button>
        </form><h3>我的商品</h3>{hgMine.map((hgItem) => <p key={hgItem.productId}>{hgItem.title} · {HGFormatCoin(hgItem.amount)} M币 · {hgItem.status === 1 ? "已上架" : hgItem.status === 2 ? "未通过" : "待审核"}</p>)}
        <button type="button" disabled={!hgMerchantNext || hgBusy} onClick={() => this.hgLoadMerchant(hgMerchantNext)}>加载更多</button></section>}
    </div>;
  }

  renderReview() {
    const { hgPendingMerchants, hgPendingProducts, hgReviewNext, hgProductReviewNext, hgBusy } = this.state;
    return <div className={styles.workspace}>
      <section><h2>待审核商家</h2>{!hgPendingMerchants.length && <p>当前页无待审申请。</p>}
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
      {this.state.hgView === "catalog" ? this.renderCatalog() : this.state.hgView === "merchant" ? this.renderMerchant() : this.renderReview()}
    </section>;
  }
}

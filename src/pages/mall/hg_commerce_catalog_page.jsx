import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path.jsx";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import HGCommerceVM from "./hg_commerce_vm.js";
import HGTabPlacement from "../../components/hg_tab_placement/hg_tab_placement.jsx";
import { hgCentToYuan } from "./hg_commerce_amount.js";
import styles from "./hg_merchant_center.module.css";
import hgFilters from "./hg_commerce_catalog_filters.module.css";

/** 生产 CNY 目录只显示经审批的线上商品快照，未接支付时禁止渲染购买按钮。 */
export default class HGCommerceCatalogPage extends React.Component {
  static defaultProps = {
    params: undefined, // 路由注入详情 productId；无默认值时展示目录，不发起详情请求。
    pageNavigator: undefined, // 路由注入返回导航；目录模式不使用，详情返回时由路由提供。
  };
  state = {
    hgItems: [], // 当前最多20件线上商品；空表示没有结果或尚未加载。
    hgNext: "", // 有界游标；空表示无后续页。
    hgDetail: null, // 指定商品的线上详情；null 表示目录或详情未获取。
    hgLoading: true, // 首次请求状态，避免误显示空态。
    hgError: "", // 最近失败提示；空表示无错误。
    hgRoots: [], // 已启用普通一级类目；空表示接口无数据或不可用，仍可浏览全部商品。
    hgChildren: [], // 当前一级类目的二级节点；空表示无二级或下钻失败。
    hgLeaves: [], // 当前二级类目的三级节点；空表示无三级或下钻失败。
    hgTopId: "", // 一级业务 ID；空表示浏览全部商品。
    hgSubId: "", // 二级业务 ID；空表示选中一级及其全部后代。
    hgLeafId: "", // 三级业务 ID；空表示选中二级及其全部后代。
    hgCategoryError: "", // 类目读取失败的提示；空表示正常，失败不影响商品目录。
  };
  hgMounted = false; // 卸载后丢弃旧网络响应。
  hgSeq = 0; // 路由变化及翻页时的请求代数。
  hgCategorySeq = 0; // 类目下钻请求代数，切换上级时丢弃旧子节点。

  componentDidMount() { this.hgMounted = true; this.hgLoad(); if (!this.props.params?.productId) this.hgLoadRoots(); }
  componentDidUpdate(hgPrevious) { if (hgPrevious.params?.productId !== this.props.params?.productId) this.hgLoad(); }
  componentWillUnmount() { this.hgMounted = false; this.hgSeq += 1; this.hgCategorySeq += 1; }

  /** 根目录请求失败保留「全部商品」筛选，不用 M币编码替代人民币类目。 */
  hgLoadRoots = async () => {
    const hgSeq = ++this.hgCategorySeq; // 只接受最新类目请求。
    try {
      const hgRoots = await HGCommerceVM.publicCategories();
      if (this.hgMounted && hgSeq === this.hgCategorySeq)
        this.setState({ hgRoots: Array.isArray(hgRoots) ? hgRoots.filter((hgItem) => hgItem.depth === 1) : [] });
    } catch {
      if (this.hgMounted && hgSeq === this.hgCategorySeq)
        this.setState({ hgCategoryError: "类目暂不可用，仍可浏览全部商品" });
    }
  };

  /** 切换一级类目：商品立即按该节点及其后代筛选，二级请求失败时保留一级。 */
  hgSelectTop = async (hgId) => {
    if (hgId === this.state.hgTopId) return;
    const hgSeq = ++this.hgCategorySeq;
    this.setState({ hgTopId: hgId, hgSubId: "", hgLeafId: "", hgChildren: [], hgLeaves: [], hgCategoryError: "" });
    this.hgLoad("", hgId);
    if (!hgId) return;
    try {
      const hgChildren = await HGCommerceVM.publicCategories(hgId);
      if (this.hgMounted && hgSeq === this.hgCategorySeq)
        this.setState({ hgChildren: Array.isArray(hgChildren) ? hgChildren.filter((hgItem) => hgItem.parentId === hgId && hgItem.depth === 2) : [] });
    } catch {
      if (this.hgMounted && hgSeq === this.hgCategorySeq)
        this.setState({ hgCategoryError: "细分类目暂不可用，仍显示当前层级" });
    }
  };

  /** 二级标签「全部」回到一级范围；选中节点后仅请求三级直属子类目。 */
  hgSelectSub = async (hgId) => {
    if (hgId === this.state.hgSubId) return;
    const hgSeq = ++this.hgCategorySeq;
    this.setState({ hgSubId: hgId, hgLeafId: "", hgLeaves: [], hgCategoryError: "" });
    this.hgLoad("", hgId || this.state.hgTopId);
    if (!hgId) return;
    try {
      const hgLeaves = await HGCommerceVM.publicCategories(hgId);
      if (this.hgMounted && hgSeq === this.hgCategorySeq)
        this.setState({ hgLeaves: Array.isArray(hgLeaves) ? hgLeaves.filter((hgItem) => hgItem.parentId === hgId && hgItem.depth === 3) : [] });
    } catch {
      if (this.hgMounted && hgSeq === this.hgCategorySeq)
        this.setState({ hgCategoryError: "细分类目暂不可用，仍显示当前层级" });
    }
  };

  /** 三级筛选只影响当前 CNY 商品页，翻页和重试沿用同一个 categoryId。 */
  hgSelectLeaf = (hgId) => {
    if (hgId === this.state.hgLeafId) return;
    this.setState({ hgLeafId: hgId });
    this.hgLoad("", hgId || this.state.hgSubId);
  };

  hgActiveCategory = () => this.state.hgLeafId || this.state.hgSubId || this.state.hgTopId;

  hgLoad = async (hgCursor = "", hgCategoryId = this.hgActiveCategory()) => {
    const hgSeq = ++this.hgSeq; // 只接受最后一次请求结果。
    this.setState({ hgLoading: true, hgError: "", hgDetail: null, hgItems: [], hgNext: "" });
    try {
      const hgID = this.props.params?.productId; // 路由注入的 CNY 商品业务 ID；无默认值。
      if (hgID) {
        const hgDetail = await HGCommerceVM.detail(hgID);
        if (this.hgMounted && hgSeq === this.hgSeq) this.setState({ hgDetail });
      } else {
        const hgPage = await HGCommerceVM.products(hgCursor, hgCategoryId);
        if (this.hgMounted && hgSeq === this.hgSeq) this.setState({ hgItems: hgPage.list || [], hgNext: hgPage.hasMore ? hgPage.nextCursor : "" });
      }
    } catch (hgError) { if (this.hgMounted && hgSeq === this.hgSeq) this.setState({ hgError: hgError?.message || "商品目录暂不可用" }); }
    finally { if (this.hgMounted && hgSeq === this.hgSeq) this.setState({ hgLoading: false }); }
  };

  renderCard(hgItem) {
    return <Link key={hgItem.productId} className={styles.card} to={ROUTE_PATH.COMMERCE_DETAIL.replace(":productId", encodeURIComponent(hgItem.productId))}>
      {hgItem.imageURLs?.length ? <img className={styles.cover} src={normalizeVideoCoverUrl(hgItem.imageURLs[0])} loading="lazy" alt={`${hgItem.title} 主图`} /> : <div className={styles.coverEmpty}>暂无图片</div>}
      <div className={styles.body}><h3>{hgItem.title}</h3><span className={styles.productNo}>{hgItem.productId}</span><div className={styles.metaRow}><span className={`${styles.badge} ${styles.badgeOn}`}>已上架</span><span className={styles.price}>{hgCentToYuan(hgItem.minPriceCent)}</span></div></div>
    </Link>;
  }

  /** 三级类目最多展示到 depth=3；各级的「全部」表示当前父节点及所有后代。 */
  renderFilters() {
    const { hgRoots, hgChildren, hgLeaves, hgTopId, hgSubId, hgLeafId, hgCategoryError } = this.state;
    return <div className={hgFilters.filters}>
      <nav className={hgFilters.top} aria-label="商品类目">
        {[{ categoryId: "", name: "全部商品" }, ...hgRoots].map((hgItem) =>
          <button key={hgItem.categoryId || "all"} type="button" aria-pressed={hgItem.categoryId === hgTopId} onClick={() => this.hgSelectTop(hgItem.categoryId)}>{hgItem.name}</button>
        )}
      </nav>
      {hgChildren.length > 0 && <HGTabPlacement ariaLabel="二级类目" hgVariant="pill" activeKey={hgSubId} onChange={this.hgSelectSub} tabs={[{ key: "", label: "全部" }, ...hgChildren.map((hgItem) => ({ key: hgItem.categoryId, label: hgItem.name }))]} />}
      {hgSubId && hgLeaves.length > 0 && <HGTabPlacement ariaLabel="三级类目" hgVariant="pill" activeKey={hgLeafId} onChange={this.hgSelectLeaf} tabs={[{ key: "", label: "全部" }, ...hgLeaves.map((hgItem) => ({ key: hgItem.categoryId, label: hgItem.name }))]} />}
      {hgCategoryError && <p role="status" className={styles.desc}>{hgCategoryError}</p>}
    </div>;
  }

  render() {
    const { hgItems, hgNext, hgDetail, hgLoading, hgError } = this.state;
    return <main className={styles.page} aria-label="生产人民币商品目录"><section className={styles.panel}>
      <div className={styles.head}><h2>人民币商品 · 精选展示</h2></div>
      <p className={styles.desc}>商品已通过审核，但人民币库存订单和支付宝/微信支付尚未开放。本页没有购买入口，请勿向商家付款。</p>
      {!this.props.params?.productId && this.renderFilters()}
      {hgError && <p role="alert" className={styles.errorBar}>{hgError}</p>}
      {hgLoading ? <p role="status" className={styles.loading}>正在读取线上商品...</p> : hgDetail ? <>
        <Link to={ROUTE_PATH.COMMERCE_PRODUCTS} onClick={(event) => this.props.pageNavigator.backFromLink(event, ROUTE_PATH.COMMERCE_PRODUCTS)}>返回人民币商品列表</Link>
        {hgDetail.imageURLs?.length && <div className={styles.imgGrid}>{hgDetail.imageURLs.map((hgURL, hgIndex) => <img key={hgURL} src={normalizeVideoCoverUrl(hgURL)} alt={`商品展示图 ${hgIndex + 1}`} loading="lazy" />)}</div>}
        <h1>{hgDetail.title}</h1><p>{hgDetail.subtitle}</p><p>{hgDetail.description}</p>
        <div className={styles.commerceSku}>{hgDetail.skus?.map((hgSKU) => <div key={hgSKU.skuId}><strong>{hgSKU.skuCode}</strong><p>{Object.entries(hgSKU.specs || {}).map(([hgKey, hgValue]) => `${hgKey}：${hgValue}`).join(" · ") || "默认规格"}</p><span className={styles.price}>{hgCentToYuan(hgSKU.priceCent)}</span></div>)}</div>
        <p className={styles.formHint}>公开价格不代表已锁库存或已完成付款；正式支付宝/微信支付尚未开放。</p>
        {import.meta.env.MODE === "debug" && <Link to={`${ROUTE_PATH.COMMERCE_DEBUG_TRADE}?productId=${encodeURIComponent(hgDetail.productId)}`}>前往隔离模拟下单与支付测试（不是真实付款）</Link>}
      </> : this.props.params?.productId ? <div className={styles.empty}>找不到这件已上架的商品</div> : <>
        <div className={styles.grid}>{hgItems.map((hgItem) => this.renderCard(hgItem))}</div>
        {!hgItems.length && <div className={styles.empty}><strong>暂无已上架商品</strong><span>商家完成审核并确认上架后即可在此展示。</span></div>}
        {hgNext && <button type="button" className={styles.btnGhost} onClick={() => this.hgLoad(hgNext)}>下一页</button>}
      </>}
    </section></main>;
  }
}

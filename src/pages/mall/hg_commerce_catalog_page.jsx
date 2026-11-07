import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path.jsx";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import HGCommerceVM from "./hg_commerce_vm.js";
import { hgCentToYuan } from "./hg_commerce_amount.js";
import styles from "./hg_merchant_center.module.css";

/** 生产 CNY 目录只显示经审批的线上商品快照，未接支付时禁止渲染购买按钮。 */
export default class HGCommerceCatalogPage extends React.Component {
  state = {
    hgItems: [], // 当前最多20件线上商品；空表示没有结果或尚未加载。
    hgNext: "", // 有界游标；空表示无后续页。
    hgDetail: null, // 指定商品的线上详情；null 表示目录或详情未获取。
    hgLoading: true, // 首次请求状态，避免误显示空态。
    hgError: "", // 最近失败提示；空表示无错误。
  };
  hgMounted = false; // 卸载后丢弃旧网络响应。
  hgSeq = 0; // 路由变化及翻页时的请求代数。

  componentDidMount() { this.hgMounted = true; this.hgLoad(); }
  componentDidUpdate(hgPrevious) { if (hgPrevious.params?.productId !== this.props.params?.productId) this.hgLoad(); }
  componentWillUnmount() { this.hgMounted = false;this.hgSeq += 1; }

  hgLoad = async (hgCursor = "") => {
    const hgSeq = ++this.hgSeq; // 只接受最后一次请求结果。
    this.setState({ hgLoading: true, hgError: "", hgDetail: null });
    try {
      const hgID = this.props.params?.productId; // 路由注入的 CNY 商品业务 ID；无默认值。
      if (hgID) {
        const hgDetail = await HGCommerceVM.detail(hgID);
        if (this.hgMounted && hgSeq === this.hgSeq) this.setState({ hgDetail });
      } else {
        const hgPage = await HGCommerceVM.products(hgCursor);
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

  render() {
    const { hgItems, hgNext, hgDetail, hgLoading, hgError } = this.state;
    return <main className={styles.page} aria-label="生产人民币商品目录"><section className={styles.panel}>
      <div className={styles.head}><h2>人民币商品 · 精选展示</h2></div>
      <p className={styles.desc}>商品已通过审核，但人民币库存订单和支付宝/微信支付尚未开放。本页没有购买入口，请勿向商家付款。</p>
      {hgError && <p role="alert" className={styles.errorBar}>{hgError}</p>}
      {hgLoading ? <p role="status" className={styles.loading}>正在读取线上商品...</p> : hgDetail ? <>
        <Link to={ROUTE_PATH.COMMERCE_PRODUCTS}>返回人民币商品列表</Link>
        {hgDetail.imageURLs?.length && <div className={styles.imgGrid}>{hgDetail.imageURLs.map((hgURL, hgIndex) => <img key={hgURL} src={normalizeVideoCoverUrl(hgURL)} alt={`商品展示图 ${hgIndex + 1}`} loading="lazy" />)}</div>}
        <h1>{hgDetail.title}</h1><p>{hgDetail.subtitle}</p><p>{hgDetail.description}</p>
        <div className={styles.commerceSku}>{hgDetail.skus?.map((hgSKU) => <div key={hgSKU.skuId}><strong>{hgSKU.skuCode}</strong><p>{Object.entries(hgSKU.specs || {}).map(([hgKey, hgValue]) => `${hgKey}：${hgValue}`).join(" · ") || "默认规格"}</p><span className={styles.price}>{hgCentToYuan(hgSKU.priceCent)}</span></div>)}</div>
        <p className={styles.formHint}>当前仅展示审核价格与规格，库存数字不是可购买保证。</p>
      </> : this.props.params?.productId ? <div className={styles.empty}>找不到这件已上架的商品</div> : <>
        <div className={styles.grid}>{hgItems.map((hgItem) => this.renderCard(hgItem))}</div>
        {!hgItems.length && <div className={styles.empty}><strong>暂无已上架商品</strong><span>商家完成审核并确认上架后即可在此展示。</span></div>}
        {hgNext && <button type="button" className={styles.btnGhost} onClick={() => this.hgLoad(hgNext)}>下一页</button>}
      </>}
    </section></main>;
  }
}

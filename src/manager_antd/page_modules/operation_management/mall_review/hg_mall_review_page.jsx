import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGCollectionView from "../../../../components/hg_collection_view/hg_collection_view";
import { normalizeVideoCoverUrl } from "../../../../pages/bilibili/hg_bili_media_url.js";
import { HGFormatCoin } from "../../../../pages/mall/hg_mall_amount.js";
import HGMallVM from "../../../../pages/mall/hg_mall_vm.js";
import styles from "./hg_mall_review.module.css";

const HG_REVIEW_CONFIG = {
  merchant: {
    title: "待审核商家",
    description: "审核商家入驻申请；申请人不能审核自己的商家申请。",
    ariaLabel: "待审核商家列表",
    load: (cursor) => HGMallVM.pendingMerchants(cursor),
    review: (item, approve) => HGMallVM.reviewMerchant(item.merchantId, approve),
    getKey: (item) => item.merchantId,
    success: (approve) => (approve ? "商家已通过审核" : "商家申请已拒绝"),
  },
  product: {
    title: "待审核商品",
    description: "审核新发布商品；审核通过后商品才会进入公开商城目录。",
    ariaLabel: "待审核商品列表",
    load: (cursor) => HGMallVM.pendingProducts(cursor),
    review: (item, approve) => HGMallVM.reviewProduct(item.productId, approve),
    getKey: (item) => item.productId,
    success: (approve) => (approve ? "商品已上架" : "商品已拒绝"),
  },
  media: {
    title: "已上架商品补图审核",
    description: "每张图片独立审核；通过后加入公开商品图片，不改变商品上架与订单状态。",
    ariaLabel: "已上架商品补图审核列表",
    load: (cursor) => HGMallVM.pendingMedia(cursor),
    review: (item, approve) => HGMallVM.reviewMedia(item.imageURL, approve),
    getKey: (item) => item.imageURL,
    success: (approve) => (approve ? "商品补图已公开" : "商品补图已拒绝"),
  },
  edit: {
    title: "已上架商品资料修改审核",
    description: "审核通过后更新公开资料；拒绝不会修改原商品或历史订单。",
    ariaLabel: "已上架商品资料修改审核列表",
    load: (cursor) => HGMallVM.pendingEdits(cursor),
    review: (item, approve) => HGMallVM.reviewEdit(item.productId, approve),
    getKey: (item) => item.productId,
    success: (approve) => (approve ? "商品资料修改已公开" : "商品资料修改已拒绝"),
  },
};

/**
 * 商城审核通用列表。
 * 职责：管理单一审核类型的游标列表、刷新和审核写操作；后端仍执行最终权限与状态校验。
 */
class HGMallReviewListPage extends Component {
  state = {
    items: [],
    nextCursor: "",
    loading: false,
    reviewingKey: "",
    error: "",
    notice: "",
    resetKey: 0,
  };

  mounted = false;
  requestSequence = 0;
  writeFlight = false;
  retryRequest = null;

  componentDidMount() {
    this.mounted = true;
    this.loadPage("", false);
  }

  componentWillUnmount() {
    this.mounted = false;
    this.requestSequence += 1;
  }

  /** 当前页面配置只允许来自固定映射，不能把接口名或审核动作交给 URL 参数控制。 */
  getConfig = () => HG_REVIEW_CONFIG[this.props.reviewType];

  /** 校验游标页基本契约，防止异常 nextCursor 导致列表自动请求死循环。 */
  normalizePage = (page, cursor) => {
    if (
      !Array.isArray(page?.list) ||
      typeof page.hasMore !== "boolean" ||
      typeof page.nextCursor !== "string" ||
      (page.hasMore && (!page.nextCursor || page.nextCursor === cursor))
    ) {
      throw new Error("商城审核列表响应异常，请重试");
    }
    return page;
  };

  /** 首次加载/刷新替换列表，触底加载则追加下一游标页。 */
  loadPage = async (cursor = "", append = false) => {
    if (this.state.loading) return;
    const config = this.getConfig();
    const sequence = ++this.requestSequence;
    this.retryRequest = { cursor, append };
    this.setState({ loading: true, error: "", notice: append ? this.state.notice : "" });
    try {
      const page = this.normalizePage(await config.load(cursor), cursor);
      if (!this.mounted || sequence !== this.requestSequence) return;
      this.retryRequest = null;
      this.setState((state) => ({
        items: append ? [...state.items, ...page.list] : page.list,
        nextCursor: page.hasMore ? page.nextCursor : "",
        resetKey: append ? state.resetKey : state.resetKey + 1,
      }));
    } catch (error) {
      if (this.mounted && sequence === this.requestSequence) {
        this.setState({ error: error?.message || "商城审核列表加载失败，请重试" });
      }
    } finally {
      if (this.mounted && sequence === this.requestSequence) this.setState({ loading: false });
    }
  };

  /** 审核写操作串行执行；完成或遇到状态冲突后回到第一页取得服务端最新状态。 */
  reviewItem = async (item, approve) => {
    if (this.writeFlight) return;
    const config = this.getConfig();
    const itemKey = String(config.getKey(item));
    this.writeFlight = true;
    this.setState({ reviewingKey: itemKey, error: "", notice: "" });
    try {
      await config.review(item, approve);
      if (!this.mounted) return;
      this.setState({ notice: config.success(approve) });
      await this.loadPage("", false);
    } catch (error) {
      if (!this.mounted) return;
      if (error?.status === 409) {
        this.setState({ error: "审核状态已变化，列表已刷新。" });
        await this.loadPage("", false);
      } else {
        this.setState({ error: error?.message || "商城审核操作失败，请重试" });
      }
    } finally {
      this.writeFlight = false;
      if (this.mounted) this.setState({ reviewingKey: "" });
    }
  };

  /** 加载失败时重试原游标，审核失败时保留当前记录供用户重新操作。 */
  retryLoad = () => {
    const request = this.retryRequest || { cursor: "", append: false };
    this.loadPage(request.cursor, request.append);
  };

  renderImages = (imageURLs, alt) => {
    if (!Array.isArray(imageURLs) || imageURLs.length === 0) return null;
    return (
      <div className={styles.imageGrid}>
        {imageURLs.map((imageURL) => (
          <img key={imageURL} src={normalizeVideoCoverUrl(imageURL)} alt={alt} loading="lazy" />
        ))}
      </div>
    );
  };

  renderMerchantDetails = (item) => (
    <div className={styles.details}>
      <h3>{item.shopName || "未命名店铺"}</h3>
      <p>商家 ID：{item.merchantId || "—"}</p>
      <p>申请用户：{item.userId || "—"}</p>
    </div>
  );

  renderProductDetails = (item) => (
    <div className={styles.details}>
      <h3>{item.title || "未命名商品"}</h3>
      <p>店铺：{item.shopName || "—"} · 商品 ID：{item.productId || "—"}</p>
      <p>价格：{HGFormatCoin(item.amount)} M币</p>
      <p>简介：{item.summary || "—"}</p>
      <p className={styles.multiline}>介绍：{item.description || "—"}</p>
      {this.renderImages(item.imageURLs, `${item.title || "商品"} 待审图`)}
    </div>
  );

  renderMediaDetails = (item) => (
    <div className={styles.details}>
      <h3>{item.title || "未命名商品"}</h3>
      <p>店铺：{item.shopName || "—"} · 商品 ID：{item.productId || "—"}</p>
      {this.renderImages(item.imageURL ? [item.imageURL] : [], `${item.title || "商品"} 待审补图`)}
    </div>
  );

  renderEditDetails = (item) => (
    <div className={styles.details}>
      <h3>{item.title || "未命名商品"}</h3>
      <p>店铺：{item.shopName || "—"} · 商品 ID：{item.productId || "—"}</p>
      <p>新简介：{item.summary || "—"}</p>
      <p className={styles.multiline}>新介绍：{item.description || "—"}</p>
    </div>
  );

  /** 按审核类型选择字段展示，审核按钮契约保持一致。 */
  renderCell = (item) => {
    const config = this.getConfig();
    const key = String(config.getKey(item));
    const detailRenderers = {
      merchant: this.renderMerchantDetails,
      product: this.renderProductDetails,
      media: this.renderMediaDetails,
      edit: this.renderEditDetails,
    };
    const reviewing = this.state.reviewingKey === key;
    return (
      <article className={styles.reviewCard}>
        {detailRenderers[this.props.reviewType](item)}
        <div className={styles.actions}>
          <HGButtonPage type="primary" loading={reviewing} disabled={!!this.state.reviewingKey}
            onClick={() => this.reviewItem(item, true)}>通过</HGButtonPage>
          <HGButtonPage danger loading={reviewing} disabled={!!this.state.reviewingKey}
            onClick={() => this.reviewItem(item, false)}>拒绝</HGButtonPage>
        </div>
      </article>
    );
  };

  renderFeedback = () => (
    <>
      {this.state.error && (
        <p className={styles.error} role="alert">
          {this.state.error}
          {this.retryRequest && <button type="button" onClick={this.retryLoad}>重试加载</button>}
        </p>
      )}
      {this.state.notice && <p className={styles.notice} role="status">{this.state.notice}</p>}
    </>
  );

  render() {
    const config = this.getConfig();
    const busy = this.state.loading || !!this.state.reviewingKey;
    return (
      <section className={styles.container} aria-labelledby={`hg-${this.props.reviewType}-review-title`}>
        <header className={styles.header}>
          <div>
            <span>MLC MALL REVIEW</span>
            <h2 id={`hg-${this.props.reviewType}-review-title`}>{config.title}</h2>
            <p>{config.description}</p>
          </div>
          <HGButtonPage disabled={busy} onClick={() => this.loadPage("", false)}>刷新</HGButtonPage>
        </header>
        {this.renderFeedback()}
        <HGCollectionView
          items={this.state.items}
          getKey={config.getKey}
          renderCell={this.renderCell}
          loading={busy}
          hasMore={!!this.state.nextCursor}
          resetKey={this.state.resetKey}
          onLoadMore={() => this.loadPage(this.state.nextCursor, true)}
          onRefresh={() => this.loadPage("", false)}
          ariaLabel={config.ariaLabel}
          height={560}
        />
      </section>
    );
  }
}

/** 四个菜单分别挂载独立类组件，使菜单切换时列表状态和请求生命周期互不干扰。 */
export class HGPendingMerchantReviewPage extends Component {
  render() { return <HGMallReviewListPage reviewType="merchant" />; }
}

export class HGPendingProductReviewPage extends Component {
  render() { return <HGMallReviewListPage reviewType="product" />; }
}

export class HGPendingMediaReviewPage extends Component {
  render() { return <HGMallReviewListPage reviewType="media" />; }
}

export class HGPendingEditReviewPage extends Component {
  render() { return <HGMallReviewListPage reviewType="edit" />; }
}


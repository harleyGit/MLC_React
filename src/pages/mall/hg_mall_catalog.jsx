import React from "react";
import { Link } from "react-router-dom";
import { hgPageNavigator } from "../../components/hg_navigation/hg_page_navigator";
import { PAGE } from "../../components/hg_navigation/hg_page_registry";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import { HGFormatCoin } from "./hg_mall_amount.js";
import { HGAdvanceMallPage } from "./hg_mall_cursor.js";
import styles from "./hg_mall_page.module.css";
import { hgSecureRequestId } from "./hg_mall_security.js";
import HGMallVM from "./hg_mall_vm.js";
import { HG_MALL_CATEGORIES as hgCategories } from "./hg_mall_categories.js";
import HGMerchantProductsPage from "./hg_merchant_products_page";
import HGMerchantPublishPage from "./hg_merchant_publish_page";
import HGMerchantOrdersPage from "./hg_merchant_orders_page";

const hgPendingBuyKey = "mlc.mall.pending-buy"; // 仅在会话内保存幂等键和请求摘要，不落盘收件隐私明文。

/** 摘要绑定同一次购买的商品、数量及地址；失败后的未知结果只能使用原幂等键重试。 */
async function hgPurchaseDigest(hgRequest) {
  const { default: hgNet } = await import("../../api/HttpManagerV1.js");
  return hgNet.sha256Hex(JSON.stringify(hgRequest)); // 复用局域网 HTTP 环境的 SHA-256 降级实现。
}

/** 商城目录和商家工作台；全部商品、审核及发布结果来自服务端。 */
export default class HGMallCatalog extends React.Component {
  state = {
    hgView: ["catalog", "merchant"].includes(this.props.hgInitialView)
      ? this.props.hgInitialView
      : "merchant", // 商品页默认目录；商城默认商家工作台。买家商品订单已迁入用户中心。
    hgCategory: "", // 空字符串为全部类目，其他值必须来自服务端白名单。
    hgItems: [], // 当前目录页，初始为空，不缓存无限历史页面。
    hgCursor: "", // 当前请求游标；空字符串代表第一页。
    hgNext: "", // 下一页游标；空字符串意味着不能继续翻页。
    hgHistory: [], // 当前类目最近最多 64 页的旧游标，限制亿级目录下前端内存使用。
    hgHistoryBase: 0, // 被丢弃的更早返回游标数量；换类目时归零，仍可准确显示当前页码。
    hgDetail: null, // 正在查看的商品详情；null 为目录视图。
    hgMerchant: null, // 本人商家申请；null 代表尚未申请或尚未加载。
    hgMerchantLoading: false, // 商家申请读取中；尚未获取时不显示空态。
    hgPendingMerchants: [], // 审核员当前页商家申请，未授权时为空。
    hgPendingProducts: [], // 审核员当前页商品，未授权时为空。
    hgPendingMedia: [], // 审核员当前页待审补图，按图片独立审核。
    hgPendingEdits: [], // 审核员当前页已上架商品文字编辑申请。
    hgReviewCursor: "", // 待审商家当前页游标。
    hgReviewNext: "", // 待审商家下一页游标。
    hgProductReviewCursor: "", // 待审商品当前页游标。
    hgProductReviewNext: "", // 待审商品下一页游标。
    hgMediaReviewCursor: "", // 待审补图当前页游标；空为第一页。
    hgMediaReviewNext: "", // 待审补图下一页游标；空表示结束。
    hgEditReviewCursor: "", // 文字编辑审核当前页游标；空为第一页。
    hgEditReviewNext: "", // 文字编辑审核下一页游标；空表示结束。
    hgShopName: "", // 用户输入的店铺名；提交前无默认值。
    hgBuyForm: {
      quantity: "1",
      receiverName: "",
      receiverPhone: "",
      receiverAddress: "",
    }, // 当前商品一次性收货快照；不可当作地址簿复用。
    hgLoading: false, // 目录或详情请求是否正在加载。
    hgBusy: false, // 审核/申请/发布写操作门闩，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
    hgPendingBuy: false, // 本会话有结果未知的购买请求时为 true；须核对订单或重试原请求。
    hgMainImage: 0, // 详情页当前主图索引，展示图切换后归零，越界时回退到首图。
    hgDetailTab: "detail", // 详情页下半区当前标签：detail 为商品介绍，spec 为规格参数。
    hgDetailId: "", // 正在打开详情的商品 ID；加载期间用于显示骨架屏，避免闪烁回目录。
    hgCreatedOrderId: "", // 本次成功创建的订单 ID；空字符串表示尚无可跳转的订单。
    hgBrokenImages: [], // 当前目录页或商品详情中加载失败的图片 URL；切换商品或翻页时清空。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgSeq = 0; // 目录与详情读操作递增序号，忽略旧请求。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。
  hgBuyRequestId = ""; // 当前一次购买尝试的幂等键；失败后保持，修改请求内容时作废。
  hgMerchantSeq = 0; // 商家申请读取序号；过期响应不覆盖新结果。
  hgReviewSeq = 0; // 审核双列表请求序号；不同游标响应不可相互覆盖。
  hgLastProductId = ""; // 最近加载的商品 ID；重试同一详情时保留收货信息以复用原请求。

  componentDidMount() {
    this.hgMounted = true;
    try {
      this.setState({
        hgPendingBuy: !!sessionStorage.getItem(hgPendingBuyKey),
      });
    } catch {
      /* 禁用存储时仍保留当前组件内的幂等键。 */
    }
    // 路由详情模式（商品详情独立页）：只加载当前商品，不请求目录列表。
    if (this.hgIsRouteDetail()) {
      this.hgShowDetail(this.props.hgProductId);
      return;
    }
    if (this.state.hgView === "merchant") {
      this.hgLoadMerchant();
    } else this.hgLoadCatalog("", "", []);
  }

  /** 同一路由复用组件实例：路由参数变化时必须重载详情，不能沿用旧商品。 */
  componentDidUpdate(hgPrevProps) {
    const hgNextProductId = this.props.hgProductId;
    if (hgNextProductId && hgPrevProps.hgProductId !== hgNextProductId)
      this.hgShowDetail(hgNextProductId);
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
    this.hgMerchantSeq += 1;
    this.hgReviewSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

  /** 路由详情模式：由商品详情独立页注入 hgProductId，返回列表与关闭详情均走路由导航。 */
  hgIsRouteDetail = () => Boolean(this.props.hgProductId);

  /** 仅加载单个有界游标页，切换类目/翻页时旧响应不可覆盖新结果。 */
  hgLoadCatalog = async (
    hgCategory,
    hgCursor,
    hgHistory,
    hgHistoryBase = 0
  ) => {
    const hgSeq = ++this.hgSeq;
    this.setState({
      hgLoading: true,
      hgError: "",
      hgDetail: null,
      hgDetailId: "",
      hgCategory,
      hgItems: [],
      hgNext: "",
      hgCursor,
      hgHistory,
      hgHistoryBase,
      hgBrokenImages: [],
    });
    try {
      const hgPage = await HGMallVM.products(hgCategory, hgCursor);
      if (!this.hgMounted || this.hgSeq !== hgSeq) return;
      if (
        !Array.isArray(hgPage?.list) ||
        typeof hgPage.hasMore !== "boolean" ||
        typeof hgPage.nextCursor !== "string" ||
        (hgPage.hasMore &&
          (!hgPage.nextCursor || hgPage.nextCursor === hgCursor))
      )
        throw new Error("商品目录响应异常，请重试");
      this.setState({
        hgItems: hgPage.list,
        hgCursor,
        hgHistory,
        hgHistoryBase,
        hgNext: hgPage.hasMore ? hgPage.nextCursor : "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgLoading: false });
    }
  };

  hgShowDetail = async (hgProductId) => {
    const hgSeq = ++this.hgSeq;
    const hgNewProduct = this.hgLastProductId !== hgProductId; // 仅切换商品时清空收件信息，网络重试不改变购买请求。
    this.hgLastProductId = hgProductId;
    // 进入详情时重置主图与标签，并记录目标商品 ID 以便加载期展示骨架屏。
    this.setState({
      hgLoading: true,
      hgError: "",
      hgDetail: null,
      hgMainImage: 0,
      hgDetailTab: "detail",
      hgDetailId: hgProductId,
      hgNotice: "",
      hgCreatedOrderId: "",
      hgBrokenImages: [],
      ...(hgNewProduct
        ? {
            hgBuyForm: {
              quantity: "1",
              receiverName: "",
              receiverPhone: "",
              receiverAddress: "",
            },
          }
        : {}),
    });
    try {
      const hgItem = await HGMallVM.detail(hgProductId);
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgDetail: hgItem });
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({
          hgError:
            hgError?.status === 404
              ? "商品不存在或已下架"
              : this.hgMessage(hgError),
        });
    } finally {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgLoading: false, hgDetailId: "" });
    }
  };

  /** 商家工作台组合模式：仅加载本人商家申请；商品、发布与订单由子页面各自读取。 */
  hgLoadMerchant = async () => {
    const hgSeq = ++this.hgMerchantSeq; // 本次商家申请请求身份，过期响应不得覆盖新结果。
    this.setState({ hgMerchantLoading: true });
    try {
      const hgMerchant = await HGMallVM.merchant();
      if (
        this.hgMounted &&
        this.state.hgView === "merchant" &&
        hgSeq === this.hgMerchantSeq
      )
        this.setState({ hgMerchant, hgError: "" });
    } catch (hgError) {
      if (
        this.hgMounted &&
        this.state.hgView === "merchant" &&
        hgSeq === this.hgMerchantSeq
      )
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && hgSeq === this.hgMerchantSeq)
        this.setState({ hgMerchantLoading: false });
    }
  };

  hgLoadReview = async (
    hgMerchantCursor = "",
    hgProductCursor = "",
    hgMediaCursor = "",
    hgEditCursor = ""
  ) => {
    const hgSeq = ++this.hgReviewSeq; // 同一审核视图可并发翻页，只提交最后一组游标结果。
    try {
      const [hgMerchants, hgProducts, hgMedia, hgEdits] = await Promise.all([
        HGMallVM.pendingMerchants(hgMerchantCursor),
        HGMallVM.pendingProducts(hgProductCursor),
        HGMallVM.pendingMedia(hgMediaCursor),
        HGMallVM.pendingEdits(hgEditCursor),
      ]);
      if (
        this.hgMounted &&
        this.state.hgView === "review" &&
        hgSeq === this.hgReviewSeq
      )
        this.setState({
          hgPendingMerchants: hgMerchants.list,
          hgPendingProducts: hgProducts.list,
          hgPendingMedia: hgMedia.list,
          hgMediaReviewCursor: hgMediaCursor,
          hgMediaReviewNext: hgMedia.hasMore ? hgMedia.nextCursor : "",
          hgPendingEdits: hgEdits.list,
          hgEditReviewCursor: hgEditCursor,
          hgEditReviewNext: hgEdits.hasMore ? hgEdits.nextCursor : "",
          hgReviewCursor: hgMerchantCursor,
          hgReviewNext: hgMerchants.hasMore ? hgMerchants.nextCursor : "",
          hgProductReviewCursor: hgProductCursor,
          hgProductReviewNext: hgProducts.hasMore ? hgProducts.nextCursor : "",
          hgError: "",
        });
    } catch (hgError) {
      if (
        this.hgMounted &&
        this.state.hgView === "review" &&
        hgSeq === this.hgReviewSeq
      )
        this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  hgSelectView = (hgView) => {
    ++this.hgSeq;
    ++this.hgMerchantSeq;
    ++this.hgReviewSeq;
    this.setState({
      hgView,
      hgDetail: null,
      hgDetailId: "",
      hgError: "",
      hgNotice: "",
    });
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
      // 商品、发布与订单子页面各自刷新数据；本页只维护商家申请与审核视图。
      if (this.hgMounted && this.state.hgView === "merchant")
        await this.hgLoadMerchant();
      if (this.hgMounted && this.state.hgView === "review")
        await this.hgLoadReview();
    } catch (hgError) {
      if (
        this.hgMounted &&
        this.state.hgView === "review" &&
        hgError?.status === 409
      ) {
        // 审核条件被其他操作改变时重新取当前页；服务器仍以条件更新防止重复审核。
        this.setState({ hgError: "审核状态已变化，正在刷新待审列表..." });
        await this.hgLoadReview(
          this.state.hgReviewCursor,
          this.state.hgProductReviewCursor,
          this.state.hgMediaReviewCursor,
          this.state.hgEditReviewCursor
        );
      } else if (this.hgMounted) {
        this.setState({ hgError: this.hgMessage(hgError) });
      }
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 购买响应未知时保持同一 requestId 重试；更改商品或收货信息则生成全新的键。 */
  hgBuy = async (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgWriteFlight) return;
    const { hgDetail, hgBuyForm } = this.state;
    const hgQuantity = Number(hgBuyForm.quantity);
    if (
      !hgDetail ||
      hgDetail.type !== "PHYSICAL_PRODUCT" ||
      !Number.isInteger(hgQuantity) ||
      hgQuantity < 1 ||
      hgQuantity > 10 ||
      hgQuantity > hgDetail.available ||
      hgDetail.amount * hgQuantity > 100000
    ) {
      this.setState({
        hgError: "库存不足或订单金额超过 100000 M币，请调整数量",
      });
      return;
    }
    const hgRequest = {
      productId: hgDetail.productId,
      quantity: hgQuantity,
      receiverName: hgBuyForm.receiverName.trim(),
      receiverPhone: hgBuyForm.receiverPhone.trim(),
      receiverAddress: hgBuyForm.receiverAddress.trim(),
    }; // 仅用于本次签名请求，不持久化收件资料。
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      const hgDigest = await hgPurchaseDigest(hgRequest);
      let hgPending = null;
      try {
        hgPending = JSON.parse(sessionStorage.getItem(hgPendingBuyKey));
      } catch {
        /* 会话存储不可用时回退到当前实例。 */
      }
      if (hgPending && hgPending.digest !== hgDigest)
        throw new Error(
          "存在结果未知的购买请求，请先在「我的订单 → 待付款」中核对，再清除待确认请求"
        );
      const hgRequestId =
        hgPending?.id || this.hgBuyRequestId || hgSecureRequestId();
      this.hgBuyRequestId = hgRequestId;
      try {
        sessionStorage.setItem(
          hgPendingBuyKey,
          JSON.stringify({ id: hgRequestId, digest: hgDigest })
        );
      } catch {
        /* 仅保留实例级重试键。 */
      }
      this.setState({ hgPendingBuy: true });
      // 只有响应包含服务端订单 ID 才算创建成功；异常时保留原幂等键。
      let hgOrder = null;
      try {
        // 创建订单返回的是待付款快照；仅用服务端订单 ID 导航，不以页面估算金额充当应付额。
        hgOrder = await HGMallVM.buy({ ...hgRequest, requestId: hgRequestId });
        if (!hgOrder?.orderId)
          throw new Error("订单创建结果未知，请核对我的订单或使用原请求重试");
      } catch (hgError) {
        // 明确拒绝的 4xx 不会扣款；超时、5xx 与网络断开时绝不替换幂等键。
        if (
          hgError?.status >= 400 &&
          hgError.status < 500 &&
          hgError.status !== 429
        ) {
          try {
            sessionStorage.removeItem(hgPendingBuyKey);
          } catch {
            /* 实例键仍可被复用。 */
          }
          this.setState({ hgPendingBuy: false });
          this.hgBuyRequestId = "";
        }
        throw hgError;
      }
      try {
        sessionStorage.removeItem(hgPendingBuyKey);
      } catch {
        /* 下次页面加载时可查询订单确认。 */
      }
      this.hgBuyRequestId = "";
      // 路由参数在写请求期间变化时，不将旧商品的下单提示带到新商品详情。
      if (
        this.hgMounted &&
        (!this.hgIsRouteDetail() ||
          this.props.hgProductId === hgRequest.productId)
      ) {
        // 买家订单列表已迁入个人中心「我的订单」，这里只提示去那里支付。
        // 路由详情模式保留当前商品展示，让下单结果提示直接显示在详情页顶部。
        this.setState((hgState) => ({
          hgPendingBuy: false,
          hgNotice:
            "订单已创建，请在「个人中心 → 我的订单 → 待付款」中完成 M币支付",
          hgCreatedOrderId: hgOrder.orderId,
          hgDetail: this.hgIsRouteDetail() ? hgState.hgDetail : null,
          hgDetailId: "",
          hgBuyForm: {
            quantity: "1",
            receiverName: "",
            receiverPhone: "",
            receiverAddress: "",
          },
        }));
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  renderCatalog() {
    const { hgDetail, hgDetailId } = this.state;
    // 详情优先；加载期用骨架屏占位，避免短暂回显目录造成闪烁。
    if (hgDetail) return this.renderProductDetail();
    if (hgDetailId) return this.renderDetailSkeleton();
    // 直达商品详情失败时只展示错误与返回入口，不回显未加载的商品目录。
    if (this.hgIsRouteDetail())
      return (
        <div className={styles.shopEmpty}>
          <button type="button" onClick={this.hgCloseDetail}>
            返回商品列表
          </button>
        </div>
      );
    return this.renderProductList();
  }

  /** 商品目录：PC 端类目条 + 卡片网格 + 分页，对标拼多多电脑版商品列表。 */
  renderProductList() {
    const {
      hgCategory,
      hgItems,
      hgLoading,
      hgCursor,
      hgNext,
      hgHistory,
      hgHistoryBase,
    } = this.state;
    return (
      <>
        <p className={styles.shopFilterHint}>
          人民币独立交易与 M币商城互不混用 · <Link to={ROUTE_PATH.MALL_CNY}>进入人民币拼团沙箱</Link>
        </p>
        <nav className={styles.shopCategoryBar} aria-label="商品类目">
          {hgCategories.map(([hgCode, hgLabel]) => (
            <button
              key={hgCode}
              type="button"
              aria-pressed={hgCategory === hgCode}
              onClick={() => this.hgLoadCatalog(hgCode, "", [])}
            >
              {hgLabel}
            </button>
          ))}
        </nav>
        <div className={styles.shopFilterBar}>
          <span className={styles.shopFilterCount}>
            本页 {hgItems.length} 件 · 第 {hgHistoryBase + hgHistory.length + 1}{" "}
            页{hgHistoryBase > 0 ? " · 仅可返回最近 64 页" : ""}
          </span>
          <span className={styles.shopFilterHint}>综合推荐</span>
        </div>
        {hgLoading && (
          <p role="status" className={styles.shopLoading}>
            正在加载商品...
          </p>
        )}
        {!hgLoading && !hgItems.length && (
          <div className={styles.shopEmpty}>该类目暂无已审核商品</div>
        )}
        <div className={styles.shopGoodsGrid}>
          {hgItems.map((hgItem) => {
            const hgLabel =
              hgCategories.find(
                ([hgCode]) => hgCode === hgItem.category
              )?.[1] || "商品";
            return (
              <Link
                key={hgItem.productId}
                className={styles.shopGoodsCard}
                to={ROUTE_PATH.PRODUCT_DETAIL.replace(
                  ":productId",
                  encodeURIComponent(hgItem.productId)
                )}
              >
                <div className={styles.shopGoodsThumb}>
                  {hgItem.imageURLs?.length &&
                  !this.state.hgBrokenImages.includes(hgItem.imageURLs[0]) ? (
                    <img
                      src={normalizeVideoCoverUrl(hgItem.imageURLs[0])}
                      alt={`${hgItem.title} 展示图`}
                      loading="lazy"
                      onError={() => this.hgImageFailed(hgItem.imageURLs[0])}
                    />
                  ) : (
                    <span className={styles.shopGoodsPlaceholder}>
                      {hgLabel}
                    </span>
                  )}
                </div>
                <div className={styles.shopGoodsInfo}>
                  <h3 className={styles.shopGoodsTitle}>{hgItem.title}</h3>
                  <div className={styles.shopGoodsPrice}>
                    <b>{HGFormatCoin(hgItem.amount)}</b>
                    <small>M 币</small>
                  </div>
                  <div className={styles.shopGoodsMeta}>
                    <span className={styles.shopGoodsShop}>
                      {hgItem.shopName}
                    </span>
                    {hgItem.type === "MEMBERSHIP" ? (
                      <span className={styles.shopGoodsSold}>会员仅展示</span>
                    ) : (
                      <span className={styles.shopGoodsSold}>
                        可售 {hgItem.available} 件
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
        <div className={styles.shopPager}>
          <button
            type="button"
            disabled={!hgHistory.length || hgLoading}
            onClick={() =>
              this.hgLoadCatalog(
                hgCategory,
                hgHistory[hgHistory.length - 1],
                hgHistory.slice(0, -1),
                hgHistoryBase
              )
            }
          >
            上一页
          </button>
          <span className={styles.shopPagerText}>
            第 {hgHistoryBase + hgHistory.length + 1} 页
          </span>
          <button
            type="button"
            disabled={!hgNext || hgLoading}
            onClick={() => {
              const hgPage = HGAdvanceMallPage(
                hgHistory,
                hgHistoryBase,
                hgCursor
              ); // 目录翻页历史保持有界，不影响服务端游标。
              this.hgLoadCatalog(
                hgCategory,
                hgNext,
                hgPage.history,
                hgPage.base
              );
            }}
          >
            下一页
          </button>
        </div>
      </>
    );
  }

  /** 详情加载占位：与详情卡片同尺寸的骨架屏，避免布局跳动。 */
  renderDetailSkeleton() {
    return (
      <div className={styles.shopDetailCard} role="status" aria-busy="true">
        <div className={styles.shopSkeletonMedia} />
        <div className={styles.shopInfoPanel}>
          <span className={styles.shopSkeletonLine} />
          <span
            className={styles.shopSkeletonLine}
            style={{ width: "55%", height: 28 }}
          />
          <span
            className={styles.shopSkeletonLine}
            style={{ width: "40%", height: 18 }}
          />
          <span className={styles.shopSkeletonLine} />
          <span
            className={styles.shopSkeletonLine}
            style={{ width: "70%", height: 18 }}
          />
        </div>
      </div>
    );
  }

  /** 详情面包屑：返回目录或切换类目都从同一入口，保留当前位置上下文。 */
  renderDetailBreadcrumb(hgCategoryLabel) {
    return (
      <nav className={styles.shopBreadcrumb} aria-label="商品位置">
        <button type="button" onClick={this.hgCloseDetail}>
          全部商品
        </button>
        <span className={styles.shopCrumbSep}>/</span>
        <button
          type="button"
          // 路由详情模式从面包屑切类目同样返回目录页，不在详情路由内嵌列表。
          onClick={() =>
            this.hgIsRouteDetail()
              ? this.hgCloseDetail()
              : this.hgLoadCatalog(this.state.hgDetail?.category || "", "", [])
          }
        >
          {hgCategoryLabel}
        </button>
        <span className={styles.shopCrumbSep}>/</span>
        <span className={styles.shopCrumbCurrent}>商品详情</span>
      </nav>
    );
  }

  /** 详情页图区：主图 + 缩略图横排，无图时回退类目占位。 */
  renderDetailGallery(hgImages) {
    const { hgDetail, hgMainImage } = this.state;
    if (!hgImages.length) {
      const hgLabel =
        hgCategories.find(([hgCode]) => hgCode === hgDetail.category)?.[1] ||
        "商品";
      return (
        <div className={styles.shopGallery}>
          <div className={styles.shopGalleryMain} aria-label="商品暂未上传图片">
            <span className={styles.shopGoodsPlaceholder}>{hgLabel}</span>
          </div>
        </div>
      );
    }
    const hgCurrent = normalizeVideoCoverUrl(
      hgImages[hgMainImage] || hgImages[0]
    );
    return (
      <div className={styles.shopGallery}>
        <div className={styles.shopGalleryMain}>
          <img
            src={hgCurrent}
            alt={`${hgDetail.title} · 展示图 ${(hgMainImage || 0) + 1}`}
            loading="lazy"
            onError={() =>
              this.hgImageFailed(hgImages[hgMainImage] || hgImages[0])
            }
          />
        </div>
        <div className={styles.shopGalleryThumbs}>
          {hgImages.map((hgURL, hgIndex) => (
            <button
              key={hgURL}
              type="button"
              className={styles.shopGalleryThumb}
              aria-pressed={hgMainImage === hgIndex}
              aria-label={`查看展示图 ${hgIndex + 1}`}
              onClick={() => this.hgSetMainImage(hgIndex)}
            >
              <img
                src={normalizeVideoCoverUrl(hgURL)}
                alt=""
                loading="lazy"
                onError={() => this.hgImageFailed(hgURL)}
              />
            </button>
          ))}
        </div>
      </div>
    );
  }

  /** 详情页信息区：标题、价格、店铺、规格、服务、收货表单与下单按钮。 */
  renderProductDetail() {
    const { hgDetail, hgBusy, hgPendingBuy } = this.state;
    const hgImages = Array.isArray(hgDetail.imageURLs)
      ? hgDetail.imageURLs.filter(
          (hgURL) => !this.state.hgBrokenImages.includes(hgURL)
        )
      : [];
    const hgCategoryLabel =
      hgCategories.find(([hgCode]) => hgCode === hgDetail.category)?.[1] ||
      "商品";
    const hgStock = Number(hgDetail.available) || 0;
    const hgSoldOut = hgDetail.type === "PHYSICAL_PRODUCT" && hgStock < 1;
    const hgTotal =
      hgDetail.type === "PHYSICAL_PRODUCT"
        ? hgDetail.amount * (Number(this.state.hgBuyForm.quantity) || 1)
        : hgDetail.amount;
    return (
      <>
        {this.renderDetailBreadcrumb(hgCategoryLabel)}
        <div className={styles.shopDetailCard}>
          {this.renderDetailGallery(hgImages)}
          <form className={styles.shopInfoPanel} onSubmit={this.hgBuy}>
            <small className={styles.shopInfoSub}>
              {hgDetail.shopName} ·{" "}
              {hgDetail.category === "membership" ? "会员商品" : "实物商品"}
            </small>
            <h1 className={styles.shopInfoTitle}>{hgDetail.title}</h1>
            <p className={styles.shopInfoSummary}>{hgDetail.summary}</p>

            <div className={styles.shopPricePanel}>
              <div className={styles.shopPriceNow}>
                <b>{HGFormatCoin(hgDetail.amount)}</b>
                <small>M 币</small>
              </div>
            </div>

            <div className={styles.shopShopRow}>
              <span className={styles.shopShopName}>{hgDetail.shopName}</span>
              <span className={styles.shopShopTag}>{hgCategoryLabel}</span>
            </div>

            {hgDetail.skuTitle && (
              <div className={styles.shopSpecRow}>
                <span className={styles.shopSpecLabel}>规格</span>
                <span className={styles.shopSpecChip}>{hgDetail.skuTitle}</span>
              </div>
            )}

            {hgDetail.type === "PHYSICAL_PRODUCT" && (
              <div className={styles.shopSpecRow}>
                <span className={styles.shopSpecLabel}>数量</span>
                <div className={styles.shopStepper}>
                  <button
                    type="button"
                    aria-label="减少数量"
                    disabled={hgSoldOut}
                    onClick={() => this.hgStepQuantity(-1)}
                  >
                    −
                  </button>
                  <input
                    required
                    type="number"
                    min="1"
                    max={Math.min(10, hgStock) || 1}
                    step="1"
                    value={this.state.hgBuyForm.quantity}
                    onChange={(hgEvent) =>
                      this.hgUpdateBuy("quantity", hgEvent.target.value)
                    }
                  />
                  <button
                    type="button"
                    aria-label="增加数量"
                    disabled={
                      hgSoldOut ||
                      (Number(this.state.hgBuyForm.quantity) || 1) >=
                        Math.min(10, hgStock)
                    }
                    onClick={() => this.hgStepQuantity(1)}
                  >
                    +
                  </button>
                </div>
                <span className={styles.shopStockHint}>
                  库存 {hgStock} 件 · 单笔至多 10 件
                </span>
              </div>
            )}

            {hgDetail.type === "PHYSICAL_PRODUCT" ? (
              <>
                <fieldset className={styles.shopReceiverCard}>
                  <legend>收货信息</legend>
                  <div className={styles.shopReceiverGrid}>
                    <label className={styles.shopField}>
                      <span>收件人</span>
                      <input
                        required
                        maxLength={64}
                        placeholder="请输入收件人姓名"
                        value={this.state.hgBuyForm.receiverName}
                        onChange={(hgEvent) =>
                          this.hgUpdateBuy("receiverName", hgEvent.target.value)
                        }
                      />
                    </label>
                    <label className={styles.shopField}>
                      <span>手机号</span>
                      <input
                        required
                        inputMode="tel"
                        maxLength={20}
                        placeholder="请输入联系手机号"
                        value={this.state.hgBuyForm.receiverPhone}
                        onChange={(hgEvent) =>
                          this.hgUpdateBuy(
                            "receiverPhone",
                            hgEvent.target.value
                          )
                        }
                      />
                    </label>
                  </div>
                  <label className={styles.shopField}>
                    <span>详细收货地址</span>
                    <textarea
                      required
                      maxLength={512}
                      rows={2}
                      placeholder="省/市/区/街道及门牌号"
                      value={this.state.hgBuyForm.receiverAddress}
                      onChange={(hgEvent) =>
                        this.hgUpdateBuy(
                          "receiverAddress",
                          hgEvent.target.value
                        )
                      }
                    />
                  </label>
                </fieldset>
                <p className={styles.shopBuyTip}>
                  商品标价含配送费；下单后预留库存 15 分钟，付款时才扣 M 币。
                  到期自动释放库存；已付款未发货可全额退款，运单由商家人工录入。
                </p>
                <div className={styles.shopBuyBar}>
                  <div className={styles.shopBuyTotal}>
                    参考合计 <strong>{HGFormatCoin(hgTotal)}</strong> M
                    币（以订单为准）
                  </div>
                  <button
                    type="button"
                    className={styles.shopBuyGhost}
                    onClick={this.hgCloseDetail}
                  >
                    返回列表
                  </button>
                  <button
                    type="submit"
                    className={styles.shopBuyPrimary}
                    disabled={hgBusy || hgSoldOut || hgDetail.amount > 100000}
                  >
                    {hgSoldOut
                      ? "已售罄"
                      : hgPendingBuy
                      ? "重试原订单请求"
                      : "提交订单"}
                  </button>
                </div>
              </>
            ) : (
              <div className={styles.shopBuyBar}>
                <div className={styles.shopBuyTotal}>
                  会员权益尚未接入，仅展示商品，暂不可购买。
                </div>
                <button
                  type="button"
                  className={styles.shopBuyGhost}
                  onClick={this.hgCloseDetail}
                >
                  返回列表
                </button>
              </div>
            )}
          </form>
        </div>

        <section className={styles.shopDetailSection}>
          <div className={styles.shopDetailTabs} role="tablist">
            <button
              type="button"
              role="tab"
              aria-pressed={this.state.hgDetailTab === "detail"}
              onClick={() => this.setState({ hgDetailTab: "detail" })}
            >
              商品详情
            </button>
            <button
              type="button"
              role="tab"
              aria-pressed={this.state.hgDetailTab === "spec"}
              onClick={() => this.setState({ hgDetailTab: "spec" })}
            >
              规格参数
            </button>
          </div>
          <div className={styles.shopDetailBody}>
            {this.state.hgDetailTab === "spec" ? (
              <table className={styles.shopSpecTable}>
                <tbody>
                  <tr>
                    <th>店铺</th>
                    <td>{hgDetail.shopName}</td>
                  </tr>
                  <tr>
                    <th>类目</th>
                    <td>{hgCategoryLabel}</td>
                  </tr>
                  <tr>
                    <th>规格</th>
                    <td>{hgDetail.skuTitle || "—"}</td>
                  </tr>
                  {hgDetail.type === "PHYSICAL_PRODUCT" && (
                    <tr>
                      <th>库存</th>
                      <td>{hgStock} 件</td>
                    </tr>
                  )}
                  <tr>
                    <th>类型</th>
                    <td>
                      {hgDetail.category === "membership" ? "会员" : "实物商品"}
                    </td>
                  </tr>
                </tbody>
              </table>
            ) : (
              <>
                <p className={styles.shopDetailDesc}>
                  {hgDetail.description || hgDetail.summary}
                </p>
                {hgImages.length > 0 && (
                  <div className={styles.shopDetailGallery}>
                    {hgImages.map((hgURL, hgIndex) => (
                      <img
                        key={hgURL}
                        src={normalizeVideoCoverUrl(hgURL)}
                        alt={`${hgDetail.title} · 详情图 ${hgIndex + 1}`}
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </>
    );
  }

  hgUpdateBuy = (hgKey, hgValue) => {
    this.hgBuyRequestId = "";
    this.setState((hgState) => ({
      hgBuyForm: { ...hgState.hgBuyForm, [hgKey]: hgValue },
    }));
  };

  /** 图片加载失败只从当前展示集合移除该 URL，所有图片失效时回退类目占位。 */
  hgImageFailed = (hgURL) => {
    this.setState((hgState) => ({
      hgBrokenImages: hgState.hgBrokenImages.includes(hgURL)
        ? hgState.hgBrokenImages
        : [...hgState.hgBrokenImages, hgURL],
      hgMainImage: 0,
    }));
  };

  /** 详情页切换主图，越界或无图时回退到首图，避免索引失配导致空白。 */
  hgSetMainImage = (hgIndex) => {
    const hgCount = this.state.hgDetail?.imageURLs?.length || 0;
    if (!hgCount) return;
    this.setState({ hgMainImage: Math.min(Math.max(hgIndex, 0), hgCount - 1) });
  };

  /** 数量步进：在 1 与单笔上限（实物取 10 与可售库存的较小值）之间夹紧。 */
  hgStepQuantity = (hgDelta) => {
    const hgDetail = this.state.hgDetail;
    if (!hgDetail || hgDetail.type !== "PHYSICAL_PRODUCT") return;
    const hgMax = Math.min(10, Number(hgDetail.available) || 0) || 1;
    const hgNext = Math.min(
      Math.max((Number(this.state.hgBuyForm.quantity) || 1) + hgDelta, 1),
      hgMax
    );
    this.hgUpdateBuy("quantity", String(hgNext));
  };

  /** 关闭详情返回目录；路由详情模式导航到商品列表页，内联模式仅还原本地状态。 */
  hgCloseDetail = () => {
    this.hgBuyRequestId = "";
    if (this.hgIsRouteDetail()) {
      hgPageNavigator.open({ page: PAGE.PRODUCTS });
      return;
    }
    this.setState({ hgDetail: null, hgDetailId: "", hgMainImage: 0 });
  };

  /**
   * 商家工作台：入驻申请卡片由本页维护；商品管理、新增商品与订单发货
   * 组合独立子页面，同一实现同时服务商城工作台与个人中心菜单，不重复设计。
   */
  renderMerchant() {
    const { hgMerchant, hgShopName, hgBusy } = this.state;
    // 个人中心「商家入驻申请」菜单只展示申请卡片；完整工作台仍保留在商城页。
    const hgApplyOnly = this.props.hgMerchantSection === "apply";
    return (
      <div className={styles.workspace}>
        <section>
          <h2>商家入驻</h2>
          <p>
            申请由管理员审核，通过后可发布单规格商品；商品再次审核通过才公开。
          </p>
          {this.state.hgMerchantLoading ? (
            <p role="status">正在读取店铺与商品...</p>
          ) : hgMerchant ? (
            <p>
              店铺：<strong>{hgMerchant.shopName}</strong> ·{" "}
              {hgMerchant.status === 1
                ? "审核通过"
                : hgMerchant.status === 2
                ? "审核未通过，可重新提交"
                : "等待审核"}
            </p>
          ) : (
            <p>尚未提交申请。</p>
          )}
          {!this.state.hgMerchantLoading &&
            (!hgMerchant || hgMerchant.status === 2) && (
              <form
                onSubmit={(hgEvent) => {
                  hgEvent.preventDefault();
                  this.hgWrite(
                    () => HGMallVM.apply(hgShopName.trim()),
                    "申请已提交，请等待审核"
                  );
                }}
              >
                <label>
                  店铺名称{" "}
                  <input
                    required
                    maxLength={128}
                    value={hgShopName}
                    onChange={(hgEvent) =>
                      this.setState({ hgShopName: hgEvent.target.value })
                    }
                  />
                </label>
                <button type="submit" disabled={hgBusy}>
                  提交入驻申请
                </button>
              </form>
            )}
          {hgApplyOnly && hgMerchant?.status === 1 && (
            <p>商品发布、管理与发货请使用左侧「商家中心」子菜单。</p>
          )}
        </section>
        {!hgApplyOnly && hgMerchant?.status === 1 && (
          <>
            <HGMerchantProductsPage hgMerchant={hgMerchant} />
            <HGMerchantPublishPage hgMerchant={hgMerchant} />
            <HGMerchantOrdersPage hgMerchant={hgMerchant} />
          </>
        )}
      </div>
    );
  }

  renderReview() {
    const {
      hgPendingMerchants,
      hgPendingProducts,
      hgPendingMedia,
      hgPendingEdits,
      hgReviewNext,
      hgProductReviewNext,
      hgMediaReviewNext,
      hgEditReviewNext,
      hgBusy,
    } = this.state;
    return (
      <div className={styles.workspace}>
        <section>
          <h2>待审核商家</h2>
          <p>本人商家申请不可自审，需由其他具有审核权限的管理员处理。</p>
          {!hgPendingMerchants.length && <p>当前页无可审核申请。</p>}
          {hgPendingMerchants.map((hgItem) => (
            <div className={styles.reviewRow} key={hgItem.merchantId}>
              <span>
                {hgItem.shopName} · {hgItem.userId}
              </span>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewMerchant(hgItem.merchantId, true),
                    "商家已通过审核"
                  )
                }
              >
                通过
              </button>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewMerchant(hgItem.merchantId, false),
                    "商家申请已拒绝"
                  )
                }
              >
                拒绝
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={!hgReviewNext || hgBusy}
            onClick={() =>
              this.hgLoadReview(
                hgReviewNext,
                this.state.hgProductReviewCursor,
                this.state.hgMediaReviewCursor,
                this.state.hgEditReviewCursor
              )
            }
          >
            下一页商家
          </button>
        </section>
        <section>
          <h2>待审核商品</h2>
          {!hgPendingProducts.length && <p>当前页无待审商品。</p>}
          {hgPendingProducts.map((hgItem) => (
            <div className={styles.reviewRow} key={hgItem.productId}>
              <span>
                {hgItem.title} · {hgItem.shopName} · {hgItem.summary} ·{" "}
                {hgItem.description} · {HGFormatCoin(hgItem.amount)} M币
                {hgItem.imageURLs?.map((hgURL) => (
                  <img
                    className={styles.reviewImage}
                    src={normalizeVideoCoverUrl(hgURL)}
                    key={hgURL}
                    alt={`${hgItem.title} 待审图`}
                  />
                ))}
              </span>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewProduct(hgItem.productId, true),
                    "商品已上架"
                  )
                }
              >
                通过
              </button>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewProduct(hgItem.productId, false),
                    "商品已拒绝"
                  )
                }
              >
                拒绝
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={!hgProductReviewNext || hgBusy}
            onClick={() =>
              this.hgLoadReview(
                this.state.hgReviewCursor,
                hgProductReviewNext,
                this.state.hgMediaReviewCursor,
                this.state.hgEditReviewCursor
              )
            }
          >
            下一页商品
          </button>
        </section>
        <section>
          <h2>已上架商品补图审核</h2>
          <p>
            每张图片单独审核；通过后才会加入公开商品目录，不改变商品上架与订单状态。
          </p>
          {!hgPendingMedia.length && <p>当前页暂无待审补图。</p>}
          {hgPendingMedia.map((hgItem) => (
            <div className={styles.reviewRow} key={hgItem.imageURL}>
              <span>
                {hgItem.title} · {hgItem.shopName}
                <img
                  className={styles.reviewImage}
                  src={normalizeVideoCoverUrl(hgItem.imageURL)}
                  alt={`${hgItem.title} 待审补图`}
                />
              </span>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewMedia(hgItem.imageURL, true),
                    "商品补图已公开"
                  )
                }
              >
                通过
              </button>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewMedia(hgItem.imageURL, false),
                    "商品补图已拒绝"
                  )
                }
              >
                拒绝
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={!hgMediaReviewNext || hgBusy}
            onClick={() =>
              this.hgLoadReview(
                this.state.hgReviewCursor,
                this.state.hgProductReviewCursor,
                hgMediaReviewNext,
                this.state.hgEditReviewCursor
              )
            }
          >
            下一页补图
          </button>
        </section>
        <section>
          <h2>已上架商品资料修改审核</h2>
          <p>审核后才更新公开目录；拒绝不会修改原商品或历史订单。</p>
          {!hgPendingEdits.length && <p>当前页暂无待审资料修改。</p>}
          {hgPendingEdits.map((hgItem) => (
            <div className={styles.reviewRow} key={hgItem.productId}>
              <span>
                {hgItem.shopName} · {hgItem.productId}
                <br />
                商品名称：{hgItem.title}
                <br />
                简介：{hgItem.summary}
                <br />
                介绍：{hgItem.description}
              </span>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewEdit(hgItem.productId, true),
                    "商品资料修改已公开"
                  )
                }
              >
                通过
              </button>
              <button
                type="button"
                disabled={hgBusy}
                onClick={() =>
                  this.hgWrite(
                    () => HGMallVM.reviewEdit(hgItem.productId, false),
                    "商品资料修改已拒绝"
                  )
                }
              >
                拒绝
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={!hgEditReviewNext || hgBusy}
            onClick={() =>
              this.hgLoadReview(
                this.state.hgReviewCursor,
                this.state.hgProductReviewCursor,
                this.state.hgMediaReviewCursor,
                hgEditReviewNext
              )
            }
          >
            下一页资料修改
          </button>
        </section>
      </div>
    );
  }

  render() {
    const hgIsCatalog = this.state.hgView === "catalog";
    // 目录视图走透明舞台，让商品卡片直接落在页面灰底上；商家工作台沿用白底卡片。
    const hgStageClass = hgIsCatalog ? styles.shopStage : styles.section;
    return (
      <section className={hgStageClass} aria-label="商城商品与商家工作台">
        {this.state.hgError && (
          <p role="alert" className={styles.error}>
            {this.state.hgError}{" "}
            <button
              type="button"
              // 路由详情模式重试当前商品；目录与工作台按各自视图重载。
              onClick={() =>
                this.hgIsRouteDetail()
                  ? this.hgShowDetail(this.props.hgProductId)
                  : this.hgSelectView(this.state.hgView)
              }
            >
              重试
            </button>
          </p>
        )}
        {this.state.hgNotice && (
          <p role="status" className={styles.notice}>
            {this.state.hgNotice}
            {this.state.hgCreatedOrderId && (
              <>
                {" "}
                ·{" "}
                <Link
                  to={ROUTE_PATH.MALL_ORDER_DETAIL.replace(
                    ":orderId",
                    encodeURIComponent(this.state.hgCreatedOrderId)
                  )}
                >
                  查看订单并支付
                </Link>
              </>
            )}
          </p>
        )}
        {hgIsCatalog ? this.renderCatalog() : this.renderMerchant()}
      </section>
    );
  }
}

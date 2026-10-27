import React from "react";
import { Link } from "react-router-dom";
import { ROUTE_PATH } from "../../manager_antd/router/hg_router_path";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import { HGFormatCoin } from "./hg_mall_amount.js";
import { HGAdvanceMallPage } from "./hg_mall_cursor.js";
import { hgSecureRequestId } from "./hg_mall_security.js";
import styles from "./hg_mall_page.module.css";
import HGMallVM from "./hg_mall_vm.js";

const hgCategories = [
  ["", "全部商品"],
  ["digital", "数码影音"],
  ["appliance", "家用电器"],
  ["clothing", "服饰"],
  ["beauty", "美妆个护"],
  ["membership", "会员"],
]; // 与 Go 服务端类目白名单对齐，不从原型构造商品记录。

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
    hgMine: [], // 本店至多 20 件商品，默认空。
    hgMerchantCursor: "", // 本店商品当前页请求游标；空为第一页。
    hgMerchantHistory: [], // 本店商品最近最多64页游标，用于上一页。
    hgMerchantNext: "", // 本店下页游标；空为没有后续页。
    hgMerchantQuery: "", // 按商品业务 ID 精确查找的输入值；空时展示本人列表。
    hgFoundProduct: null, // 本人查找结果；null 表示没有进行有效查找。
    hgMerchantSearching: false, // 单件商品查找请求状态，防止重复提交。
    hgMerchantLoading: false, // 本店商品页读取中；尚未获取时不显示空态。
    hgEditProductId: "", // 当前编辑文字信息的已上架商品 ID；空为未编辑。
    hgEditForm: { title: "", summary: "", description: "" }, // 待审文字资料副本；不覆盖公开商品。
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
    hgCanReview: false, // 仅审核 API 返回成功才显示审核入口。
    hgShopName: "", // 用户输入的店铺名；提交前无默认值。
    hgDraft: {
      type: "PHYSICAL_PRODUCT",
      category: "digital",
      title: "",
      summary: "",
      description: "",
      skuTitle: "",
      amount: "",
    }, // 商品草稿；介绍为纯文本，金额为整币文本。
    hgSelectedImages: [], // 待上传的最多5张本地图片；只保留 File 于当前页面，不持久化。
    hgSelectedPreviews: [], // 新商品图片本地 blob URL，与 hgSelectedImages 同序；移除、发布或卸载时释放。
    hgUploadedImages: [], // 本次草稿已成功上传的图片 URL，失败重试不重复上传。
    hgUnusedImages: [], // 本人历史上传但未发布的有界图片列表，可手动清除释放限额。
    hgMediaProductId: "", // 当前准备补图的本人已上架商品 ID；空表示未选择商品。
    hgMediaFiles: [], // 当前补图选中的文件，最多5张；仅保存在页面内。
    hgMediaPreviews: [], // 旧商品补图的本地 blob URL，与 hgMediaFiles 同序；不作为发布地址。
    hgMediaURLs: [], // 当前补图已上传的 URL；失败重试时避免重复上传。
    hgInspectMediaProductId: "", // 当前查看补图审核状态的本人商品 ID；空表示未选中。
    hgPendingOwnMedia: [], // 本商品待审核图片，最多5张；不可当作已公开目录图片。
    hgOwnMediaLoading: false, // 本人补图审核状态读取中；初始没有查询。
    hgStock: "", // 新发布实物商品初始库存文本；会员不填，服务端校验 1-100000。
    hgBuyForm: {
      quantity: "1",
      receiverName: "",
      receiverPhone: "",
      receiverAddress: "",
    }, // 当前商品一次性收货快照；不可当作地址簿复用。
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
  hgSellerSeq = 0; // 本店订单请求序号；切换视图后不提交旧响应。
  hgMerchantSeq = 0; // 本店商品页请求序号；快速翻页只接受最后一次响应。
  hgReviewSeq = 0; // 审核双列表请求序号；不同游标响应不可相互覆盖。
  hgOwnMediaSeq = 0; // 补图状态请求序号；切换商品后忽略旧响应。

  componentDidMount() {
    this.hgMounted = true;
    try {
      this.setState({
        hgPendingBuy: !!sessionStorage.getItem(hgPendingBuyKey),
      });
    } catch {
      /* 禁用存储时仍保留当前组件内的幂等键。 */
    }
    if (this.state.hgView === "merchant") {
      this.hgLoadMerchant();
      this.hgLoadSellerOrders();
    } else this.hgLoadCatalog("", "", []);
    this.hgLoadReviewAccess();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgReleasePreviews(this.state.hgSelectedPreviews);
    this.hgReleasePreviews(this.state.hgMediaPreviews);
    this.hgSeq += 1;
    this.hgSellerSeq += 1;
    this.hgMerchantSeq += 1;
    this.hgReviewSeq += 1;
    this.hgOwnMediaSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "商城请求失败，请重试";

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
      hgCategory,
      hgItems: [],
      hgNext: "",
      hgCursor,
      hgHistory,
      hgHistoryBase,
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
    this.setState({ hgLoading: true, hgError: "", hgDetail: null });
    try {
      const hgItem = await HGMallVM.detail(hgProductId);
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgDetail: hgItem });
    } catch (hgError) {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgSeq === hgSeq)
        this.setState({ hgLoading: false });
    }
  };

  hgLoadMerchant = async (hgCursor = "", hgHistory = []) => {
    const hgSeq = ++this.hgMerchantSeq; // 本次本店商品游标请求身份，过期响应不得覆盖新页。
    this.setState({ hgMerchantLoading: true });
    try {
      const [hgMerchant, hgMine, hgUnused] = await Promise.all([
        HGMallVM.merchant(),
        HGMallVM.mine(hgCursor),
        HGMallVM.unusedImages().catch(() => null),
      ]);
      if (
        this.hgMounted &&
        this.state.hgView === "merchant" &&
        hgSeq === this.hgMerchantSeq
      )
        this.setState({
          hgMerchant,
          hgMine: hgMine.list,
          hgMerchantCursor: hgCursor,
          hgMerchantHistory: hgHistory,
          hgMerchantNext: hgMine.hasMore ? hgMine.nextCursor : "",
          hgUnusedImages: hgUnused?.imageURLs || [],
          hgError: "",
        });
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

  /** 商品 ID 唯一索引精确查本人记录，避免深分页遍历或无索引标题模糊查询。 */
  hgFindMerchantProduct = async (hgEvent) => {
    hgEvent?.preventDefault();
    const hgProductId = this.state.hgMerchantQuery.trim();
    if (!hgProductId) {
      this.setState({ hgFoundProduct: null, hgError: "" });
      return;
    }
    if (this.state.hgMerchantSearching) return;
    this.setState({
      hgMerchantSearching: true,
      hgError: "",
      hgFoundProduct: null,
    });
    try {
      const hgItem = await HGMallVM.mineDetail(hgProductId);
      if (this.hgMounted) this.setState({ hgFoundProduct: hgItem });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted) this.setState({ hgMerchantSearching: false });
    }
  };

  /** 文字变更提交审核，保留旧商品展示直到其他审核员批准。 */
  hgSubmitEdit = (hgEvent) => {
    hgEvent.preventDefault();
    this.hgWrite(async () => {
      await HGMallVM.stageEdit({
        productId: this.state.hgEditProductId,
        ...this.state.hgEditForm,
      });
      if (this.hgMounted) this.setState({ hgEditProductId: "" });
    }, "商品资料修改已提交审核，审核前原资料继续展示");
  };

  /** 商品归档是受限单行软删除；现有订单仍按交易快照履约。 */
  hgArchiveProduct = (hgProductId) => {
    if (
      !window.confirm(
        "归档后商品将从目录下架，不能再产生新订单；已有订单仍可继续处理。确认归档？"
      )
    )
      return;
    this.hgWrite(async () => {
      await HGMallVM.archive(hgProductId);
      if (this.hgMounted)
        this.setState((hgState) => ({
          hgFoundProduct:
            hgState.hgFoundProduct?.productId === hgProductId
              ? { ...hgState.hgFoundProduct, lifecycleStatus: 2 }
              : hgState.hgFoundProduct,
          hgEditProductId:
            hgState.hgEditProductId === hgProductId
              ? ""
              : hgState.hgEditProductId,
        }));
    }, "商品已归档，不再进入公开目录");
  };

  /** 本店已支付订单来自独立的商家授权接口；买家本人订单由用户中心的订单面板读取。 */
  hgLoadSellerOrders = async (hgCursor = "") => {
    const hgSeq = ++this.hgSellerSeq;
    try {
      const hgPage = await HGMallVM.merchantOrders(hgCursor);
      if (
        !this.hgMounted ||
        this.state.hgView !== "merchant" ||
        this.hgSellerSeq !== hgSeq
      )
        return;
      if (
        !Array.isArray(hgPage?.list) ||
        typeof hgPage?.hasMore !== "boolean" ||
        typeof hgPage?.nextCursor !== "string"
      )
        throw new Error("商品订单响应异常");
      this.setState({
        hgSellerOrders: hgPage.list,
        hgSellerCursor: hgCursor,
        hgSellerNext: hgPage.hasMore ? hgPage.nextCursor : "",
        hgError: "",
      });
    } catch (hgError) {
      if (
        this.hgMounted &&
        this.state.hgView === "merchant" &&
        this.hgSellerSeq === hgSeq
      )
        this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  /** 审核入口由服务端 RBAC 状态决定；普通商家收到 false，不探测受限审核列表。 */
  hgLoadReviewAccess = async () => {
    try {
      const hgAccess = await HGMallVM.reviewAccess(); // 普通商家返回 false，不探测受限的审核列表。
      if (this.hgMounted)
        this.setState({ hgCanReview: hgAccess?.canReview === true });
    } catch {
      if (this.hgMounted) this.setState({ hgCanReview: false });
    }
  };

  /** 本人商品补图状态来自授权读接口，待审图片不参与公开目录 imageURLs。 */
  hgLoadOwnMedia = async (hgProductId) => {
    const hgSeq = ++this.hgOwnMediaSeq; // 本次查询身份，防止快速切换商品后旧照片覆盖新照片。
    this.setState({
      hgInspectMediaProductId: hgProductId,
      hgPendingOwnMedia: [],
      hgOwnMediaLoading: true,
    });
    try {
      const hgResult = await HGMallVM.ownPendingMedia(hgProductId);
      if (this.hgMounted && hgSeq === this.hgOwnMediaSeq)
        this.setState({
          hgPendingOwnMedia: Array.isArray(hgResult?.imageURLs)
            ? hgResult.imageURLs
            : [],
          hgError: "",
        });
    } catch (hgError) {
      if (this.hgMounted && hgSeq === this.hgOwnMediaSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && hgSeq === this.hgOwnMediaSeq)
        this.setState({ hgOwnMediaLoading: false });
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
    ++this.hgSellerSeq;
    ++this.hgMerchantSeq;
    ++this.hgReviewSeq;
    this.setState({ hgView, hgDetail: null, hgError: "", hgNotice: "" });
    if (hgView === "merchant") {
      this.hgLoadMerchant();
      this.hgLoadSellerOrders();
    }
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
      if (this.hgMounted && this.state.hgView === "merchant") {
        await this.hgLoadMerchant();
        await this.hgLoadSellerOrders();
      }
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

  hgPublish = (hgEvent) => {
    hgEvent.preventDefault();
    const hgDraft = this.state.hgDraft;
    const hgAmount = Number(hgDraft.amount);
    if (!Number.isSafeInteger(hgAmount) || hgAmount <= 0) {
      this.setState({ hgError: "请输入有效的正整数 M币价格" });
      return;
    }
    const hgStock =
      hgDraft.type === "MEMBERSHIP" ? 0 : Number(this.state.hgStock);
    if (
      hgDraft.type === "PHYSICAL_PRODUCT" &&
      (!Number.isSafeInteger(hgStock) || hgStock < 1 || hgStock > 100000)
    ) {
      this.setState({ hgError: "实物商品初始库存须为 1-100000 件" });
      return;
    }
    this.hgWrite(async () => {
      const hgImages = [...this.state.hgUploadedImages]; // 本次草稿已上传的 URL，按选择顺序提交。
      for (
        let hgIndex = hgImages.length;
        hgIndex < this.state.hgSelectedImages.length;
        hgIndex += 1
      ) {
        const hgResult = await HGMallVM.uploadImage(
          this.state.hgSelectedImages[hgIndex]
        );
        if (!hgResult?.imageURL) throw new Error("图片上传响应异常，请重试");
        hgImages.push(hgResult.imageURL);
        if (this.hgMounted)
          this.setState((hgState) => ({
            hgUploadedImages: [...hgImages],
            hgUnusedImages: [...hgState.hgUnusedImages, hgResult.imageURL],
          }));
      }
      await HGMallVM.publish({
        ...hgDraft,
        amount: hgAmount,
        stock: hgStock,
        imageURLs: hgImages,
      });
      if (this.hgMounted) {
        this.hgReleasePreviews(this.state.hgSelectedPreviews);
        this.setState({
          hgSelectedImages: [],
          hgSelectedPreviews: [],
          hgUploadedImages: [],
          hgDraft: {
            type: "PHYSICAL_PRODUCT",
            category: "digital",
            title: "",
            summary: "",
            description: "",
            skuTitle: "",
            amount: "",
          },
          hgStock: "",
        });
      }
    }, "商品草稿已提交审核，通过后进入目录");
  };

  /** 限制每个草稿的文件数、类型和大小；不把 blob URL 当作可发布的图片地址。 */
  hgChooseImages = (hgEvent) => {
    const hgFiles = Array.from(hgEvent.target.files || []);
    hgEvent.target.value = "";
    if (
      this.state.hgSelectedImages.length + hgFiles.length > 5 ||
      hgFiles.some(
        (hgFile) =>
          !["image/jpeg", "image/png", "image/webp"].includes(hgFile.type) ||
          hgFile.size < 1 ||
          hgFile.size > 5 * 1024 * 1024
      )
    ) {
      this.setState({
        hgError: "最多选择5张 JPG、PNG 或 WebP 图片，每张不超过5 MiB",
      });
      return;
    }
    if (this.state.hgUploadedImages.length) {
      this.setState({
        hgError: "部分图片已上传，请先提交当前草稿，失败时可直接重试",
      });
      return;
    }
    if (!hgFiles.length) return;
    const hgPreviews = hgFiles.map((hgFile) => URL.createObjectURL(hgFile)); // 浏览器本地预览，绝不作为接口 imageURLs 提交。
    this.setState((hgState) => ({
      hgSelectedImages: [...hgState.hgSelectedImages, ...hgFiles],
      hgSelectedPreviews: [...hgState.hgSelectedPreviews, ...hgPreviews],
      hgError: "",
    }));
  };

  /** 浏览器预览 URL 仅在本次选择期间有效；释放时不影响已经提交的服务端图片。 */
  hgReleasePreviews = (hgPreviews) =>
    hgPreviews.forEach((hgURL) => URL.revokeObjectURL(hgURL));

  /** 未开始上传时可逐张移除选择；上传成功的图片只能走服务端未使用图片清理。 */
  hgRemovePreview = (hgIndex, hgMedia = false) => {
    if (
      this.state.hgBusy ||
      (hgMedia
        ? this.state.hgMediaURLs.length
        : this.state.hgUploadedImages.length)
    )
      return;
    const hgFilesKey = hgMedia ? "hgMediaFiles" : "hgSelectedImages"; // 两组表单分别保存选择的 File。
    const hgPreviewsKey = hgMedia ? "hgMediaPreviews" : "hgSelectedPreviews"; // URL 与 File 索引严格一致。
    const hgURL = this.state[hgPreviewsKey][hgIndex]; // 要释放的单张预览；无效索引时为空。
    if (!hgURL) return;
    URL.revokeObjectURL(hgURL);
    this.setState((hgState) => ({
      [hgFilesKey]: hgState[hgFilesKey].filter(
        (_, hgPosition) => hgPosition !== hgIndex
      ),
      [hgPreviewsKey]: hgState[hgPreviewsKey].filter(
        (_, hgPosition) => hgPosition !== hgIndex
      ),
      hgError: "",
    }));
  };

  /** 仅清理本次草稿已上传且尚未发布的图片；每张由服务端按本人和未绑定状态再次核验。 */
  hgDiscardImages = async () => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      for (const hgURL of [...this.state.hgUploadedImages]) {
        await HGMallVM.deleteImage(hgURL);
        if (this.hgMounted)
          this.setState((hgState) => ({
            hgUploadedImages: hgState.hgUploadedImages.filter(
              (hgImage) => hgImage !== hgURL
            ),
            hgUnusedImages: hgState.hgUnusedImages.filter(
              (hgImage) => hgImage !== hgURL
            ),
          }));
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) {
        this.hgReleasePreviews(this.state.hgSelectedPreviews);
        this.setState({
          hgBusy: false,
          hgSelectedImages: [],
          hgSelectedPreviews: [],
          hgUploadedImages: [],
        });
      }
    }
  };

  hgRemoveUnusedImage = (hgURL) =>
    this.hgWrite(async () => {
      await HGMallVM.deleteImage(hgURL);
      if (this.hgMounted)
        this.setState((hgState) => ({
          hgUnusedImages: hgState.hgUnusedImages.filter(
            (hgImage) => hgImage !== hgURL
          ),
        }));
    }, "未发布图片已清除");

  /** 旧商品补图先上传至本人临时资产，再提交给审核员；批准前不修改公开目录。 */
  hgStageMedia = (hgEvent) => {
    hgEvent.preventDefault();
    const { hgMediaProductId, hgMediaFiles, hgMediaURLs } = this.state;
    if (!hgMediaProductId || !hgMediaFiles.length) {
      this.setState({ hgError: "请先选择商品与图片" });
      return;
    }
    this.hgWrite(async () => {
      const hgURLs = [...hgMediaURLs]; // 当前批次已成功上传的 URL；失败重试从下一张继续。
      for (
        let hgIndex = hgURLs.length;
        hgIndex < hgMediaFiles.length;
        hgIndex += 1
      ) {
        const hgResult = await HGMallVM.uploadImage(hgMediaFiles[hgIndex]);
        if (!hgResult?.imageURL) throw new Error("图片上传响应异常，请重试");
        hgURLs.push(hgResult.imageURL);
        if (this.hgMounted)
          this.setState((hgState) => ({
            hgMediaURLs: [...hgURLs],
            hgUnusedImages: [...hgState.hgUnusedImages, hgResult.imageURL],
          }));
      }
      await HGMallVM.stageMedia(hgMediaProductId, hgURLs);
      if (this.hgMounted) {
        this.hgReleasePreviews(this.state.hgMediaPreviews);
        this.setState({
          hgMediaProductId: "",
          hgMediaFiles: [],
          hgMediaPreviews: [],
          hgMediaURLs: [],
        });
        this.hgLoadOwnMedia(hgMediaProductId); // 提交成功后立即展示服务端待审照片，避免误以为上传丢失。
      }
    }, "补图已提交审核，通过后将在原商品目录和详情中展示");
  };

  /** 单选或多选均加入当前补图批次；超出商品总图数时只保留剩余名额并提示。 */
  hgChooseMedia = (hgEvent) => {
    const hgFiles = Array.from(hgEvent.target.files || []); // 本次选择的全部图片；重复选择可继续追加。
    hgEvent.target.value = "";
    const hgItem =
      this.state.hgMine.find(
        (hgProduct) => hgProduct.productId === this.state.hgMediaProductId
      ) ||
      (this.state.hgFoundProduct?.productId === this.state.hgMediaProductId
        ? this.state.hgFoundProduct
        : null);
    if (!hgFiles.length) return;
    if (hgFiles.some(
      (hgFile) =>
        !["image/jpeg", "image/png", "image/webp"].includes(hgFile.type) ||
        hgFile.size < 1 ||
        hgFile.size > 5 * 1024 * 1024
    )) {
      this.setState({
        hgError: "请选择1-5张 JPG、PNG 或 WebP 图片，每张不超过5 MiB",
      });
      return;
    }
    if (this.state.hgMediaURLs.length) {
      this.setState({ hgError: "图片已部分上传，请重试提交当前补图" });
      return;
    }
    const hgRemaining = Math.max(0, 5 - (hgItem?.imageURLs?.length || 0) - this.state.hgMediaFiles.length); // 已有公开图与待选图共同占用最多5张名额。
    if (!hgRemaining) {
      this.setState({ hgError: "商品图片已达5张上限，请移除待选图片后再选择" });
      return;
    }
    const hgAccepted = hgFiles.slice(0, hgRemaining); // 只保留可提交的图片，超额文件不创建预览也不上传。
    const hgPreviews = hgAccepted.map((hgFile) => URL.createObjectURL(hgFile)); // 仅预览，实际补图仍按文件上传并等待审核。
    this.setState((hgState) => ({
      hgMediaFiles: [...hgState.hgMediaFiles, ...hgAccepted],
      hgMediaPreviews: [...hgState.hgMediaPreviews, ...hgPreviews],
      hgError: hgFiles.length > hgAccepted.length
        ? `本次选中${hgFiles.length}张，仅加入前${hgAccepted.length}张；其余${hgFiles.length - hgAccepted.length}张超出商品总计5张的上限，未加入预览和提交`
        : "",
    }));
  };

  /** 切换或取消补图时释放旧预览；已有上传结果须先提交审核，不允许无意丢失重试状态。 */
  hgCloseMedia = () => {
    if (this.state.hgBusy || this.state.hgMediaURLs.length) return;
    this.hgReleasePreviews(this.state.hgMediaPreviews);
    this.setState({
      hgMediaProductId: "",
      hgMediaFiles: [],
      hgMediaPreviews: [],
    });
  };

  /** 明确放弃补图时逐张清理已上传的临时资产；清理失败的记录仍能在「未使用图片」手动处理。 */
  hgDiscardMedia = async () => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      for (const hgURL of [...this.state.hgMediaURLs]) {
        await HGMallVM.deleteImage(hgURL);
        if (this.hgMounted)
          this.setState((hgState) => ({
            hgUnusedImages: hgState.hgUnusedImages.filter(
              (hgItem) => hgItem !== hgURL
            ),
          }));
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) {
        this.hgReleasePreviews(this.state.hgMediaPreviews);
        this.setState({
          hgBusy: false,
          hgMediaProductId: "",
          hgMediaFiles: [],
          hgMediaPreviews: [],
          hgMediaURLs: [],
        });
      }
    }
  };

  hgChooseMediaProduct = (hgProductId) => {
    if (this.state.hgBusy || this.state.hgMediaURLs.length) return;
    this.hgReleasePreviews(this.state.hgMediaPreviews);
    this.setState({
      hgMediaProductId: hgProductId,
      hgMediaFiles: [],
      hgMediaPreviews: [],
      hgEditProductId: "",
    });
  };

  /** 两个发布表单共用缩略图预览，预览不等于已上传或已公开。 */
  renderImagePreviews(hgFiles, hgPreviews, hgMedia = false) {
    if (!hgFiles.length) return null;
    return (
      <div className={styles.draftPreviews} aria-label="已选择的商品图片预览">
        {hgFiles.map((hgFile, hgIndex) => (
          <figure className={styles.draftPreview} key={hgPreviews[hgIndex]}>
            <img src={hgPreviews[hgIndex]} alt={`${hgFile.name} 预览`} />
            <figcaption>{hgFile.name}</figcaption>
            <button
              type="button"
              disabled={
                this.state.hgBusy ||
                !!(hgMedia
                  ? this.state.hgMediaURLs.length
                  : this.state.hgUploadedImages.length)
              }
              onClick={() => this.hgRemovePreview(hgIndex, hgMedia)}
            >
              移除
            </button>
          </figure>
        ))}
      </div>
    );
  }

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
          "存在结果未知的购买请求，请先在「我的商品订单」中核对，再清除待确认请求"
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
      try {
        await HGMallVM.buy({ ...hgRequest, requestId: hgRequestId });
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
      if (this.hgMounted) {
        // 买家订单列表已迁入用户中心「我的商品订单」，这里只提示去那里支付。
        this.setState({
          hgPendingBuy: false,
          hgNotice:
            "订单已创建，商品库存预留15分钟；请在「账号设置 → 我的商品订单」中完成 M币支付",
          hgDetail: null,
          hgBuyForm: {
            quantity: "1",
            receiverName: "",
            receiverPhone: "",
            receiverAddress: "",
          },
        });
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  renderTabs() {
    return (
      <nav className={styles.categoryNav} aria-label="商城功能">
        {this.props.hgShowCatalogTab ? (
          <button
            type="button"
            aria-pressed={this.state.hgView === "catalog"}
            onClick={() => this.hgSelectView("catalog")}
          >
            全部商品
          </button>
        ) : (
          <Link to={ROUTE_PATH.PRODUCTS}>全部商品</Link>
        )}
        <button
          type="button"
          aria-pressed={this.state.hgView === "merchant"}
          onClick={() => this.hgSelectView("merchant")}
        >
          我的商品 · 管理
        </button>
        {this.state.hgCanReview && (
          <button
            type="button"
            aria-pressed={this.state.hgView === "review"}
            onClick={() => this.hgSelectView("review")}
          >
            商品与商家审核
          </button>
        )}
      </nav>
    );
  }

  renderCatalog() {
    const {
      hgCategory,
      hgItems,
      hgDetail,
      hgLoading,
      hgCursor,
      hgNext,
      hgHistory,
      hgHistoryBase,
    } = this.state;
    if (hgDetail)
      return (
        <article className={styles.detail}>
          <button
            type="button"
            className={styles.secondary}
            onClick={() => this.setState({ hgDetail: null })}
          >
            ← 返回商品目录
          </button>
          <div className={styles.detailGrid}>
            <div>
              {hgDetail.imageURLs?.length ? (
                <div className={styles.imageGallery}>
                  {hgDetail.imageURLs.map((hgURL, hgIndex) => (
                    <img
                      key={hgURL}
                      src={normalizeVideoCoverUrl(hgURL)}
                      alt={`${hgDetail.title} · 展示图 ${hgIndex + 1}`}
                      loading="lazy"
                    />
                  ))}
                </div>
              ) : (
                <div
                  className={styles.imagePlaceholder}
                  aria-label="商品暂未上传图片"
                >
                  {
                    hgCategories.find(
                      ([hgCode]) => hgCode === hgDetail.category
                    )?.[1]
                  }
                </div>
              )}
            </div>
            <div>
              <small>
                {hgDetail.shopName} ·{" "}
                {hgDetail.category === "membership" ? "会员" : "实物商品"}
              </small>
              <h2>{hgDetail.title}</h2>
              <strong className={styles.coinPrice}>
                {HGFormatCoin(hgDetail.amount)} M币
              </strong>
              <p>{hgDetail.summary}</p>
              <h3>商品介绍</h3>
              <p className={styles.description}>
                {hgDetail.description || hgDetail.summary}
              </p>
              <p>规格：{hgDetail.skuTitle}</p>
              {hgDetail.type === "PHYSICAL_PRODUCT" ? (
                <>
                  <p>可售库存：{hgDetail.available} 件 · 单笔最高 100000 M币</p>
                  <form className={styles.workspace} onSubmit={this.hgBuy}>
                    <label>
                      购买数量{" "}
                      <input
                        required
                        type="number"
                        min="1"
                        max="10"
                        step="1"
                        value={this.state.hgBuyForm.quantity}
                        onChange={(hgEvent) =>
                          this.hgUpdateBuy("quantity", hgEvent.target.value)
                        }
                      />
                    </label>
                    <label>
                      收件人{" "}
                      <input
                        required
                        maxLength={64}
                        value={this.state.hgBuyForm.receiverName}
                        onChange={(hgEvent) =>
                          this.hgUpdateBuy("receiverName", hgEvent.target.value)
                        }
                      />
                    </label>
                    <label>
                      手机号{" "}
                      <input
                        required
                        inputMode="tel"
                        maxLength={20}
                        value={this.state.hgBuyForm.receiverPhone}
                        onChange={(hgEvent) =>
                          this.hgUpdateBuy(
                            "receiverPhone",
                            hgEvent.target.value
                          )
                        }
                      />
                    </label>
                    <label>
                      详细收货地址{" "}
                      <textarea
                        required
                        maxLength={512}
                        value={this.state.hgBuyForm.receiverAddress}
                        onChange={(hgEvent) =>
                          this.hgUpdateBuy(
                            "receiverAddress",
                            hgEvent.target.value
                          )
                        }
                      />
                    </label>
                    <p className={styles.notice}>
                      商品标价含配送费；下单后预留库存15分钟，付款时才扣
                      M币。到期自动释放库存；已付款未发货可全额退款，运单由商家人工录入。
                    </p>
                    <button
                      type="submit"
                      disabled={
                        this.state.hgBusy ||
                        hgDetail.available < 1 ||
                        hgDetail.amount > 100000
                      }
                    >
                      创建待支付订单
                    </button>
                  </form>
                </>
              ) : (
                <p className={styles.notice}>
                  会员权益尚未接入，仅展示商品，暂不可购买。
                </p>
              )}
            </div>
          </div>
        </article>
      );
    return (
      <>
        <div
          className={styles.categoryNav}
          role="group"
          aria-label="筛选商品类目"
        >
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
        </div>
        {hgLoading && <p role="status">正在加载商品...</p>}
        {!hgLoading && !hgItems.length && <p>该类目暂无已审核商品。</p>}
        <div className={styles.productGrid}>
          {hgItems.map((hgItem) => (
            <article key={hgItem.productId} className={styles.product}>
              <div className={styles.productImage}>
                {hgItem.imageURLs?.length ? (
                  <img
                    src={normalizeVideoCoverUrl(hgItem.imageURLs[0])}
                    alt={`${hgItem.title} 展示图`}
                    loading="lazy"
                  />
                ) : (
                  hgCategories.find(
                    ([hgCode]) => hgCode === hgItem.category
                  )?.[1] || "商品"
                )}
              </div>
              <div className={styles.productBody}>
                <small>{hgItem.shopName}</small>
                <h3>{hgItem.title}</h3>
                <p>{hgItem.skuTitle}</p>
                <strong className={styles.coinPrice}>
                  {HGFormatCoin(hgItem.amount)} M币
                </strong>
                <small>
                  {hgItem.type === "MEMBERSHIP"
                    ? "会员仅展示"
                    : `可售 ${hgItem.available} 件`}
                </small>
                <button
                  type="button"
                  onClick={() => {
                    this.hgBuyRequestId = "";
                    this.hgShowDetail(hgItem.productId);
                  }}
                >
                  查看详情
                </button>
              </div>
            </article>
          ))}
        </div>
        <div className={styles.pager}>
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
          <span>
            第 {hgHistoryBase + hgHistory.length + 1} 页
            {hgHistoryBase > 0 && " · 仅可返回最近 64 页"}
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

  hgUpdateBuy = (hgKey, hgValue) => {
    this.hgBuyRequestId = "";
    this.setState((hgState) => ({
      hgBuyForm: { ...hgState.hgBuyForm, [hgKey]: hgValue },
    }));
  };

  /** 当前商家的有界商品管理列表与精确查询；已归档商品保留可核对的历史信息。 */
  renderMerchantProducts() {
    const {
      hgMine,
      hgMerchantQuery,
      hgFoundProduct,
      hgMerchantNext,
      hgMerchantHistory,
      hgMerchantCursor,
      hgMerchantLoading,
      hgBusy,
    } = this.state;
    const hgItems = hgFoundProduct ? [hgFoundProduct] : hgMine; // 已查询时只显示命中的本人商品，否则显示当前游标页。
    return (
      <section aria-label="我的商品管理">
        <h2>我的商品 · 管理</h2>
        <form onSubmit={this.hgFindMerchantProduct}>
          <label>
            按商品编号查找{" "}
            <input
              value={hgMerchantQuery}
              maxLength={64}
              placeholder="例如 PRD_..."
              onChange={(hgEvent) =>
                this.setState({ hgMerchantQuery: hgEvent.target.value })
              }
            />
          </label>
          <button type="submit" disabled={this.state.hgMerchantSearching}>
            查询
          </button>
          <button
            type="button"
            disabled={hgMerchantLoading}
            onClick={() =>
              this.setState({
                hgMerchantQuery: "",
                hgFoundProduct: null,
                hgError: "",
              })
            }
          >
            清除查询
          </button>
        </form>
        {hgMerchantLoading && <p role="status">正在加载本人商品...</p>}
        {!hgMerchantLoading && !hgItems.length && (
          <p>当前页暂无商品；可在下方发布新商品。</p>
        )}
        <div className={styles.manageGrid}>
          {hgItems.map((hgItem) => (
            <article className={styles.manageCard} key={hgItem.productId}>
              {hgItem.imageURLs?.length ? (
                <img
                  className={styles.manageCover}
                  src={normalizeVideoCoverUrl(hgItem.imageURLs[0])}
                  alt={`${hgItem.title} 展示图`}
                  loading="lazy"
                />
              ) : (
                <div className={styles.productImage}>暂无展示图</div>
              )}
              <div className={styles.manageBody}>
                <h3>{hgItem.title}</h3>
                <small>{hgItem.productId}</small>
                <p>{hgItem.summary}</p>
                <p>
                  {HGFormatCoin(hgItem.amount)} M币 ·{" "}
                  {hgItem.lifecycleStatus === 2
                    ? "已归档"
                    : hgItem.status === 1
                    ? "已上架"
                    : hgItem.status === 2
                    ? "审核未通过"
                    : "待审核"}{" "}
                  · {hgItem.imageURLs?.length || 0}/5 张图片
                </p>
                <div className={styles.manageActions}>
                  {hgItem.lifecycleStatus === 1 && hgItem.status === 1 && (
                    <>
                      <button
                        type="button"
                        disabled={hgBusy || !!this.state.hgMediaURLs.length}
                        onClick={() => {
                          this.hgCloseMedia();
                          this.setState({
                            hgEditProductId: hgItem.productId,
                            hgEditForm: {
                              title: hgItem.title,
                              summary: hgItem.summary,
                              description: hgItem.description || "",
                            },
                          });
                        }}
                      >
                        编辑资料
                      </button>
                      {(hgItem.imageURLs?.length || 0) < 5 && (
                        <button
                          type="button"
                          disabled={hgBusy || !!this.state.hgMediaURLs.length}
                          onClick={() =>
                            this.hgChooseMediaProduct(hgItem.productId)
                          }
                        >
                          增添图片
                        </button>
                      )}
                    </>
                  )}
                  {hgItem.lifecycleStatus === 1 && (
                    <button
                      type="button"
                      disabled={hgBusy}
                      onClick={() => this.hgLoadOwnMedia(hgItem.productId)}
                    >
                      查看待审图片
                    </button>
                  )}
                  {hgItem.lifecycleStatus !== 2 && (
                    <button
                      type="button"
                      disabled={hgBusy}
                      onClick={() => this.hgArchiveProduct(hgItem.productId)}
                    >
                      归档商品
                    </button>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
        {!!this.state.hgInspectMediaProductId && (
          <div className={styles.pendingMedia} role="status">
            <h3>商品 {this.state.hgInspectMediaProductId} 的待审图片</h3>
            {this.state.hgOwnMediaLoading ? (
              <p>正在读取补图审核状态...</p>
            ) : this.state.hgPendingOwnMedia.length ? (
              <>
                <p>
                  以下图片已上传，尚未审核公开；需由其他具备商城审核权限的管理员在「商品与商家审核」通过。
                </p>
                <div className={styles.draftPreviews}>
                  {this.state.hgPendingOwnMedia.map((hgURL, hgIndex) => (
                    <figure className={styles.draftPreview} key={hgURL}>
                      <img
                        src={normalizeVideoCoverUrl(hgURL)}
                        alt={`待审核补图 ${hgIndex + 1}`}
                      />
                      <figcaption>待审图片 {hgIndex + 1}</figcaption>
                    </figure>
                  ))}
                </div>
              </>
            ) : (
              <p>暂无待审补图；已公开图片显示在上方商品卡片和商品详情。</p>
            )}
          </div>
        )}
        {!hgFoundProduct && (
          <div className={styles.pager}>
            <button
              type="button"
              disabled={!hgMerchantHistory.length || hgMerchantLoading}
              onClick={() =>
                this.hgLoadMerchant(
                  hgMerchantHistory[hgMerchantHistory.length - 1],
                  hgMerchantHistory.slice(0, -1)
                )
              }
            >
              上一页
            </button>
            <button
              type="button"
              disabled={!hgMerchantNext || hgMerchantLoading}
              onClick={() =>
                this.hgLoadMerchant(
                  hgMerchantNext,
                  [...hgMerchantHistory, hgMerchantCursor].slice(-64)
                )
              }
            >
              下一页
            </button>
          </div>
        )}
        {!!this.state.hgEditProductId && (
          <form onSubmit={this.hgSubmitEdit}>
            <h3>编辑商品资料</h3>
            <p>审核通过前沿用当前资料；商品价格、库存和订单快照不会改变。</p>
            <label>
              商品名称{" "}
              <input
                required
                maxLength={128}
                value={this.state.hgEditForm.title}
                onChange={(hgEvent) =>
                  this.setState((hgState) => ({
                    hgEditForm: {
                      ...hgState.hgEditForm,
                      title: hgEvent.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              简介（纯文本）{" "}
              <textarea
                required
                maxLength={512}
                value={this.state.hgEditForm.summary}
                onChange={(hgEvent) =>
                  this.setState((hgState) => ({
                    hgEditForm: {
                      ...hgState.hgEditForm,
                      summary: hgEvent.target.value,
                    },
                  }))
                }
              />
            </label>
            <label>
              介绍（纯文本）{" "}
              <textarea
                maxLength={4096}
                value={this.state.hgEditForm.description}
                onChange={(hgEvent) =>
                  this.setState((hgState) => ({
                    hgEditForm: {
                      ...hgState.hgEditForm,
                      description: hgEvent.target.value,
                    },
                  }))
                }
              />
            </label>
            <div className={styles.manageActions}>
              <button type="submit" disabled={hgBusy}>
                提交修改审核
              </button>
              <button
                type="button"
                onClick={() => this.setState({ hgEditProductId: "" })}
              >
                取消
              </button>
            </div>
          </form>
        )}
        {!!this.state.hgMediaProductId && (
          <form onSubmit={this.hgStageMedia}>
            <h3>为商品增添图片</h3>
            <p>
              仅本人已上架商品可补图；审核期间原商品保持上架，图片审核通过后出现在目录和详情。
            </p>
            <label>
              选择图片（按住 Command/Ctrl 或 Shift 可多选；已选 {this.state.hgMediaFiles.length}{" "}
              张，总计最多5张）{" "}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                disabled={
                  hgBusy ||
                  !!this.state.hgMediaURLs.length ||
                  this.state.hgMediaFiles.length >= 5
                }
                onChange={this.hgChooseMedia}
              />
            </label>
            {this.renderImagePreviews(
              this.state.hgMediaFiles,
              this.state.hgMediaPreviews,
              true
            )}
            <div className={styles.manageActions}>
              <button
                type="submit"
                disabled={hgBusy || !this.state.hgMediaFiles.length}
              >
                提交补图审核
              </button>
              <button
                type="button"
                disabled={hgBusy}
                onClick={
                  this.state.hgMediaURLs.length
                    ? this.hgDiscardMedia
                    : this.hgCloseMedia
                }
              >
                取消并清理
              </button>
            </div>
          </form>
        )}
      </section>
    );
  }

  renderMerchant() {
    const { hgMerchant, hgShopName, hgDraft, hgBusy } = this.state;
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
        </section>
        {hgMerchant?.status === 1 && this.renderMerchantProducts()}
        {hgMerchant?.status === 1 && (
          <section>
            <h2>新增商品</h2>
            <p>
              发布后等待审核；实物商品使用
              M币购买并占用库存，由商家手工发货；会员仅展示，不发放权益。
            </p>
            <form className={styles.draftForm} onSubmit={this.hgPublish}>
              <label>
                类型{" "}
                <select
                  value={hgDraft.type}
                  onChange={(hgEvent) =>
                    this.setState({
                      hgDraft: {
                        ...hgDraft,
                        type: hgEvent.target.value,
                        category:
                          hgEvent.target.value === "MEMBERSHIP"
                            ? "membership"
                            : "digital",
                      },
                    })
                  }
                >
                  <option value="PHYSICAL_PRODUCT">实物商品</option>
                  <option value="MEMBERSHIP">会员卡</option>
                </select>
              </label>
              <label>
                类目{" "}
                <select
                  value={hgDraft.category}
                  onChange={(hgEvent) =>
                    this.setState({
                      hgDraft: { ...hgDraft, category: hgEvent.target.value },
                    })
                  }
                >
                  {hgCategories
                    .filter(
                      ([hgCode]) =>
                        hgCode &&
                        (hgDraft.type === "MEMBERSHIP"
                          ? hgCode === "membership"
                          : hgCode !== "membership")
                    )
                    .map(([hgCode, hgLabel]) => (
                      <option key={hgCode} value={hgCode}>
                        {hgLabel}
                      </option>
                    ))}
                </select>
              </label>
              <label>
                商品名称{" "}
                <input
                  required
                  maxLength={128}
                  value={hgDraft.title}
                  onChange={(hgEvent) =>
                    this.setState({
                      hgDraft: { ...hgDraft, title: hgEvent.target.value },
                    })
                  }
                />
              </label>
              <label>
                简介（纯文本）{" "}
                <textarea
                  required
                  maxLength={512}
                  value={hgDraft.summary}
                  onChange={(hgEvent) =>
                    this.setState({
                      hgDraft: { ...hgDraft, summary: hgEvent.target.value },
                    })
                  }
                />
              </label>
              <label>
                商品介绍（纯文本）{" "}
                <textarea
                  maxLength={4096}
                  value={hgDraft.description}
                  onChange={(hgEvent) =>
                    this.setState({
                      hgDraft: {
                        ...hgDraft,
                        description: hgEvent.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                展示图片（已选 {this.state.hgSelectedImages.length}{" "}
                张，最多5张，每张不超过5 MiB）{" "}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  disabled={
                    hgBusy ||
                    !!this.state.hgUploadedImages.length ||
                    this.state.hgSelectedImages.length >= 5
                  }
                  onChange={this.hgChooseImages}
                />
              </label>
              {this.renderImagePreviews(
                this.state.hgSelectedImages,
                this.state.hgSelectedPreviews
              )}
              {!!this.state.hgUploadedImages.length && (
                <button
                  type="button"
                  disabled={hgBusy}
                  onClick={this.hgDiscardImages}
                >
                  清除已上传的图片
                </button>
              )}
              <label>
                规格{" "}
                <input
                  required
                  maxLength={128}
                  value={hgDraft.skuTitle}
                  onChange={(hgEvent) =>
                    this.setState({
                      hgDraft: { ...hgDraft, skuTitle: hgEvent.target.value },
                    })
                  }
                />
              </label>
              <label>
                价格（整数 M币；实物不超过100000）{" "}
                <input
                  required
                  type="number"
                  min="1"
                  max={
                    hgDraft.type === "PHYSICAL_PRODUCT"
                      ? "100000"
                      : "9007199254740991"
                  }
                  step="1"
                  value={hgDraft.amount}
                  onChange={(hgEvent) =>
                    this.setState({
                      hgDraft: { ...hgDraft, amount: hgEvent.target.value },
                    })
                  }
                />
              </label>
              {hgDraft.type === "PHYSICAL_PRODUCT" && (
                <label>
                  初始可售库存（件）{" "}
                  <input
                    required
                    type="number"
                    min="1"
                    max="100000"
                    step="1"
                    value={this.state.hgStock}
                    onChange={(hgEvent) =>
                      this.setState({ hgStock: hgEvent.target.value })
                    }
                  />
                </label>
              )}
              <button type="submit" disabled={hgBusy}>
                提交商品审核
              </button>
            </form>
            {!!this.state.hgUnusedImages.length && (
              <div>
                <h3>未使用图片</h3>
                <p>最多保留20张；离开页面后可在此清理未绑定商品的图片。</p>
                {this.state.hgUnusedImages.map((hgURL) => (
                  <span key={hgURL} className={styles.unusedImage}>
                    <img
                      src={normalizeVideoCoverUrl(hgURL)}
                      alt="未使用的商品图片"
                      loading="lazy"
                    />
                    <button
                      type="button"
                      disabled={
                        hgBusy ||
                        this.state.hgUploadedImages.includes(hgURL) ||
                        this.state.hgMediaURLs.includes(hgURL)
                      }
                      onClick={() => this.hgRemoveUnusedImage(hgURL)}
                    >
                      删除
                    </button>
                  </span>
                ))}
              </div>
            )}
          </section>
        )}
        {hgMerchant?.status === 1 && this.renderSellerOrders()}
      </div>
    );
  }

  /** 本店订单、收件信息和人工运单只来自服务端商家授权列表；买家订单由用户中心面板展示。 */
  renderSellerOrders() {
    const hgItems = this.state.hgSellerOrders;
    const hgNext = this.state.hgSellerNext;
    return (
      <section className={styles.section} aria-label="本店实物订单">
        <h2>本店实物订单与发货</h2>
        {hgItems.map((hgOrder) => (
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
              to={`${ROUTE_PATH.MALL_ORDER_DETAIL.replace(
                ":orderId",
                encodeURIComponent(hgOrder.orderId)
              )}?merchant=1`}
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
              <form
                className={styles.workspace}
                onSubmit={(hgEvent) => {
                  hgEvent.preventDefault();
                  this.hgWrite(
                    () =>
                      HGMallVM.ship(
                        hgOrder.orderId,
                        this.state.hgShipping.carrier.trim(),
                        this.state.hgShipping.trackingNumber.trim()
                      ),
                    "运单已登记，请等待买家确认收货"
                  );
                }}
              >
                <label>
                  承运商{" "}
                  <input
                    required
                    maxLength={64}
                    value={
                      this.state.hgShipping.orderId === hgOrder.orderId
                        ? this.state.hgShipping.carrier
                        : ""
                    }
                    onChange={(hgEvent) =>
                      this.setState({
                        hgShipping: {
                          orderId: hgOrder.orderId,
                          carrier: hgEvent.target.value,
                          trackingNumber:
                            this.state.hgShipping.orderId === hgOrder.orderId
                              ? this.state.hgShipping.trackingNumber
                              : "",
                        },
                      })
                    }
                  />
                </label>
                <label>
                  运单号{" "}
                  <input
                    required
                    maxLength={128}
                    value={
                      this.state.hgShipping.orderId === hgOrder.orderId
                        ? this.state.hgShipping.trackingNumber
                        : ""
                    }
                    onChange={(hgEvent) =>
                      this.setState({
                        hgShipping: {
                          orderId: hgOrder.orderId,
                          carrier:
                            this.state.hgShipping.orderId === hgOrder.orderId
                              ? this.state.hgShipping.carrier
                              : "",
                          trackingNumber: hgEvent.target.value,
                        },
                      })
                    }
                  />
                </label>
                <button type="submit" disabled={this.state.hgBusy}>
                  确认发货
                </button>
              </form>
            )}
          </article>
        ))}
        <div className={styles.pager}>
          <button
            type="button"
            disabled={!this.state.hgSellerCursor || this.state.hgBusy}
            onClick={() => this.hgLoadSellerOrders()}
          >
            回到最新订单
          </button>
          <button
            type="button"
            disabled={!hgNext || this.state.hgBusy}
            onClick={() => this.hgLoadSellerOrders(hgNext)}
          >
            下一页订单
          </button>
        </div>
      </section>
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
    return (
      <section className={styles.section} aria-label="商城商品与商家工作台">
        {this.renderTabs()}
        {this.state.hgError && (
          <p role="alert" className={styles.error}>
            {this.state.hgError}{" "}
            <button
              type="button"
              onClick={() => this.hgSelectView(this.state.hgView)}
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
        {this.state.hgView === "catalog"
          ? this.renderCatalog()
          : this.state.hgView === "merchant"
          ? this.renderMerchant()
          : this.renderReview()}
      </section>
    );
  }
}

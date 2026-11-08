import React from "react";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import { hgCentToYuan, hgYuanToCent } from "./hg_commerce_amount.js";
import HGCommerceVM from "./hg_commerce_vm.js";
import { hgSecureRequestId } from "./hg_mall_security.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_merchant_center.module.css";

// 空白表单；所属类目必须由服务端返回，不能本地预置可销售白名单。
const hgEmptyDraft = () => ({
  categoryId: "",
  title: "",
  subtitle: "",
  description: "",
  imageURLs: [],
  skus: [{ skuCode: "", specs: "", price: "", stock: "" }],
});

/** 商家生产 CNY 商品工作台；审核前草稿与旧 M币商品互不复用。 */
export default class HGMerchantCommercePage extends React.Component {
  state = {
    hgMerchant: null, // 已批准商家快照；null 表示无商家资格或尚未读取。
    hgCategories: [], // 服务端启用且无需经营资质的叶子类目，默认空。
    hgProducts: [], // 本人当前最多20件商品的游标页，不做深分页。
    hgNext: "", // 本人商品下一页游标；空表示结束。
    hgQuery: "", // 精确商品编号查询输入；空表示浏览列表。
    hgFound: null, // 唯一编号命中商品；null 表示使用游标列表。
    hgDraft: hgEmptyDraft(), // 当前可续编草稿字段，金额文本以人民币元输入。
    hgEditing: "", // 当前编辑的商品业务 ID；空表示创建新草稿。
    hgVersion: 0, // 服务端乐观锁版本；0表示尚未创建商品。
    hgFiles: [], // 本次选中的本地图片，不保存到存储或页面 URL 中。
    hgPreviews: [], // 与文件同序的 blob 预览地址，完成或卸载时释放。
    hgUploaded: [], // 本次已上传成功的 URL，失败重试跳过同一批次的已上传项。
    hgUnused: [], // 本人未绑定商品的图片，最多20张。
    hgPendingCreate: null, // 网络结果未知时冻结首次创建正文和幂等键，只允许原样重试。
    hgCanReview: false, // 现有商城审核权限接口结果；无权限不请求审核数据。
    hgPending: [], // 管理员当前待审页，非审核员始终为空。
    hgPendingNext: "", // 管理员审核队列下一页游标。
    hgReviewDetail: null, // 当前选中的待审版本全量资料；null 表示尚未打开详情。
    hgReason: "", // 拒绝商品时的必要纯文本原因；空字符串不可用于驳回。
    hgCategoryName: "", // 管理员创建普通类目时的名称；空表示未填写。
    hgCategoryParent: "", // 管理员创建类目的上级 ID；空表示一级。
    hgLoading: true, // 首次加载请求期间展示等待反馈。
    hgBusy: false, // 写操作同步门闩对应的视图禁用状态。
    hgError: "", // 最近一次失败提示，空表示没有错误。
    hgNotice: "", // 最近一次成功提示，空表示没有提示。
  };

  hgMounted = false; // 页面卸载后拒绝过期请求更新状态。
  hgFlight = false; // 写操作同步门闩，避免 React 异步 setState 导致重复提交。
  hgSeq = 0; // 列表与按编号精确查询的请求序号，后发起的查询优先。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoad();
  }
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgSeq += 1;
    this.hgRelease();
  }

  hgRelease = () =>
    this.state.hgPreviews.forEach((hgURL) => URL.revokeObjectURL(hgURL));

  /** 本店可经营类目与审核权分别来自服务端；审核员不必同时是商家。 */
  hgLoad = async () => {
    try {
      const [hgMerchant, hgAccess] = await Promise.all([
        HGMallVM.merchant(),
        HGMallVM.reviewAccess(),
      ]);
      if (!this.hgMounted) return;
      const hgCanReview = Boolean(hgAccess?.canReview); // 仅控制界面展示，所有请求仍由服务端授权。
      this.setState({ hgMerchant, hgCanReview });
      const hgTasks = [];
      if (hgMerchant?.status === 1) hgTasks.push(this.hgReloadMerchant());
      if (hgCanReview) hgTasks.push(this.hgLoadPending());
      await Promise.all(hgTasks);
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "人民币商品加载失败" });
    } finally {
      if (this.hgMounted) this.setState({ hgLoading: false });
    }
  };

  hgReloadMerchant = async () => {
    // Go 空切片会序列化为 null；所有列表字段在边界处兜底为空集合，渲染层不再判空。
    const [hgCategoryList, hgPage, hgUnused] = await Promise.all([
      HGCommerceVM.categories(),
      HGCommerceVM.mine(),
      HGCommerceVM.unusedImages(),
    ]);
    if (this.hgMounted)
      this.setState({
        hgCategories: hgCategoryList || [],
        hgProducts: hgPage?.list || [],
        hgNext: hgPage?.hasMore ? hgPage.nextCursor : "",
        hgUnused: hgUnused?.imageURLs || [],
      });
  };

  hgLoadMine = async (hgCursor = "") => {
    const hgSeq = ++this.hgSeq;
    try {
      const hgPage = await HGCommerceVM.mine(hgCursor);
      if (this.hgMounted && hgSeq === this.hgSeq)
        this.setState({
          hgProducts: hgPage?.list || [],
          hgNext: hgPage?.hasMore ? hgPage.nextCursor : "",
          hgError: "",
        });
    } catch (hgError) {
      if (this.hgMounted && hgSeq === this.hgSeq)
        this.setState({ hgError: hgError.message });
    }
  };

  hgLoadPending = async (hgCursor = "") => {
    try {
      const hgPage = await HGCommerceVM.pending(hgCursor);
      if (this.hgMounted)
        this.setState({
          hgPending: hgPage?.list || [],
          hgPendingNext: hgPage?.hasMore ? hgPage.nextCursor : "",
          hgReviewDetail: null,
        });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: hgError.message });
    }
  };

  /** 写操作失败仍保留本地草稿和已上传媒体供安全重试。 */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgFlight) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await hgAction();
      if (this.hgMounted) this.setState({ hgNotice: hgSuccess });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "操作失败，请重试" });
    } finally {
      this.hgFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  hgUpdateDraft = (hgKey, hgValue) =>
    this.setState((hgState) => ({
      hgDraft: { ...hgState.hgDraft, [hgKey]: hgValue },
    }));

  /** 每行规格按「维度:值,维度:值」输入，最多三维；服务端再验唯一性和笛卡尔积。 */
  hgParseSpecs = (hgText) => {
    if (!hgText.trim()) return {};
    const hgSpecs = {}; // 一行 SKU 的规范化键值；重复维度由此处拒绝。
    for (const hgPart of hgText.split(",")) {
      const hgPair = hgPart.split(":").map((hgValue) => hgValue.trim()); // 每个维度仅允许一个分隔冒号。
      if (hgPair.length !== 2 || !hgPair[0] || !hgPair[1] || hgSpecs[hgPair[0]])
        throw new Error("规格填写格式为 颜色:黑色,容量:256GB，维度不能重复");
      hgSpecs[hgPair[0]] = hgPair[1];
    }
    if (Object.keys(hgSpecs).length > 3)
      throw new Error("最多设置三个规格维度");
    return hgSpecs;
  };

  /** 金额和库存只接受明确有界的文本；后端依旧以分和库存范围做最终校验。 */
  hgPayload = (hgImageURLs) => {
    const hgDraft = this.state.hgDraft; // 当前商家表单，不是后端权威商品快照。
    if (!hgDraft.categoryId || !hgDraft.title.trim() || !hgImageURLs.length)
      throw new Error("请选择类目、填写标题并上传至少一张图片");
    return {
      categoryId: hgDraft.categoryId,
      productType: "PHYSICAL",
      title: hgDraft.title.trim(),
      subtitle: hgDraft.subtitle.trim(),
      description: hgDraft.description.trim(),
      imageURLs: hgImageURLs,
      skus: hgDraft.skus.map((hgSKU) => {
        if (!/^(?:0|[1-9]\d{0,5})$/.test(hgSKU.stock))
          throw new Error("库存须为0-100000件整数");
        return {
          skuCode: hgSKU.skuCode.trim(),
          specs: this.hgParseSpecs(hgSKU.specs),
          priceCent: hgYuanToCent(hgSKU.price),
          initialStock: Number(hgSKU.stock),
        };
      }),
      ...(this.state.hgEditing
        ? { expectedVersion: this.state.hgVersion }
        : {}),
    };
  };

  /** 本地校验文件数量、类型与大小；上传成功后不允许变更当前批次次序。 */
  hgChooseImages = (hgEvent) => {
    const hgFiles = Array.from(hgEvent.target.files || []); // 当前选择的文件，可能来自多选。
    hgEvent.target.value = "";
    if (this.state.hgUploaded.length || this.state.hgPendingCreate) {
      this.setState({
        hgError: "当前草稿已部分上传或等待创建结果，请先完成重试",
      });
      return;
    }
    if (
      this.state.hgDraft.imageURLs.length +
        this.state.hgFiles.length +
        hgFiles.length >
        20 ||
      hgFiles.some(
        (hgFile) =>
          !["image/jpeg", "image/png", "image/webp", "image/avif"].includes(
            hgFile.type
          ) ||
          hgFile.size < 1 ||
          hgFile.size > 5 << 20
      )
    ) {
      this.setState({
        hgError: "最多20张 JPG/PNG/WebP/AVIF 图片，每张不超过5 MiB",
      });
      return;
    }
    const hgPreviews = hgFiles.map((hgFile) => URL.createObjectURL(hgFile)); // blob URL 仅本机预览。
    this.setState((hgState) => ({
      hgFiles: [...hgState.hgFiles, ...hgFiles],
      hgPreviews: [...hgState.hgPreviews, ...hgPreviews],
      hgError: "",
    }));
  };

  /** 未上传本地图片可移除并释放预览地址；上传中的批次禁止重排以保持续传对应关系。 */
  hgRemoveLocalImage = (hgIndex) => {
    if (
      this.state.hgBusy ||
      this.state.hgUploaded.length ||
      this.state.hgPendingCreate
    )
      return;
    URL.revokeObjectURL(this.state.hgPreviews[hgIndex]);
    this.setState((hgState) => ({
      hgFiles: hgState.hgFiles.filter((_, hgOffset) => hgOffset !== hgIndex),
      hgPreviews: hgState.hgPreviews.filter(
        (_, hgOffset) => hgOffset !== hgIndex
      ),
    }));
  };

  /** 提交之前依次上传；创建失败冻结原请求正文/幂等键，防止修改后重试创建第二件商品。 */
  hgSave = async (hgEvent) => {
    hgEvent.preventDefault();
    await this.hgWrite(async () => {
      let hgPending = this.state.hgPendingCreate; // 尚未确认是否成功创建的原始请求。
      if (!hgPending) {
        // 先验证金额、规格和必填项，避免无效表单也占用对象存储及媒体额度。
        this.hgPayload([
          ...this.state.hgDraft.imageURLs,
          ...this.state.hgFiles.map((_, hgIndex) => `local-image-${hgIndex}`),
        ]);
        const hgURLs = [...this.state.hgUploaded]; // 已上传图片按文件顺序续传。
        for (
          let hgIndex = hgURLs.length;
          hgIndex < this.state.hgFiles.length;
          hgIndex += 1
        ) {
          const hgResult = await HGCommerceVM.uploadImage(
            this.state.hgFiles[hgIndex]
          );
          if (!hgResult?.imageURL) throw new Error("图片上传响应异常");
          hgURLs.push(hgResult.imageURL);
          if (this.hgMounted) this.setState({ hgUploaded: [...hgURLs] });
        }
        const hgPayload = this.hgPayload([
          ...this.state.hgDraft.imageURLs,
          ...hgURLs,
        ]); // 已绑定旧图与新图，同款最多20张。
        hgPending = {
          body: hgPayload,
          requestId: this.state.hgEditing ? "" : hgSecureRequestId(),
        }; // 编辑使用版本锁，创建使用稳定幂等键。
        if (!this.state.hgEditing && this.hgMounted)
          this.setState({ hgPendingCreate: hgPending });
      }
      const hgProduct = this.state.hgEditing
        ? await HGCommerceVM.edit(this.state.hgEditing, hgPending.body)
        : await HGCommerceVM.create(hgPending.body, hgPending.requestId);
      if (!hgProduct?.productId)
        throw new Error(
          "草稿响应缺少商品编号，请按同一请求重试或先查询本人商品"
        );
      if (this.hgMounted) {
        this.hgRelease();
        this.setState({
          hgDraft: hgEmptyDraft(),
          hgEditing: "",
          hgVersion: 0,
          hgFiles: [],
          hgPreviews: [],
          hgUploaded: [],
          hgPendingCreate: null,
        });
        await this.hgReloadMerchant();
      }
    }, "草稿已保存；请在商品卡片中提交审核");
  };

  /** 本人已有草稿从授权详情恢复；切换前不能遗失结果未知的创建请求。 */
  hgEdit = async (hgProductId) => {
    if (this.state.hgPendingCreate || this.state.hgBusy) return;
    await this.hgWrite(async () => {
      const hgItem = await HGCommerceVM.mineDetail(hgProductId);
      if (this.hgMounted) {
        this.hgRelease();
        this.setState({
          hgEditing: hgProductId,
          hgVersion: hgItem.version,
          hgFiles: [],
          hgPreviews: [],
          hgUploaded: [],
          hgDraft: {
            categoryId: hgItem.categoryId,
            title: hgItem.title,
            subtitle: hgItem.subtitle,
            description: hgItem.description,
            imageURLs: hgItem.imageURLs || [],
            // 详情缺省 SKU 时以单行空规格兜底，避免空数据渲染崩溃。
            skus: (hgItem.skus || []).map((hgSKU) => ({
              skuCode: hgSKU.skuCode,
              specs: Object.entries(hgSKU.specs || {})
                .map(([hgKey, hgValue]) => `${hgKey}:${hgValue}`)
                .join(","),
              price: (hgSKU.priceCent / 100).toFixed(2),
              stock: String(hgSKU.initialStock),
            })),
          },
        });
      }
    }, "已读取草稿，请编辑后保存");
  };

  hgFind = async (hgEvent) => {
    hgEvent.preventDefault();
    const hgID = this.state.hgQuery.trim();
    const hgSeq = ++this.hgSeq; // 清空输入时丢弃已发起的旧查询。
    if (!hgID) {
      this.setState({ hgFound: null });
      return;
    }
    try {
      const hgFound = await HGCommerceVM.mineDetail(hgID);
      if (this.hgMounted && hgSeq === this.hgSeq)
        this.setState({ hgFound, hgError: "" });
    } catch (hgError) {
      if (this.hgMounted && hgSeq === this.hgSeq)
        this.setState({ hgFound: null, hgError: hgError.message });
    }
  };

  /** 写操作都携带当前版本；成功后刷新，重复提交由后端状态机拒绝。 */
  hgTransition = (hgItem, hgAction) =>
    this.hgWrite(async () => {
      await HGCommerceVM[hgAction](hgItem.productId, hgItem.version);
      await this.hgLoadMine();
      if (this.state.hgFound?.productId === hgItem.productId)
        this.setState({
          hgFound: await HGCommerceVM.mineDetail(hgItem.productId),
        });
    }, "状态已更新，请查看最新审核与销售状态");

  /** 归档不可恢复，明确二次确认；历史审核版本和已绑定图片由服务端保留。 */
  hgArchive = (hgItem) => {
    if (
      !window.confirm(
        `确定永久归档 ${hgItem.title}？归档后不可恢复，历史审核资料仍保留。`
      )
    )
      return;
    this.hgTransition(hgItem, "archive");
  };

  hgReview = (hgItem, hgApprove) =>
    this.hgWrite(async () => {
      if (
        this.state.hgReviewDetail?.productId !== hgItem.productId ||
        this.state.hgReviewDetail.version !== hgItem.version
      )
        throw new Error("请先打开当前版本的完整审核资料");
      await HGCommerceVM.review(
        hgItem.productId,
        hgApprove,
        hgApprove ? "" : this.state.hgReason.trim()
      );
      await this.hgLoadPending();
      if (this.hgMounted) this.setState({ hgReason: "" });
    }, "审核结果已保存");

  hgCreateCategory = (hgEvent) => {
    hgEvent.preventDefault();
    this.hgWrite(async () => {
      await HGCommerceVM.createCategory({
        name: this.state.hgCategoryName.trim(),
        parentId: this.state.hgCategoryParent.trim(),
        regulated: false,
      });
      if (this.hgMounted)
        this.setState({ hgCategoryName: "", hgCategoryParent: "" });
      if (this.state.hgMerchant?.status === 1) await this.hgReloadMerchant();
    }, "类目已创建；只有普通叶子类目可供发布");
  };

  hgDeleteImage = (hgURL) =>
    this.hgWrite(async () => {
      await HGCommerceVM.deleteImage(hgURL);
      if (this.hgMounted)
        this.setState((hgState) => ({
          hgUnused: hgState.hgUnused.filter((hgItem) => hgItem !== hgURL),
        }));
    }, "未绑定图片已清理");

  /** 审核员先读取待审版本完整资料，审批期间不展示过期详情。 */
  hgOpenReview = (hgItem) =>
    this.hgWrite(async () => {
      const hgDetail = await HGCommerceVM.pendingDetail(hgItem.productId); // 待审版本，非公开版本。
      if (hgDetail.version !== hgItem.version)
        throw new Error("待审版本已更新，请刷新列表后再审核");
      if (this.hgMounted)
        this.setState({ hgReviewDetail: hgDetail, hgReason: "" });
    }, "请核对完整资料后作出审核决定");

  renderCard(hgItem) {
    const hgLabel =
      hgItem.saleStatus === "ON_SHELF"
        ? "已上架"
        : {
            DRAFT: "草稿",
            PENDING: "待审",
            APPROVED: "已通过",
            REJECTED: "已驳回",
          }[hgItem.auditStatus] || "已下架"; // 展示审核与销售状态，不以客户端控制权限。
    const hgBadge =
      hgItem.saleStatus === "ON_SHELF"
        ? styles.badgeOn
        : hgItem.auditStatus === "REJECTED"
        ? styles.badgeRejected
        : styles.badgePending; // 视觉提示不代替服务端授权。
    return (
      <article className={styles.card} key={hgItem.productId}>
        {hgItem.imageURLs?.length ? (
          <img
            className={styles.cover}
            src={normalizeVideoCoverUrl(hgItem.imageURLs[0])}
            alt={`${hgItem.title} 主图`}
            loading="lazy"
          />
        ) : (
          <div className={styles.coverEmpty}>待上传商品图片</div>
        )}
        <div className={styles.body}>
          <h3>{hgItem.title}</h3>
          <span className={styles.productNo}>{hgItem.productId}</span>
          <div className={styles.metaRow}>
            <span className={`${styles.badge} ${hgBadge}`}>{hgLabel}</span>
            <span className={styles.price}>
              {hgCentToYuan(hgItem.minPriceCent)}
            </span>
            <span className={styles.imageCount}>
              {hgItem.imageURLs?.length || 0} 张图片
            </span>
          </div>
          <div className={styles.actions}>
            {hgItem.auditStatus !== "PENDING" &&
              hgItem.saleStatus !== "DELETED" && (
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={this.state.hgBusy || !!this.state.hgPendingCreate}
                  onClick={() => this.hgEdit(hgItem.productId)}
                >
                  编辑草稿
                </button>
              )}
            {hgItem.auditStatus === "DRAFT" && (
              <button
                type="button"
                className={styles.btn}
                disabled={this.state.hgBusy}
                onClick={() => this.hgTransition(hgItem, "submit")}
              >
                提交审核
              </button>
            )}
            {hgItem.auditStatus === "REJECTED" && (
              <span className={styles.fieldHint}>
                请编辑草稿生成新版本后再提交
              </span>
            )}
            {hgItem.auditStatus === "APPROVED" &&
              hgItem.saleStatus === "OFF_SHELF" && (
                <button
                  type="button"
                  className={styles.btn}
                  disabled={this.state.hgBusy}
                  onClick={() => this.hgTransition(hgItem, "publish")}
                >
                  确认上架
                </button>
              )}
            {hgItem.saleStatus === "ON_SHELF" && (
              <button
                type="button"
                className={styles.btnGhost}
                disabled={this.state.hgBusy}
                onClick={() => this.hgTransition(hgItem, "unpublish")}
              >
                下架
              </button>
            )}
            {hgItem.saleStatus !== "DELETED" &&
              hgItem.auditStatus !== "PENDING" && (
                <button
                  type="button"
                  className={styles.btnDanger}
                  disabled={this.state.hgBusy || !!this.state.hgPendingCreate}
                  onClick={() => this.hgArchive(hgItem)}
                >
                  永久归档
                </button>
              )}
          </div>
        </div>
      </article>
    );
  }

  /** 草稿基本信息；类目仅展示服务端返回的可经营叶子类目。 */
  renderDraftDetails() {
    const { hgDraft, hgCategories } = this.state; // 当前输入与服务端允许选择的类目，空列表表示暂无可选类目。
    return (
      <>
        <div className={styles.field}>
          <label htmlFor="commerce-category">经营类目</label>
          <select
            id="commerce-category"
            required
            value={hgDraft.categoryId}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("categoryId", hgEvent.target.value)
            }
          >
            <option value="">请选择已启用叶子类目</option>
            {hgCategories.map((hgCategory) => (
              <option
                key={hgCategory.categoryId}
                value={hgCategory.categoryId}
              >
                {hgCategory.name}
              </option>
            ))}
          </select>
        </div>
        {!hgCategories.length && !hgDraft.categoryId && (
          <p className={styles.fieldHint}>
            暂无可经营的普通叶子类目，请联系管理员创建或启用类目后再保存草稿。
          </p>
        )}
        <div className={styles.field}>
          <label htmlFor="commerce-title">商品名称</label>
          <input
            id="commerce-title"
            required
            maxLength={120}
            value={hgDraft.title}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("title", hgEvent.target.value)
            }
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="commerce-subtitle">副标题</label>
          <input
            id="commerce-subtitle"
            maxLength={200}
            value={hgDraft.subtitle}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("subtitle", hgEvent.target.value)
            }
          />
        </div>
        <div className={styles.field}>
          <label htmlFor="commerce-description">纯文本介绍</label>
          <textarea
            id="commerce-description"
            maxLength={4096}
            value={hgDraft.description}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("description", hgEvent.target.value)
            }
          />
        </div>
      </>
    );
  }

  /** 已绑定图片与本地预览分开展示；未上传前可移除本地图片。 */
  renderDraftImages() {
    const { hgDraft, hgPreviews, hgUploaded } = this.state; // 图片 URL、预览及已上传项均属于当前草稿批次。
    return (
      <>
        <div className={styles.field}>
          <label htmlFor="commerce-images">
            展示图片（1-20张，首图为主图）
          </label>
          <input
            id="commerce-images"
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/avif"
            onChange={this.hgChooseImages}
          />
        </div>
        <div className={styles.imgGrid}>
          {hgDraft.imageURLs.map((hgURL) => (
            <div key={hgURL} className={styles.imgItem}>
              <img src={normalizeVideoCoverUrl(hgURL)} alt="已绑定商品图片" />
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() =>
                  this.hgUpdateDraft(
                    "imageURLs",
                    hgDraft.imageURLs.filter((hgImage) => hgImage !== hgURL)
                  )
                }
              >
                不用于新版
              </button>
            </div>
          ))}
          {hgPreviews.map((hgURL, hgIndex) => (
            <div key={hgURL} className={styles.imgItem}>
              <img src={hgURL} alt="本地图片预览" />
              <button
                type="button"
                className={styles.btnGhost}
                disabled={!!hgUploaded.length}
                onClick={() => this.hgRemoveLocalImage(hgIndex)}
              >
                移除此图
              </button>
            </div>
          ))}
        </div>
      </>
    );
  }

  /** 单行 SKU 保留原有输入顺序和最多 200 款的限制。 */
  renderDraftSkus() {
    const { hgDraft, hgEditing } = this.state; // SKU 输入来自当前草稿；编辑 ID 用于区分创建与编辑的列表键。
    return (
      <>
        <h3 className={styles.subTitle}>销售规格（最多200款）</h3>
        {hgDraft.skus.map((hgSKU, hgIndex) => (
          <div
            className={styles.commerceSku}
            key={`${hgEditing || "new"}-${hgIndex}`}
          >
            <label>
              编码
              <input
                required
                maxLength={64}
                value={hgSKU.skuCode}
                onChange={(hgEvent) =>
                  this.hgSku(hgIndex, "skuCode", hgEvent.target.value)
                }
              />
            </label>
            <label>
              规格（例：颜色:黑色,容量:256GB）
              <input
                value={hgSKU.specs}
                onChange={(hgEvent) =>
                  this.hgSku(hgIndex, "specs", hgEvent.target.value)
                }
              />
            </label>
            <label>
              单买价（元）
              <input
                required
                inputMode="decimal"
                value={hgSKU.price}
                onChange={(hgEvent) =>
                  this.hgSku(hgIndex, "price", hgEvent.target.value)
                }
              />
            </label>
            <label>
              初始库存（件）
              <input
                required
                inputMode="numeric"
                value={hgSKU.stock}
                onChange={(hgEvent) =>
                  this.hgSku(hgIndex, "stock", hgEvent.target.value)
                }
              />
            </label>
            {hgDraft.skus.length > 1 && (
              <button
                type="button"
                className={styles.btnGhost}
                onClick={() =>
                  this.hgUpdateDraft(
                    "skus",
                    hgDraft.skus.filter((_, hgOffset) => hgOffset !== hgIndex)
                  )
                }
              >
                移除规格
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          className={styles.btnGhost}
          disabled={hgDraft.skus.length >= 200}
          onClick={() =>
            this.hgUpdateDraft("skus", [
              ...hgDraft.skus,
              { skuCode: "", specs: "", price: "", stock: "" },
            ])
          }
        >
          添加规格
        </button>
      </>
    );
  }

  /** 保存与重置保持在 fieldset 外，结果未知时允许重试原创建请求。 */
  renderDraftActions() {
    const { hgBusy, hgPendingCreate, hgUploaded } = this.state; // 写入中禁用操作；待确认请求只允许原样重试。
    return (
      <>
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={hgBusy}>
            {hgPendingCreate ? "重试同一次创建" : "保存草稿"}
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            disabled={hgBusy || !!hgPendingCreate || !!hgUploaded.length}
            onClick={() => {
              this.hgRelease();
              this.setState({
                hgEditing: "",
                hgVersion: 0,
                hgDraft: hgEmptyDraft(),
                hgFiles: [],
                hgPreviews: [],
                hgUploaded: [],
              });
            }}
          >
            重置表单
          </button>
        </div>
        {hgPendingCreate && (
          <p className={styles.formHint}>
            创建结果未知，表单已冻结；请用同一请求重试，不要重复创建。
          </p>
        )}
      </>
    );
  }

  /** 草稿表单组装；冻结待确认的创建正文，但不阻断同一请求的重试。 */
  renderDraft() {
    const { hgBusy, hgPendingCreate } = this.state; // fieldset 禁用期间不允许修改请求正文。
    return (
      <form className={styles.publishForm} onSubmit={this.hgSave}>
        <fieldset
          className={styles.commerceFieldset}
          disabled={hgBusy || !!hgPendingCreate}
        >
          <legend>
            {this.state.hgEditing ? "编辑待审版本" : "创建人民币商品草稿"}
          </legend>
          <p className={styles.fieldHint}>
            本期仅开放普通实物商品，人民币商品尚不能下单支付；不会影响 M币商品。
          </p>
          {this.renderDraftDetails()}
          {this.renderDraftImages()}
          {this.renderDraftSkus()}
        </fieldset>
        {this.renderDraftActions()}
      </form>
    );
  }

  hgSku = (hgIndex, hgKey, hgValue) =>
    this.setState((hgState) => ({
      hgDraft: {
        ...hgState.hgDraft,
        skus: hgState.hgDraft.skus.map((hgItem, hgOffset) =>
          hgOffset === hgIndex ? { ...hgItem, [hgKey]: hgValue } : hgItem
        ),
      },
    }));

  renderAdmin() {
    if (!this.state.hgCanReview) return null;
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <h3>平台审核 · 人民币商品</h3>
        </div>
        <div className={styles.sectionBody}>
          <form className={styles.actions} onSubmit={this.hgCreateCategory}>
            <input
              aria-label="新类目名称"
              required
              maxLength={64}
              placeholder="新普通类目名称"
              value={this.state.hgCategoryName}
              onChange={(hgEvent) =>
                this.setState({ hgCategoryName: hgEvent.target.value })
              }
            />
            <input
              aria-label="上级类目 ID"
              placeholder="上级 ID，一级留空"
              value={this.state.hgCategoryParent}
              onChange={(hgEvent) =>
                this.setState({ hgCategoryParent: hgEvent.target.value })
              }
            />
            <button
              type="submit"
              className={styles.btnGhost}
              disabled={this.state.hgBusy}
            >
              添加普通类目
            </button>
          </form>
          {this.state.hgPending.length ? (
            this.state.hgPending.map((hgItem) => (
              <div key={hgItem.productId} className={styles.pendingPanel}>
                <strong>
                  {hgItem.title} · {hgItem.productId} ·{" "}
                  {hgCentToYuan(hgItem.minPriceCent)}
                </strong>
                <button
                  type="button"
                  className={styles.btnGhost}
                  disabled={this.state.hgBusy}
                  onClick={() => this.hgOpenReview(hgItem)}
                >
                  查看完整待审资料
                </button>
                {this.state.hgReviewDetail?.productId === hgItem.productId &&
                  this.state.hgReviewDetail.version === hgItem.version && (
                    <div className={styles.commerceReviewDetail}>
                      <p>
                        商家：{hgItem.merchantId} · 类目：
                        {this.state.hgReviewDetail.categoryId}
                      </p>
                      <h4>{this.state.hgReviewDetail.title}</h4>
                      <p>{this.state.hgReviewDetail.subtitle}</p>
                      <p className={styles.commerceDescription}>
                        {this.state.hgReviewDetail.description}
                      </p>
                      <div className={styles.imgGrid}>
                        {(this.state.hgReviewDetail.imageURLs || []).map((hgURL) => (
                          <img
                            key={hgURL}
                            className={styles.editThumb}
                            src={normalizeVideoCoverUrl(hgURL)}
                            alt="待审商品展示图"
                          />
                        ))}
                      </div>
                      <ul>
                        {(this.state.hgReviewDetail.skus || []).map((hgSKU) => (
                          <li key={hgSKU.skuId}>
                            {hgSKU.skuCode} ·{" "}
                            {Object.entries(hgSKU.specs || {})
                              .map(([hgKey, hgValue]) => `${hgKey}：${hgValue}`)
                              .join("、") || "默认规格"}{" "}
                            · {hgCentToYuan(hgSKU.priceCent)} · 库存建议{" "}
                            {hgSKU.initialStock} 件
                          </li>
                        ))}
                      </ul>
                      <label>
                        驳回原因
                        <input
                          maxLength={256}
                          value={this.state.hgReason}
                          onChange={(hgEvent) =>
                            this.setState({ hgReason: hgEvent.target.value })
                          }
                        />
                      </label>
                      <div className={styles.actions}>
                        <button
                          type="button"
                          className={styles.btn}
                          disabled={this.state.hgBusy}
                          onClick={() => this.hgReview(hgItem, true)}
                        >
                          审核通过
                        </button>
                        <button
                          type="button"
                          className={styles.btnDanger}
                          disabled={
                            this.state.hgBusy || !this.state.hgReason.trim()
                          }
                          onClick={() => this.hgReview(hgItem, false)}
                        >
                          驳回
                        </button>
                      </div>
                    </div>
                  )}
              </div>
            ))
          ) : (
            <p className={styles.empty}>当前暂无待审商品</p>
          )}
          {this.state.hgPendingNext && (
            <button
              type="button"
              className={styles.btnGhost}
              onClick={() => this.hgLoadPending(this.state.hgPendingNext)}
            >
              下一页待审商品
            </button>
          )}
        </div>
      </section>
    );
  }

  render() {
    const {
      hgMerchant,
      hgLoading,
      hgError,
      hgNotice,
      hgProducts,
      hgFound,
      hgUnused,
    } = this.state;
    return (
      <main className={styles.page} aria-label="生产人民币商品工作台">
        {hgError && (
          <p role="alert" className={styles.errorBar}>
            {hgError}
          </p>
        )}
        {hgNotice && (
          <p role="status" className={styles.noticeBar}>
            {hgNotice}
          </p>
        )}
        <section className={styles.panel}>
          <div className={styles.head}>
            <h2>人民币商品 · 发布与管理</h2>
            {hgMerchant?.shopName && (
              <span className={styles.headSmall}>{hgMerchant.shopName}</span>
            )}
          </div>
          <p className={styles.desc}>
            与 M币商品及 debug
            模拟商城独立；目前只支持普通实物商品的草稿、审核和展示。尚未开放人民币下单或付款。
          </p>
          {hgLoading ? (
            <p role="status" className={styles.loading}>
              正在加载商家商品...
            </p>
          ) : hgMerchant?.status === 1 ? (
            <>
              <form className={styles.toolbar} onSubmit={this.hgFind}>
                <input
                  aria-label="按商品编号精确查询"
                  placeholder="按商品编号精确查询"
                  value={this.state.hgQuery}
                  onChange={(hgEvent) => {
                    this.hgSeq += 1;
                    this.setState({
                      hgQuery: hgEvent.target.value,
                      hgFound: null,
                    });
                  }}
                />
                <button type="submit" className={styles.btnGhost}>
                  查询
                </button>
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => {
                    this.hgSeq += 1;
                    this.setState({ hgQuery: "", hgFound: null });
                  }}
                >
                  清除
                </button>
              </form>
              <div className={styles.grid}>
                {(hgFound ? [hgFound] : hgProducts).map((hgItem) =>
                  this.renderCard(hgItem)
                )}
              </div>
              {!hgFound && this.state.hgNext && (
                <button
                  type="button"
                  className={styles.btnGhost}
                  onClick={() => this.hgLoadMine(this.state.hgNext)}
                >
                  下一页商品
                </button>
              )}
              {!hgFound && !hgProducts.length && (
                <div className={styles.empty}>
                  <strong>暂时没有人民币商品</strong>
                  <span>可在下方保存第一份草稿并提交审核。</span>
                </div>
              )}
              {this.renderDraft()}
              {!!hgUnused.length && (
                <section className={styles.sectionCard}>
                  <div className={styles.sectionHead}>
                    <h3>未使用图片 · {hgUnused.length}/20</h3>
                  </div>
                  <div className={styles.sectionBody}>
                    <div className={styles.imgGrid}>
                      {hgUnused.map((hgURL) => (
                        <div key={hgURL} className={styles.imgItem}>
                          <img
                            src={normalizeVideoCoverUrl(hgURL)}
                            alt="未绑定商品图片"
                            loading="lazy"
                          />
                          <button
                            type="button"
                            className={styles.btnGhost}
                            disabled={
                              this.state.hgBusy ||
                              this.state.hgUploaded.includes(hgURL)
                            }
                            onClick={() => this.hgDeleteImage(hgURL)}
                          >
                            清理
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className={styles.empty}>
              完成商家入驻审批后可发布人民币商品；管理员可在下方审核。
            </div>
          )}
        </section>
        {this.renderAdmin()}
      </main>
    );
  }
}

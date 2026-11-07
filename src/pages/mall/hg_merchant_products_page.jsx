/*
 * @Description: 个人中心「商家中心 → 我的商品」页面：本店商品列表、资料修改、补图与归档。
 */
import React from "react";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import { HGFormatCoin } from "./hg_mall_amount.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_merchant_center.module.css";

/**
 * 我的商品管理页。
 * 职责：读取本人有界商品列表与按编号精确查找，提交资料修改、补图与归档申请。
 * 约束：组合模式（商家工作台）注入 hgMerchant 快照；独立挂载时自行读取商家状态，
 *       未获批商家只展示入驻引导，不发起商品列表请求。
 */
export default class HGMerchantProductsPage extends React.Component {
  state = {
    hgMerchant: this.props.hgMerchant || null, // 组合模式复用父级商家快照；独立模式自行加载。
    hgStatusLoading: !this.props.hgMerchant, // 独立模式读取商家状态期间展示占位。
    hgMine: [], // 当前游标页本人商品，默认空。
    hgCursor: "", // 当前请求游标；空字符串代表第一页。
    hgHistory: [], // 最近最多 64 页旧游标，用于上一页。
    hgNext: "", // 下一页游标；空字符串表示结束。
    hgQuery: "", // 按商品业务 ID 精确查找的输入值；空时展示本人列表。
    hgSearching: false, // 单件商品查找请求状态，防止重复提交。
    hgFoundProduct: null, // 查找命中结果；null 表示没有进行有效查找。
    hgLoading: false, // 列表读取中；尚未获取时不显示空态。
    hgEditProductId: "", // 当前编辑文字信息的已上架商品 ID；空为未编辑。
    hgEditForm: { title: "", summary: "", description: "" }, // 待审文字资料副本；不覆盖公开商品。
    hgMediaProductId: "", // 当前准备补图的本人已上架商品 ID；空表示未选择商品。
    hgMediaFiles: [], // 当前补图选中的文件，最多5张；仅保存在页面内。
    hgMediaPreviews: [], // 补图的本地 blob URL，与 hgMediaFiles 同序；不作为发布地址。
    hgMediaURLs: [], // 当前补图已上传的 URL；失败重试时避免重复上传。
    hgInspectMediaProductId: "", // 当前查看补图审核状态的本人商品 ID；空表示未选中。
    hgPendingOwnMedia: [], // 本商品待审核图片，最多5张；不可当作已公开目录图片。
    hgOwnMediaLoading: false, // 本人补图审核状态读取中；初始没有查询。
    hgBusy: false, // 写操作门闩状态，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgMineSeq = 0; // 列表请求序号；快速翻页只接受最后一次响应。
  hgOwnMediaSeq = 0; // 补图状态请求序号；切换商品后忽略旧响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。

  componentDidMount() {
    this.hgMounted = true;
    if (this.props.hgMerchant) {
      this.hgLoadMine();
      return;
    }
    this.hgLoadMerchantStatus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgReleasePreviews(this.state.hgMediaPreviews);
    this.hgMineSeq += 1;
    this.hgOwnMediaSeq += 1;
  }

  hgMessage = (hgError) => hgError?.message || "请求失败，请重试";

  /** 独立挂载时自读商家状态；未获批时不请求商品列表，仅展示入驻引导。 */
  hgLoadMerchantStatus = async () => {
    try {
      const hgMerchant = await HGMallVM.merchant();
      if (!this.hgMounted) return;
      this.setState({ hgMerchant });
      if (hgMerchant?.status === 1) this.hgLoadMine();
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted) this.setState({ hgStatusLoading: false });
    }
  };

  /** 仅加载单个有界游标页；快速翻页时旧响应不可覆盖新结果。 */
  hgLoadMine = async (hgCursor = "", hgHistory = []) => {
    const hgSeq = ++this.hgMineSeq;
    this.setState({ hgLoading: true });
    try {
      const hgMine = await HGMallVM.mine(hgCursor);
      if (!this.hgMounted || this.hgMineSeq !== hgSeq) return;
      this.setState({
        hgMine: hgMine.list,
        hgCursor,
        hgHistory,
        hgNext: hgMine.hasMore ? hgMine.nextCursor : "",
        hgError: "",
      });
    } catch (hgError) {
      if (this.hgMounted && this.hgMineSeq === hgSeq)
        this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted && this.hgMineSeq === hgSeq)
        this.setState({ hgLoading: false });
    }
  };

  /** 商品 ID 唯一索引精确查本人记录，避免深分页遍历或无索引标题模糊查询。 */
  hgFindProduct = async (hgEvent) => {
    hgEvent?.preventDefault();
    const hgProductId = this.state.hgQuery.trim();
    if (!hgProductId) {
      this.setState({ hgFoundProduct: null, hgError: "" });
      return;
    }
    if (this.state.hgSearching) return;
    this.setState({ hgSearching: true, hgError: "", hgFoundProduct: null });
    try {
      const hgItem = await HGMallVM.mineDetail(hgProductId);
      if (this.hgMounted) this.setState({ hgFoundProduct: hgItem });
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted) this.setState({ hgSearching: false });
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

  /** 写操作门闩：归档、资料修改与补图提交共用；成功后刷新当前游标页。 */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await hgAction();
      if (this.hgMounted) this.setState({ hgNotice: hgSuccess });
      if (this.hgMounted)
        await this.hgLoadMine(this.state.hgCursor, this.state.hgHistory);
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
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
          this.setState({ hgMediaURLs: [...hgURLs] });
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
    if (
      hgFiles.some(
        (hgFile) =>
          !["image/jpeg", "image/png", "image/webp"].includes(hgFile.type) ||
          hgFile.size < 1 ||
          hgFile.size > 5 * 1024 * 1024
      )
    ) {
      this.setState({
        hgError: "请选择1-5张 JPG、PNG 或 WebP 图片，每张不超过5 MiB",
      });
      return;
    }
    if (this.state.hgMediaURLs.length) {
      this.setState({ hgError: "图片已部分上传，请重试提交当前补图" });
      return;
    }
    const hgRemaining = Math.max(
      0,
      5 - (hgItem?.imageURLs?.length || 0) - this.state.hgMediaFiles.length
    ); // 已有公开图与待选图共同占用最多5张名额。
    if (!hgRemaining) {
      this.setState({ hgError: "商品图片已达5张上限，请移除待选图片后再选择" });
      return;
    }
    const hgAccepted = hgFiles.slice(0, hgRemaining); // 只保留可提交的图片，超额文件不创建预览也不上传。
    const hgPreviews = hgAccepted.map((hgFile) => URL.createObjectURL(hgFile)); // 仅预览，实际补图仍按文件上传并等待审核。
    this.setState((hgState) => ({
      hgMediaFiles: [...hgState.hgMediaFiles, ...hgAccepted],
      hgMediaPreviews: [...hgState.hgMediaPreviews, ...hgPreviews],
      hgError:
        hgFiles.length > hgAccepted.length
          ? `本次选中${hgFiles.length}张，仅加入前${hgAccepted.length}张；其余${
              hgFiles.length - hgAccepted.length
            }张超出商品总计5张的上限，未加入预览和提交`
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

  /** 明确放弃补图时逐张清理已上传的临时资产；清理失败的记录可在「新增商品」的未使用图片中手动处理。 */
  hgDiscardMedia = async () => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      for (const hgURL of [...this.state.hgMediaURLs]) {
        await HGMallVM.deleteImage(hgURL);
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

  /** 浏览器预览 URL 仅在本次选择期间有效；释放时不影响已经提交的服务端图片。 */
  hgReleasePreviews = (hgPreviews) =>
    hgPreviews.forEach((hgURL) => URL.revokeObjectURL(hgURL));

  /** 未开始上传时可逐张移除选择；上传成功的图片只能放弃整批补图时清理。 */
  hgRemovePreview = (hgIndex) => {
    if (this.state.hgBusy || this.state.hgMediaURLs.length) return;
    const hgURL = this.state.hgMediaPreviews[hgIndex]; // 要释放的单张预览；无效索引时为空。
    if (!hgURL) return;
    URL.revokeObjectURL(hgURL);
    this.setState((hgState) => ({
      hgMediaFiles: hgState.hgMediaFiles.filter(
        (_, hgPosition) => hgPosition !== hgIndex
      ),
      hgMediaPreviews: hgState.hgMediaPreviews.filter(
        (_, hgPosition) => hgPosition !== hgIndex
      ),
      hgError: "",
    }));
  };

  /** 商品状态徽标：生命周期优先于上架状态，已归档商品仍可核对历史信息。 */
  hgStatusBadge(hgItem) {
    if (hgItem.lifecycleStatus === 2)
      return { label: "已归档", className: styles.badgeArchived };
    if (hgItem.status === 1)
      return { label: "已上架", className: styles.badgeOn };
    if (hgItem.status === 2)
      return { label: "审核未通过", className: styles.badgeRejected };
    return { label: "待审核", className: styles.badgePending };
  }

  /** 顶部工具条：精确查找本人商品，清除查询后恢复当前游标页列表。 */
  renderToolbar() {
    const { hgQuery, hgSearching, hgLoading, hgFoundProduct } = this.state;
    return (
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <span className={styles.searchIcon}>⌕</span>
          <input
            value={hgQuery}
            maxLength={64}
            placeholder="按商品编号查找，例如 PRD_..."
            aria-label="按商品编号查找"
            onChange={(hgEvent) =>
              this.setState({ hgQuery: hgEvent.target.value })
            }
          />
        </div>
        <button type="submit" className={styles.btn} disabled={hgSearching}>
          查询
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={hgLoading}
          onClick={() =>
            this.setState({ hgQuery: "", hgFoundProduct: null, hgError: "" })
          }
        >
          清除查询
        </button>
        {hgFoundProduct && (
          <span className={styles.headSmall}>当前仅展示命中结果</span>
        )}
      </div>
    );
  }

  /** 单件商品卡片：封面、状态徽标、价格与受限操作入口。 */
  renderProductCard(hgItem) {
    const hgBadge = this.hgStatusBadge(hgItem);
    const { hgBusy } = this.state;
    return (
      <article className={styles.card} key={hgItem.productId}>
        {hgItem.imageURLs?.length ? (
          <img
            className={styles.cover}
            src={normalizeVideoCoverUrl(hgItem.imageURLs[0])}
            alt={`${hgItem.title} 展示图`}
            loading="lazy"
          />
        ) : (
          <div className={styles.coverEmpty}>暂无展示图</div>
        )}
        <div className={styles.body}>
          <h3>{hgItem.title}</h3>
          <span className={styles.productNo}>{hgItem.productId}</span>
          <p className={styles.summary}>{hgItem.summary}</p>
          <div className={styles.metaRow}>
            <span className={`${styles.badge} ${hgBadge.className}`}>
              {hgBadge.label}
            </span>
            <span className={styles.price}>
              {HGFormatCoin(hgItem.amount)}
              <small className={styles.coin}> M币</small>
            </span>
            <span className={styles.imageCount}>
              {hgItem.imageURLs?.length || 0}/5 张图片
            </span>
          </div>
          <div className={styles.actions}>
            {hgItem.lifecycleStatus === 1 && hgItem.status === 1 && (
              <>
                <button
                  type="button"
                  className={`${styles.btnGhost} ${styles.btnSmall}`}
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
                    className={`${styles.btnGhost} ${styles.btnSmall}`}
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
                className={`${styles.btnGhost} ${styles.btnSmall}`}
                disabled={hgBusy}
                onClick={() => this.hgLoadOwnMedia(hgItem.productId)}
              >
                查看待审图片
              </button>
            )}
            {hgItem.lifecycleStatus !== 2 && (
              <button
                type="button"
                className={`${styles.btnDanger} ${styles.btnSmall}`}
                disabled={hgBusy}
                onClick={() => this.hgArchiveProduct(hgItem.productId)}
              >
                归档商品
              </button>
            )}
          </div>
        </div>
      </article>
    );
  }

  /** 商品列表与操作按钮共用缩略图预览，预览不等于已上传或已公开。 */
  renderImagePreviews(hgFiles, hgPreviews, hgRemoveDisabled = false) {
    if (!hgFiles.length) return null;
    return (
      <div className={styles.imgGrid} aria-label="已选择的商品图片预览">
        {hgFiles.map((hgFile, hgIndex) => (
          <figure className={styles.imgItem} key={hgPreviews[hgIndex]}>
            <img src={hgPreviews[hgIndex]} alt={`${hgFile.name} 预览`} />
            <figcaption>{hgFile.name}</figcaption>
            <button
              type="button"
              className={`${styles.btnGhost} ${styles.btnSmall}`}
              disabled={this.state.hgBusy || hgRemoveDisabled}
              onClick={() => this.hgRemovePreview(hgIndex)}
            >
              移除
            </button>
          </figure>
        ))}
      </div>
    );
  }

  /** 本人商品补图审核状态面板：待审图片不属于公开目录。 */
  renderPendingMediaPanel() {
    if (!this.state.hgInspectMediaProductId) return null;
    return (
      <div className={styles.pendingPanel} role="status">
        <h3>商品 {this.state.hgInspectMediaProductId} 的待审图片</h3>
        {this.state.hgOwnMediaLoading ? (
          <p>正在读取补图审核状态...</p>
        ) : this.state.hgPendingOwnMedia.length ? (
          <>
            <p>
              以下图片已上传，尚未审核公开；需由其他具备商城审核权限的管理员在「运维管理
              &gt; 商城 &gt; 已上架商品补图审核」中处理。
            </p>
            <div className={styles.imgGrid}>
              {this.state.hgPendingOwnMedia.map((hgURL, hgIndex) => (
                <figure className={styles.imgItem} key={hgURL}>
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
    );
  }

  renderPager() {
    const { hgHistory, hgCursor, hgNext, hgLoading } = this.state;
    return (
      <div className={styles.pager}>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={!hgHistory.length || hgLoading}
          onClick={() =>
            this.hgLoadMine(
              hgHistory[hgHistory.length - 1],
              hgHistory.slice(0, -1)
            )
          }
        >
          上一页
        </button>
        <button
          type="button"
          className={styles.btnGhost}
          disabled={!hgNext || hgLoading}
          onClick={() =>
            this.hgLoadMine(hgNext, [...hgHistory, hgCursor].slice(-64))
          }
        >
          下一页
        </button>
      </div>
    );
  }

  /** 编辑资料表单：文字变更走审核，不影响价格、库存和订单快照。 */
  renderEditForm() {
    if (!this.state.hgEditProductId) return null;
    const { hgBusy, hgEditForm } = this.state;
    return (
      <form className={styles.form} onSubmit={this.hgSubmitEdit}>
        <h3 className={styles.subTitle}>编辑商品资料</h3>
        <p className={styles.formHint}>
          审核通过前沿用当前资料；商品价格、库存和订单快照不会改变。
        </p>
        <label>
          商品名称
          <input
            required
            maxLength={128}
            value={hgEditForm.title}
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
          简介（纯文本）
          <textarea
            required
            maxLength={512}
            value={hgEditForm.summary}
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
          介绍（纯文本）
          <textarea
            maxLength={4096}
            value={hgEditForm.description}
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
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={hgBusy}>
            提交修改审核
          </button>
          <button
            type="button"
            className={styles.btnGhost}
            onClick={() => this.setState({ hgEditProductId: "" })}
          >
            取消
          </button>
        </div>
      </form>
    );
  }

  /** 补图表单：仅本人已上架商品可补图；审核期间原商品保持上架。 */
  renderMediaForm() {
    if (!this.state.hgMediaProductId) return null;
    const { hgBusy, hgMediaFiles } = this.state;
    return (
      <form className={styles.form} onSubmit={this.hgStageMedia}>
        <h3 className={styles.subTitle}>为商品增添图片</h3>
        <p className={styles.formHint}>
          仅本人已上架商品可补图；审核期间原商品保持上架，图片审核通过后出现在目录和详情。
        </p>
        <label>
          选择图片（按住 Command/Ctrl 或 Shift 可多选；已选 {hgMediaFiles.length}{" "}
          张，总计最多5张）
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            disabled={
              hgBusy ||
              !!this.state.hgMediaURLs.length ||
              hgMediaFiles.length >= 5
            }
            onChange={this.hgChooseMedia}
          />
        </label>
        {this.renderImagePreviews(
          hgMediaFiles,
          this.state.hgMediaPreviews,
          !!this.state.hgMediaURLs.length
        )}
        <div className={styles.actions}>
          <button type="submit" className={styles.btn} disabled={hgBusy || !hgMediaFiles.length}>
            提交补图审核
          </button>
          <button
            type="button"
            className={styles.btnGhost}
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
    );
  }

  render() {
    const {
      hgMerchant,
      hgStatusLoading,
      hgLoading,
      hgFoundProduct,
      hgMine,
      hgError,
      hgNotice,
    } = this.state;
    const hgItems = hgFoundProduct ? [hgFoundProduct] : hgMine; // 已查询时只显示命中的本人商品，否则显示当前游标页。
    return (
      <div className={styles.page}>
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
        <section className={styles.panel} aria-label="我的商品管理">
          <div className={styles.head}>
            <h2>我的商品 · 管理</h2>
            {hgMerchant?.shopName && (
              <span className={styles.headSmall}>
                店铺：{hgMerchant.shopName}
              </span>
            )}
          </div>
          <p className={styles.desc}>
            管理本人已上架与待审核商品；资料修改与补图需审核，通过前原内容继续展示。
          </p>
          {hgStatusLoading ? (
            <p role="status" className={styles.loading}>
              正在读取商家状态...
            </p>
          ) : hgMerchant?.status === 1 ? (
            <>
              <form onSubmit={this.hgFindProduct}>
                {this.renderToolbar()}
              </form>
              {hgLoading && (
                <p role="status" className={styles.loading}>
                  正在加载本人商品...
                </p>
              )}
              {!hgLoading && !hgItems.length && (
                <div className={styles.empty}>
                  <strong>当前页暂无商品</strong>
                  <span>可前往「新增商品」发布第一个商品。</span>
                </div>
              )}
              <div className={styles.grid}>
                {hgItems.map((hgItem) => this.renderProductCard(hgItem))}
              </div>
              {this.renderPendingMediaPanel()}
              {!hgFoundProduct && this.renderPager()}
              {this.renderEditForm()}
              {this.renderMediaForm()}
            </>
          ) : (
            <div className={styles.empty}>
              <strong>尚未开通商家权限</strong>
              <span>完成「商家入驻申请」并通过审核后，即可在这里管理商品。</span>
            </div>
          )}
        </section>
      </div>
    );
  }
}

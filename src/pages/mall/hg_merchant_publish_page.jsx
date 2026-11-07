/*
 * @Description: 个人中心「商家中心 → 新增商品」页面：发布草稿、图片上传与未使用图片清理。
 */
import React from "react";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import { HG_MALL_CATEGORIES } from "./hg_mall_categories.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_merchant_center.module.css";

const hgDraftCategories = HG_MALL_CATEGORIES.filter(([hgCode]) => hgCode); // 发布表单不含「全部商品」占位类目。

/**
 * 新增商品页。
 * 职责：维护商品草稿与展示图片，提交发布审核，并清理未绑定商品的图片额度。
 * 约束：组合模式（商家工作台）注入 hgMerchant 快照；独立挂载时自行读取商家状态，
 *       未获批商家只展示入驻引导，不加载未使用图片。
 */
export default class HGMerchantPublishPage extends React.Component {
  state = {
    hgMerchant: this.props.hgMerchant || null, // 组合模式复用父级商家快照；独立模式自行加载。
    hgStatusLoading: !this.props.hgMerchant, // 独立模式读取商家状态期间展示占位。
    hgDraft: {
      type: "PHYSICAL_PRODUCT",
      category: "digital",
      title: "",
      summary: "",
      description: "",
      skuTitle: "",
      amount: "",
    }, // 商品草稿；介绍为纯文本，金额为整币文本。
    hgStock: "", // 新发布实物商品初始库存文本；会员不填，服务端校验 1-100000。
    hgSelectedImages: [], // 待上传的最多5张本地图片；只保留 File 于当前页面，不持久化。
    hgSelectedPreviews: [], // 新商品图片本地 blob URL，与 hgSelectedImages 同序；移除、发布或卸载时释放。
    hgUploadedImages: [], // 本次草稿已成功上传的图片 URL，失败重试不重复上传。
    hgUnusedImages: [], // 本人历史上传但未发布的有界图片列表，可手动清除释放限额。
    hgBusy: false, // 写操作门闩状态，防止快速重复提交。
    hgError: "", // 当前请求错误文案；空字符串表示无错误。
    hgNotice: "", // 成功反馈；空字符串表示无需展示。
  };

  hgMounted = false; // 卸载后丢弃异步响应。
  hgWriteFlight = false; // 同步写入门闩，不依赖异步 setState 生效。

  componentDidMount() {
    this.hgMounted = true;
    if (this.props.hgMerchant) {
      this.hgLoadUnusedImages();
      return;
    }
    this.hgLoadMerchantStatus();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgReleasePreviews(this.state.hgSelectedPreviews);
  }

  hgMessage = (hgError) => hgError?.message || "请求失败，请重试";

  /** 独立挂载时自读商家状态；获批后才读取未使用图片额度。 */
  hgLoadMerchantStatus = async () => {
    try {
      const hgMerchant = await HGMallVM.merchant();
      if (!this.hgMounted) return;
      this.setState({ hgMerchant });
      if (hgMerchant?.status === 1) this.hgLoadUnusedImages();
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      if (this.hgMounted) this.setState({ hgStatusLoading: false });
    }
  };

  /** 未使用图片来自授权读接口；quiet 为真时静默失败，避免发布成功后误报错误。 */
  hgLoadUnusedImages = async (hgQuiet = false) => {
    try {
      const hgUnused = await HGMallVM.unusedImages();
      if (this.hgMounted)
        this.setState({ hgUnusedImages: hgUnused?.imageURLs || [] });
    } catch (hgError) {
      if (this.hgMounted && !hgQuiet)
        this.setState({ hgError: this.hgMessage(hgError) });
    }
  };

  hgUpdateDraft = (hgKey, hgValue) =>
    this.setState((hgState) => ({
      hgDraft: { ...hgState.hgDraft, [hgKey]: hgValue },
    }));

  /** 切换商品类型时重置类目；会员只允许 membership，实物不允许。 */
  hgChangeType = (hgType) =>
    this.setState((hgState) => ({
      hgDraft: {
        ...hgState.hgDraft,
        type: hgType,
        category: hgType === "MEMBERSHIP" ? "membership" : "digital",
      },
    }));

  /** 发布前校验金额与库存；图片按选择顺序上传，失败可从断点继续重试。 */
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
  hgRemovePreview = (hgIndex) => {
    if (this.state.hgBusy || this.state.hgUploadedImages.length) return;
    const hgURL = this.state.hgSelectedPreviews[hgIndex]; // 要释放的单张预览；无效索引时为空。
    if (!hgURL) return;
    URL.revokeObjectURL(hgURL);
    this.setState((hgState) => ({
      hgSelectedImages: hgState.hgSelectedImages.filter(
        (_, hgPosition) => hgPosition !== hgIndex
      ),
      hgSelectedPreviews: hgState.hgSelectedPreviews.filter(
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

  /** 清理历史未绑定图片释放服务端额度；每张由服务端按本人和未绑定状态再次核验。 */
  hgRemoveUnusedImage = (hgURL) =>
    this.hgWrite(async () => {
      await HGMallVM.deleteImage(hgURL);
      if (this.hgMounted)
        this.setState((hgState) => ({
          hgUnusedImages: hgState.hgUnusedImages.filter(
            (hgItem) => hgItem !== hgURL
          ),
        }));
    }, "未发布图片已清除");

  /** 写操作门闩：发布与未使用图片清理共用；成功后静默刷新未使用图片额度。 */
  hgWrite = async (hgAction, hgSuccess) => {
    if (this.hgWriteFlight) return;
    this.hgWriteFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      await hgAction();
      if (this.hgMounted) this.setState({ hgNotice: hgSuccess });
      if (this.hgMounted) await this.hgLoadUnusedImages(true);
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 两个页面的图片预览一致：网格缩略图 + 逐张移除；预览不等于已上传或已公开。 */
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

  /** 发布表单：类型、类目、文字资料、展示图片、规格与价格库存。 */
  renderDraftForm() {
    const { hgDraft, hgStock, hgBusy } = this.state;
    return (
      <form className={styles.form} onSubmit={this.hgPublish}>
        <label>
          类型
          <select
            value={hgDraft.type}
            onChange={(hgEvent) => this.hgChangeType(hgEvent.target.value)}
          >
            <option value="PHYSICAL_PRODUCT">实物商品</option>
            <option value="MEMBERSHIP">会员卡</option>
          </select>
        </label>
        <label>
          类目
          <select
            value={hgDraft.category}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("category", hgEvent.target.value)
            }
          >
            {hgDraftCategories
              .filter(
                ([hgCode]) =>
                  hgDraft.type === "MEMBERSHIP"
                    ? hgCode === "membership"
                    : hgCode !== "membership"
              )
              .map(([hgCode, hgLabel]) => (
                <option key={hgCode} value={hgCode}>
                  {hgLabel}
                </option>
              ))}
          </select>
        </label>
        <label>
          商品名称
          <input
            required
            maxLength={128}
            value={hgDraft.title}
            onChange={(hgEvent) => this.hgUpdateDraft("title", hgEvent.target.value)}
          />
        </label>
        <label>
          简介（纯文本）
          <textarea
            required
            maxLength={512}
            value={hgDraft.summary}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("summary", hgEvent.target.value)
            }
          />
        </label>
        <label>
          商品介绍（纯文本）
          <textarea
            maxLength={4096}
            value={hgDraft.description}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("description", hgEvent.target.value)
            }
          />
        </label>
        <label>
          展示图片（最多5张，每张不超过5 MiB；已选{" "}
          {this.state.hgSelectedImages.length} 张）
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
          this.state.hgSelectedPreviews,
          !!this.state.hgUploadedImages.length
        )}
        {!!this.state.hgUploadedImages.length && (
          <div>
            <button
              type="button"
              className={styles.btnGhost}
              disabled={hgBusy}
              onClick={this.hgDiscardImages}
            >
              清除已上传的图片
            </button>
          </div>
        )}
        <label>
          规格
          <input
            required
            maxLength={128}
            value={hgDraft.skuTitle}
            onChange={(hgEvent) =>
              this.hgUpdateDraft("skuTitle", hgEvent.target.value)
            }
          />
        </label>
        <label>
          价格（整数 M币；实物不超过100000）
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
              this.hgUpdateDraft("amount", hgEvent.target.value)
            }
          />
        </label>
        {hgDraft.type === "PHYSICAL_PRODUCT" && (
          <label>
            初始可售库存（件）
            <input
              required
              type="number"
              min="1"
              max="100000"
              step="1"
              value={hgStock}
              onChange={(hgEvent) =>
                this.setState({ hgStock: hgEvent.target.value })
              }
            />
          </label>
        )}
        <div>
          <button type="submit" className={styles.btn} disabled={hgBusy}>
            提交商品审核
          </button>
        </div>
      </form>
    );
  }

  /** 未使用图片：最多保留20张；离开页面后可在此清理未绑定商品的图片。 */
  renderUnusedImages() {
    if (!this.state.hgUnusedImages.length) return null;
    const { hgBusy, hgUploadedImages } = this.state;
    return (
      <div>
        <h3 className={styles.subTitle}>未使用图片</h3>
        <p className={styles.formHint}>
          最多保留20张；可在此删除未绑定商品的图片，释放上传额度。
        </p>
        {this.state.hgUnusedImages.map((hgURL) => (
          <span key={hgURL} className={styles.unusedItem}>
            <img
              src={normalizeVideoCoverUrl(hgURL)}
              alt="未使用的商品图片"
              loading="lazy"
            />
            <button
              type="button"
              className={`${styles.btnGhost} ${styles.btnSmall}`}
              disabled={hgBusy || hgUploadedImages.includes(hgURL)}
              onClick={() => this.hgRemoveUnusedImage(hgURL)}
            >
              删除
            </button>
          </span>
        ))}
      </div>
    );
  }

  render() {
    const { hgMerchant, hgStatusLoading, hgError, hgNotice } = this.state;
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
        <section className={styles.panel} aria-label="新增商品">
          <div className={styles.head}>
            <h2>新增商品</h2>
            {hgMerchant?.shopName && (
              <span className={styles.headSmall}>
                店铺：{hgMerchant.shopName}
              </span>
            )}
          </div>
          <p className={styles.desc}>
            发布后等待审核；实物商品使用 M
            币购买并占用库存，由商家手工发货；会员仅展示，不发放权益。
          </p>
          {hgStatusLoading ? (
            <p role="status" className={styles.loading}>
              正在读取商家状态...
            </p>
          ) : hgMerchant?.status === 1 ? (
            <>
              {this.renderDraftForm()}
              {this.renderUnusedImages()}
            </>
          ) : (
            <div className={styles.empty}>
              <strong>尚未开通商家权限</strong>
              <span>完成「商家入驻申请」并通过审核后，即可在这里发布商品。</span>
            </div>
          )}
        </section>
      </div>
    );
  }
}

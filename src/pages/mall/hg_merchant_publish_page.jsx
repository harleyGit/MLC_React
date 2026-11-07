/*
 * @Description: 个人中心「商家中心 → 新增商品」页面：发布草稿、图片上传与未使用图片清理。
 *               对标拼多多/京东的商品发布体验：分步式表单 + 实时发布预览 + 营销权益示意。
 */
import React from "react";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import { HG_MALL_CATEGORIES } from "./hg_mall_categories.js";
import HGMallVM from "./hg_mall_vm.js";
import styles from "./hg_merchant_center.module.css";

const hgDraftCategories = HG_MALL_CATEGORIES.filter(([hgCode]) => hgCode); // 发布表单不含「全部商品」占位类目。

/** 当前后端开放能力的营销权益示意；未开放的权益仅展示，不伪造提交字段。 */
const hgPerks = [
  {
    key: "groupBuy",
    icon: "拼",
    name: "拼单",
    desc: "多人成团价，参考拼多多玩法",
    available: false,
  },
  {
    key: "member",
    icon: "惠",
    name: "会员折扣",
    desc: "会员享专属折扣价",
    available: false,
  },
  {
    key: "mcoin",
    icon: "M",
    name: "M币抵扣",
    desc: "结算时可用 M币抵扣",
    available: true,
  },
];

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
    let hgDeleted = 0; // 成功清理的前缀图片数；失败时保留其余图片与文件的顺序，允许重试。
    try {
      for (const hgURL of this.state.hgUploadedImages) {
        await HGMallVM.deleteImage(hgURL);
        hgDeleted += 1;
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: this.hgMessage(hgError) });
    } finally {
      this.hgWriteFlight = false;
      if (this.hgMounted) {
        const { hgSelectedImages, hgSelectedPreviews, hgUploadedImages } = this.state;
        this.hgReleasePreviews(hgSelectedPreviews.slice(0, hgDeleted));
        if (hgDeleted === hgUploadedImages.length)
          this.hgReleasePreviews(hgSelectedPreviews.slice(hgDeleted));
        this.setState({
          hgBusy: false,
          hgSelectedImages: hgDeleted === hgUploadedImages.length ? [] : hgSelectedImages.slice(hgDeleted),
          hgSelectedPreviews: hgDeleted === hgUploadedImages.length ? [] : hgSelectedPreviews.slice(hgDeleted),
          hgUploadedImages: hgUploadedImages.slice(hgDeleted),
          hgUnusedImages: this.state.hgUnusedImages.filter((hgURL) => !hgUploadedImages.slice(0, hgDeleted).includes(hgURL)),
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

  /** 字段字数统计：标题/简介/介绍/规格的剩余额度提示。 */
  renderCount(hgValue, hgMax) {
    const hgLen = (hgValue || "").length;
    const hgNear = hgLen >= hgMax - 10;
    return (
      <span
        className={`${styles.fieldCount} ${hgNear ? styles.fieldCountWarn : ""}`}
      >
        {hgLen}/{hgMax}
      </span>
    );
  }

  /** 类型 + 类目选择区。 */
  renderTypeSection() {
    const { hgDraft } = this.state;
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIndex}>1</span>
          <h3>商品分类</h3>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                <span>
                  商品类型<span className={styles.req}>*</span>
                </span>
              </span>
              <select
                value={hgDraft.type}
                onChange={(hgEvent) =>
                  this.hgChangeType(hgEvent.target.value)
                }
              >
                <option value="PHYSICAL_PRODUCT">实物商品</option>
                <option value="MEMBERSHIP">会员卡</option>
              </select>
            </div>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                <span>
                  商品类目<span className={styles.req}>*</span>
                </span>
              </span>
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
            </div>
          </div>
        </div>
      </section>
    );
  }

  /** 基础信息区：名称、简介、介绍。 */
  renderBasicSection() {
    const { hgDraft } = this.state;
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIndex}>2</span>
          <h3>基础信息</h3>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <span>
                商品名称<span className={styles.req}>*</span>
              </span>
              {this.renderCount(hgDraft.title, 128)}
            </span>
            <input
              required
              maxLength={128}
              placeholder="请输入商品名称，例如 X Pro 智能手机"
              value={hgDraft.title}
              onChange={(hgEvent) =>
                this.hgUpdateDraft("title", hgEvent.target.value)
              }
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <span>
                简介<span className={styles.req}>*</span>
              </span>
              {this.renderCount(hgDraft.summary, 512)}
            </span>
            <textarea
              required
              maxLength={512}
              placeholder="一句话卖点，展示在商品卡片上"
              value={hgDraft.summary}
              onChange={(hgEvent) =>
                this.hgUpdateDraft("summary", hgEvent.target.value)
              }
            />
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <span>商品介绍</span>
              {this.renderCount(hgDraft.description, 4096)}
            </span>
            <textarea
              maxLength={4096}
              placeholder="详细介绍商品规格、材质、使用说明等（纯文本）"
              value={hgDraft.description}
              onChange={(hgEvent) =>
                this.hgUpdateDraft("description", hgEvent.target.value)
              }
            />
          </div>
        </div>
      </section>
    );
  }

  /** 图片区：上传与预览。 */
  renderImageSection() {
    const { hgBusy } = this.state;
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIndex}>3</span>
          <h3>展示图片</h3>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <span>
                商品图片
                <span className={styles.req}>*</span>
              </span>
              <span className={styles.fieldCount}>
                已选 {this.state.hgSelectedImages.length}/5 张
              </span>
            </span>
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
            <p className={styles.fieldHint}>
              最多 5 张，支持 JPG / PNG / WebP，每张不超过 5 MiB；首图将作为商品主图。
            </p>
          </div>
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
        </div>
      </section>
    );
  }

  /** 规格价格库存区。 */
  renderSkuSection() {
    const { hgDraft, hgStock } = this.state;
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIndex}>4</span>
          <h3>规格与价格</h3>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>
              <span>
                规格<span className={styles.req}>*</span>
              </span>
              {this.renderCount(hgDraft.skuTitle, 128)}
            </span>
            <input
              required
              maxLength={128}
              placeholder="例如：标准版 / 黑色 256GB"
              value={hgDraft.skuTitle}
              onChange={(hgEvent) =>
                this.hgUpdateDraft("skuTitle", hgEvent.target.value)
              }
            />
          </div>
          <div className={styles.twoCol}>
            <div className={styles.field}>
              <span className={styles.fieldLabel}>
                <span>
                  价格（M币）<span className={styles.req}>*</span>
                </span>
              </span>
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
                placeholder="整数 M币"
                value={hgDraft.amount}
                onChange={(hgEvent) =>
                  this.hgUpdateDraft("amount", hgEvent.target.value)
                }
              />
            </div>
            {hgDraft.type === "PHYSICAL_PRODUCT" && (
              <div className={styles.field}>
                <span className={styles.fieldLabel}>
                  <span>
                    初始库存（件）<span className={styles.req}>*</span>
                  </span>
                </span>
                <input
                  required
                  type="number"
                  min="1"
                  max="100000"
                  step="1"
                  placeholder="1-100000"
                  value={hgStock}
                  onChange={(hgEvent) =>
                    this.setState({ hgStock: hgEvent.target.value })
                  }
                />
              </div>
            )}
          </div>
          {hgDraft.type === "PHYSICAL_PRODUCT" && (
            <p className={styles.fieldHint}>
              实物商品以 M币计价并占用库存，由商家手工发货。
            </p>
          )}
          {hgDraft.type === "MEMBERSHIP" && (
            <p className={styles.fieldHint}>会员卡仅作展示，暂不发放权益。</p>
          )}
        </div>
      </section>
    );
  }

  /** 营销与权益示意区：当前后端开放 M币，其余作为后续能力说明。 */
  renderPerksSection() {
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIndex}>5</span>
          <h3>营销与权益</h3>
        </div>
        <div className={styles.sectionBody}>
          <div className={styles.perks}>
            {hgPerks.map((hgPerk) => (
              <div className={styles.perkRow} key={hgPerk.key}>
                <span className={styles.perkIcon}>{hgPerk.icon}</span>
                <div className={styles.perkBody}>
                  <div className={styles.perkName}>{hgPerk.name}</div>
                  <div className={styles.perkDesc}>{hgPerk.desc}</div>
                </div>
                {hgPerk.available ? (
                  <span className={styles.previewTag}>已支持</span>
                ) : (
                  <span className={styles.perkTag}>即将开放</span>
                )}
              </div>
            ))}
          </div>
          <p className={styles.fieldHint}>
            当前版本仅开放 M币抵扣；拼单与会员折扣等能力将在后续版本接入。
          </p>
        </div>
      </section>
    );
  }

  /** 实时发布预览：仿商品详情卡，随表单即时更新。 */
  renderPreview() {
    const { hgDraft, hgStock, hgSelectedPreviews } = this.state;
    const hgAmount = Number(hgDraft.amount);
    const hgPriceValid = Number.isSafeInteger(hgAmount) && hgAmount > 0;
    return (
      <aside className={styles.preview} aria-label="发布预览">
        <div className={styles.previewHead}>发布预览</div>
        {hgSelectedPreviews.length ? (
          <img
            className={styles.previewCover}
            src={hgSelectedPreviews[0]}
            alt="商品主图预览"
          />
        ) : (
          <div className={styles.previewCoverEmpty}>暂无商品图片</div>
        )}
        <div className={styles.previewBody}>
          {hgDraft.title ? (
            <h3 className={styles.previewTitle}>{hgDraft.title}</h3>
          ) : (
            <p className={styles.previewEmpty}>填写名称后在此预览</p>
          )}
          {hgPriceValid && (
            <div className={styles.previewPrice}>
              <b>{hgAmount.toLocaleString("zh-CN")}</b>
              <small>M币</small>
            </div>
          )}
          <div className={styles.previewMeta}>
            {hgDraft.skuTitle && (
              <span className={styles.previewTag}>{hgDraft.skuTitle}</span>
            )}
            {hgDraft.type === "PHYSICAL_PRODUCT" && hgStock && (
              <span className={styles.previewTag}>库存 {hgStock} 件</span>
            )}
            {hgDraft.type === "MEMBERSHIP" && (
              <span className={styles.previewTag}>会员卡</span>
            )}
          </div>
          {hgDraft.summary && (
            <p className={styles.previewSummary}>{hgDraft.summary}</p>
          )}
        </div>
      </aside>
    );
  }

  /** 分步进度条：基础信息 → 图片 → 规格价格 → 提交。 */
  renderStepper() {
    const hgSteps = ["商品分类", "基础信息", "展示图片", "规格价格", "营销权益"];
    return (
      <div className={styles.stepper}>
        {hgSteps.map((hgStep, hgIndex) => (
          <div className={styles.stepperStep} key={hgStep}>
            <span className={styles.stepperNum}>{hgIndex + 1}</span>
            <span>{hgStep}</span>
          </div>
        ))}
      </div>
    );
  }

  /** 发布表单：分步式卡片布局，右侧实时预览。 */
  renderDraftForm() {
    const { hgBusy } = this.state;
    return (
      <div className={styles.publishLayout}>
        <form className={styles.publishForm} onSubmit={this.hgPublish}>
          {this.renderStepper()}
          {this.renderTypeSection()}
          {this.renderBasicSection()}
          {this.renderImageSection()}
          {this.renderSkuSection()}
          {this.renderPerksSection()}
          <div className={styles.submitBar}>
            <p className={styles.submitHint}>
              提交后进入审核，审核通过自动进入公开目录。
            </p>
            <button type="submit" className={styles.btn} disabled={hgBusy}>
              提交商品审核
            </button>
          </div>
        </form>
        {this.renderPreview()}
      </div>
    );
  }

  /** 未使用图片：最多保留20张；离开页面后可在此清理未绑定商品的图片。 */
  renderUnusedImages() {
    if (!this.state.hgUnusedImages.length) return null;
    const { hgBusy, hgUploadedImages } = this.state;
    return (
      <section className={styles.sectionCard}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionIndex}>余</span>
          <h3>未使用图片</h3>
        </div>
        <div className={styles.sectionBody}>
          <p className={styles.fieldHint}>
            最多保留20张；可在此删除未绑定商品的图片，释放上传额度。
          </p>
          <div>
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
        </div>
      </section>
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

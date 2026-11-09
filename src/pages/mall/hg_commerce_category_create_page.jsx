import React from "react";
import HGUpload from "../../components/hg_upload/hg_upload.jsx";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import HGCommerceVM from "./hg_commerce_vm.js";
import styles from "./hg_merchant_center.module.css";

/**
 * 新建平台普通类目页（独立路由，由类目管理列表右上角进入）。
 * 职责：提交类目业务 ID、名称、可选上级 ID 和本人上传的可选图片；成功后提示并支持返回列表。
 * 约束：本期仅创建 regulated=false 的普通类目；图片只允许管理员本人未绑定的资产。
 */
export default class HGCommerceCategoryCreatePage extends React.Component {
  state = {
    hgCategoryId: "", // 新类目业务 ID；1-64 位 ASCII 字母、数字、连字符或下划线。
    hgName: "", // 新类目名称；1-64 字符，服务端最终校验。
    hgParentId: "", // 上级类目业务 ID（来自管理端列表）；空表示一级类目。
    hgAdminCategories: [], // 管理端类目列表；用于上级下拉选择，避免手输非法 ID。
    hgFile: null, // 本次选中的本地图片；null 表示未选择。
    hgPreview: "", // 当前文件的 blob 预览地址；空表示无本地预览，卸载时释放。
    hgImageURL: "", // 已上传的本管理员类目图片 URL；空表示无图片，失败重试不重复上传。
    hgUnused: [], // 本人尚未绑定的类目图片 URL；空表示没有可续用的图片。
    hgBusy: false, // 提交中禁用表单与返回。
    hgError: "", // 最近一次失败提示；空表示无错误。
    hgNotice: "", // 最近一次成功提示；空表示无提示。
  };

  hgFlight = false; // 写操作同步门闩，避免异步 setState 期间重复提交。
  hgMounted = false; // 卸载后丢弃过期请求结果。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoadUnused();
    this.hgLoadCategories();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
  }

  /** 失败后允许复用已上传图片，并可主动清理遗留资产释放配额。 */
  hgLoadUnused = async () => {
    try {
      const hgResult = await HGCommerceVM.unusedCategoryImages(); // 服务端有界返回的本人未绑定图片。
      if (this.hgMounted)
        this.setState({ hgUnused: hgResult?.imageURLs || [] });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({
          hgError: hgError?.message || "未使用类目图片加载失败",
        });
    }
  };

  /** 加载管理端类目列表供上级下拉选择；失败不阻塞表单，仅可创建一级类目。 */
  hgLoadCategories = async () => {
    try {
      const hgList = await HGCommerceVM.adminCategories(); // GET /admin/categories，含字符串业务 categoryId。
      if (this.hgMounted) this.setState({ hgAdminCategories: hgList || [] });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({
          hgError: hgError?.message || "类目列表加载失败，暂只能创建一级类目",
        });
    }
  };

  /** 上传组件选择前只验证类型和大小；真正内容校验由服务端上传器执行。 */
  hgBeforeChooseImage = (hgFile) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(hgFile.type) ||
      hgFile.size < 1 ||
      hgFile.size > 5 << 20
    ) {
      this.setState({
        hgError: "类目图片只支持 JPG、PNG、WebP，每张不超过 5 MiB",
      });
      return false;
    }
    return hgFile;
  };

  /** 接收照片墙文件列表；当前业务限制一张图片，空列表表示移除本地选择。 */
  hgChooseImage = (hgChange) => {
    const hgFileList = hgChange.fileList; // 新上传组件提供列表；旧调用方可继续传原生 input 事件。
    const hgItem = hgFileList?.[0] || null; // maxCount=1，首项即当前类目图片。
    const hgLegacyFile = hgChange.target?.files?.[0] || null; // 兼容既有直接调用和渐进迁移场景。
    if (hgChange.target) hgChange.target.value = "";
    const hgFile = hgItem?.originFileObj || hgLegacyFile; // 服务端已有图片没有本地 File。
    if (hgLegacyFile && this.hgBeforeChooseImage(hgLegacyFile) === false) return;
    if (!hgFile) {
      if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
      this.setState({ hgFile: null, hgPreview: "" });
      return;
    }
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
    this.setState({
      hgFile,
      hgPreview: URL.createObjectURL(hgFile),
      hgImageURL: "",
      hgError: "",
    });
  };

  /** 改用本人已有图片时释放旧预览地址，不自动清理其他待绑定对象。 */
  hgUseImage = (hgURL) => {
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
    this.setState({ hgFile: null, hgPreview: "", hgImageURL: hgURL });
  };

  /** 未绑定的服务端图片可删除；失败保留当前选择，避免静默丢失可恢复资产。 */
  hgDeleteImage = async (hgURL) => {
    if (this.hgFlight) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "" });
    try {
      await HGCommerceVM.deleteCategoryImage(hgURL);
      if (this.hgMounted) {
        if (this.state.hgImageURL === hgURL && this.state.hgPreview)
          URL.revokeObjectURL(this.state.hgPreview);
        this.setState((hgState) => ({
          hgUnused: hgState.hgUnused.filter((hgItem) => hgItem !== hgURL),
          ...(hgState.hgImageURL === hgURL
            ? { hgImageURL: "", hgFile: null, hgPreview: "" }
            : {}),
        }));
      }
      return true;
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "图片清理失败" });
      return false;
    } finally {
      this.hgFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 返回来源页；导航能力由路由包装注入，测试环境允许缺失。 */
  hgBack = () => {
    if (this.state.hgBusy) return;
    this.props.navigate?.(-1);
  };

  hgSubmit = async (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgFlight) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      const hgName = this.state.hgName.trim(); // 创建请求名称，空或非法文本应先于上传拒绝。
      const hgCategoryId = this.state.hgCategoryId.trim(); // 新类目业务 ID，由管理员明确填写。
      const hgParentId = this.state.hgParentId.trim(); // 上级 ID；空表示一级类目。
      if (!hgName || /[<>\r\n\0]/.test(hgName))
        throw new Error("请填写 1-64 字的类目名称，且不能包含 < > 或换行符");
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(hgCategoryId))
        throw new Error(
          "类目 ID 须为 1-64 位字母、数字、连字符或下划线，例如 DIG-0001"
        );
      if (hgParentId && !/^[A-Za-z0-9_-]{1,64}$/.test(hgParentId))
        throw new Error("上级类目 ID 须从下拉列表选择；留空表示创建一级类目");
      let hgImageURL = this.state.hgImageURL; // 已上传图片在创建失败后沿用，避免重复占用额度。
      if (this.state.hgFile && !hgImageURL) {
        const hgResult = await HGCommerceVM.uploadCategoryImage(
          this.state.hgFile
        );
        if (!hgResult?.imageURL) throw new Error("类目图片上传响应异常");
        hgImageURL = hgResult.imageURL;
        if (this.hgMounted) this.setState({ hgImageURL });
      }
      await HGCommerceVM.createCategory({
        categoryId: hgCategoryId,
        name: hgName,
        parentId: hgParentId,
        regulated: false, // 本期仅开放普通类目，受监管类目由后端单独维护。
        imageURL: hgImageURL,
      });
      if (this.hgMounted) {
        if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
        this.setState({
          hgNotice: "类目已创建",
          hgCategoryId: "",
          hgName: "",
          hgParentId: "",
          hgFile: null,
          hgPreview: "",
          hgImageURL: "",
          hgUnused: this.state.hgUnused.filter((hgURL) => hgURL !== hgImageURL),
        });
      }
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "创建失败，请重试" });
    } finally {
      this.hgFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 图片选择与预览不参与普通类目名称的受控输入。 */
  renderImageField() {
    const { hgFile, hgPreview, hgImageURL, hgBusy } = this.state; // 图片选择状态；空 URL 表示尚未上传或已清理。
    const hgFileList = hgPreview
      ? [
          {
            uid: "category-local-image",
            name: hgFile?.name || "类目图片",
            status: "done",
            type: hgFile?.type || "image/*",
            originFileObj: hgFile,
            url: hgPreview,
          },
        ]
      : hgImageURL
        ? [
            {
              uid: "category-uploaded-image",
              name: "已上传类目图片",
              status: "done",
              type: "image/*",
              url: normalizeVideoCoverUrl(hgImageURL),
            },
          ]
        : []; // 受控照片墙列表，本地选择与服务端资产最多展示其一。
    return (
      <div className={styles.field}>
        <label htmlFor="category-image">
          类目图片（可选，JPG/PNG/WebP，最多 5 MiB）
        </label>
        <HGUpload
          id="category-image"
          accept="image/jpeg,image/png,image/webp"
          fileList={hgFileList}
          maxCount={1}
          multiple={false}
          disabled={hgBusy}
          beforeUpload={this.hgBeforeChooseImage}
          onChange={this.hgChooseImage}
          onRemove={() =>
            hgImageURL ? this.hgDeleteImage(hgImageURL) : true
          }
          uploadText="选择图片"
        />
        {hgImageURL && (
          <p className={styles.fieldHint}>
            图片已上传；创建失败时可直接重试，不会重复上传。
          </p>
        )}
      </div>
    );
  }

  /** 已上传但未绑定的图片可续用或手动清理，配额按本人最多 20 张计算。 */
  renderUnusedImages() {
    const { hgUnused, hgBusy } = this.state; // 本人未绑定图片和当前写入门闩。
    if (!hgUnused.length) return null;
    return (
      <section className={styles.sectionBody} aria-label="未绑定的类目图片">
        <h3>未绑定类目图片（{hgUnused.length}/20）</h3>
        <div className={styles.imgGrid}>
          {hgUnused.map((hgURL) => (
            <div key={hgURL} className={styles.imgItem}>
              <img src={normalizeVideoCoverUrl(hgURL)} alt="未绑定类目图片" />
              <button
                type="button"
                className={styles.btnGhost}
                disabled={hgBusy}
                onClick={() => this.hgUseImage(hgURL)}
              >
                使用此图
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={hgBusy}
                onClick={() => this.hgDeleteImage(hgURL)}
              >
                清理
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  render() {
    const { hgCategoryId, hgName, hgParentId, hgBusy, hgError, hgNotice } =
      this.state; // 类目基本字段及写入反馈。
    return (
      <main className={styles.page} aria-label="新建普通类目">
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
            <h2>新建普通类目</h2>
          </div>
          <p className={styles.desc}>
            仅创建普通（无需经营资质）类目；上级留空表示一级类目，最多三级。
          </p>
          <form className={styles.publishForm} onSubmit={this.hgSubmit}>
            <fieldset className={styles.commerceFieldset} disabled={hgBusy}>
              <legend>类目信息</legend>
              <div className={styles.field}>
                <label htmlFor="category-id">类目 ID</label>
                <input
                  id="category-id"
                  required
                  maxLength={64}
                  placeholder="例如 DIG-0001"
                  value={hgCategoryId}
                  onChange={(hgEvent) =>
                    this.setState({ hgCategoryId: hgEvent.target.value })
                  }
                />
                <p className={styles.fieldHint}>
                  仅支持字母、数字、连字符和下划线；创建后作为稳定业务标识。
                </p>
              </div>
              <div className={styles.field}>
                <label htmlFor="category-name">类目名称</label>
                <input
                  id="category-name"
                  required
                  maxLength={64}
                  value={hgName}
                  onChange={(hgEvent) =>
                    this.setState({ hgName: hgEvent.target.value })
                  }
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="category-parent">上级类目（可选）</label>
                {/* 上级 ID 来自已存在类目，下拉选择避免手输不存在的业务标识。 */}
                <select
                  id="category-parent"
                  value={hgParentId}
                  onChange={(hgEvent) =>
                    this.setState({ hgParentId: hgEvent.target.value })
                  }
                >
                  <option value="">一级类目（无上级）</option>
                  {this.state.hgAdminCategories.map((hgItem) => (
                    <option key={hgItem.categoryId} value={hgItem.categoryId}>
                      {hgItem.name}（ID: {hgItem.categoryId}）
                    </option>
                  ))}
                </select>
                <p className={styles.fieldHint}>
                  选择已有类目则创建其子类目；选「一级类目」则不设上级。
                </p>
              </div>
              {this.renderImageField()}
            </fieldset>
            <div className={styles.actions}>
              <button type="submit" className={styles.btn} disabled={hgBusy}>
                {hgBusy ? "提交中…" : "创建类目"}
              </button>
              <button
                type="button"
                className={styles.btnGhost}
                disabled={hgBusy}
                onClick={this.hgBack}
              >
                返回
              </button>
            </div>
          </form>
          {this.renderUnusedImages()}
        </section>
      </main>
    );
  }
}

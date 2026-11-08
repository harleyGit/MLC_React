import React from "react";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import HGCommerceVM from "./hg_commerce_vm.js";
import styles from "./hg_merchant_center.module.css";

/**
 * 新建平台普通类目页（独立路由，由类目管理列表右上角进入）。
 * 职责：提交类目名称、可选上级 ID 和本人上传的可选图片；成功后提示并支持返回列表。
 * 约束：本期仅创建 regulated=false 的普通类目；图片只允许管理员本人未绑定的资产。
 */
export default class HGCommerceCategoryCreatePage extends React.Component {
  state = {
    hgName: "", // 新类目名称；1-64 字符，服务端最终校验。
    hgParentId: "", // 上级类目 ID 文本；空表示一级类目。
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
  }

  componentWillUnmount() {
    this.hgMounted = false;
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
  }

  /** 失败后允许复用已上传图片，并可主动清理遗留资产释放配额。 */
  hgLoadUnused = async () => {
    try {
      const hgResult = await HGCommerceVM.unusedCategoryImages(); // 服务端有界返回的本人未绑定图片。
      if (this.hgMounted) this.setState({ hgUnused: hgResult?.imageURLs || [] });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "未使用类目图片加载失败" });
    }
  };

  /** 选择时只验证类型和大小；真正内容校验由服务端上传器执行。 */
  hgChooseImage = (hgEvent) => {
    const hgFile = hgEvent.target.files?.[0] || null; // 一次仅选择一张，空表示取消选择。
    hgEvent.target.value = "";
    if (!hgFile) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(hgFile.type) || hgFile.size < 1 || hgFile.size > 5 << 20) {
      this.setState({ hgError: "类目图片只支持 JPG、PNG、WebP，每张不超过 5 MiB" });
      return;
    }
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
    this.setState({ hgFile, hgPreview: URL.createObjectURL(hgFile), hgImageURL: "", hgError: "" });
  };

  /** 改用本人已有图片时释放旧预览地址，不自动清理其他待绑定对象。 */
  hgUseImage = (hgURL) => {
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
    this.setState({ hgFile: null, hgPreview: "", hgImageURL: hgURL });
  };

  /** 只清除本地选择；上传成功的资产必须走服务端清理接口。 */
  hgClearLocalImage = () => {
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
    this.setState({ hgFile: null, hgPreview: "" });
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
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: hgError?.message || "图片清理失败" });
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
      const hgParentId = this.state.hgParentId.trim(); // 上级 ID；空表示一级类目。
      if (!hgName || /[<>\r\n\0]/.test(hgName) || (hgParentId && !/^[1-9]\d{0,19}$/.test(hgParentId)))
        throw new Error("请填写有效的类目名称和上级类目 ID");
      let hgImageURL = this.state.hgImageURL; // 已上传图片在创建失败后沿用，避免重复占用额度。
      if (this.state.hgFile && !hgImageURL) {
        const hgResult = await HGCommerceVM.uploadCategoryImage(this.state.hgFile);
        if (!hgResult?.imageURL) throw new Error("类目图片上传响应异常");
        hgImageURL = hgResult.imageURL;
        if (this.hgMounted) this.setState({ hgImageURL });
      }
      await HGCommerceVM.createCategory({
        name: hgName,
        parentId: hgParentId,
        regulated: false, // 本期仅开放普通类目，受监管类目由后端单独维护。
        imageURL: hgImageURL,
      });
      if (this.hgMounted) {
        if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
        this.setState({
          hgNotice: "类目已创建",
          hgName: "",
          hgParentId: "",
          hgFile: null,
          hgPreview: "",
          hgImageURL: "",
          hgUnused: this.state.hgUnused.filter((hgURL) => hgURL !== hgImageURL),
        });
      }
    } catch (hgError) {
      if (this.hgMounted) this.setState({ hgError: hgError?.message || "创建失败，请重试" });
    } finally {
      this.hgFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  /** 图片选择与预览不参与普通类目名称的受控输入。 */
  renderImageField() {
    const { hgPreview, hgImageURL } = this.state; // 图片选择状态；空 URL 表示尚未上传或已清理。
    return (
      <div className={styles.field}>
        <label htmlFor="category-image">类目图片（可选，JPG/PNG/WebP，最多 5 MiB）</label>
        <input
          id="category-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={!!hgImageURL}
          onChange={this.hgChooseImage}
        />
        {(hgPreview || hgImageURL) && (
          <img
            className={styles.editThumb}
            src={hgPreview || normalizeVideoCoverUrl(hgImageURL)}
            alt="待创建类目图片预览"
          />
        )}
        {hgImageURL && (
          <p className={styles.fieldHint}>
            图片已上传；创建失败时可直接重试，不会重复上传。
          </p>
        )}
        {hgPreview && !hgImageURL && (
          <button type="button" className={styles.btnGhost} onClick={this.hgClearLocalImage}>
            移除本地图片
          </button>
        )}
        {hgImageURL && (
          <button type="button" className={styles.btnGhost} onClick={() => this.hgDeleteImage(hgImageURL)}>
            清理已上传图片
          </button>
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
              <button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={() => this.hgUseImage(hgURL)}>
                使用此图
              </button>
              <button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={() => this.hgDeleteImage(hgURL)}>
                清理
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  render() {
    const { hgName, hgParentId, hgBusy, hgError, hgNotice } = this.state; // 类目基本字段及写入反馈。
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
                <label htmlFor="category-parent">上级类目 ID（可选）</label>
                <input
                  id="category-parent"
                  maxLength={32}
                  value={hgParentId}
                  onChange={(hgEvent) =>
                    this.setState({ hgParentId: hgEvent.target.value })
                  }
                />
                <p className={styles.fieldHint}>
                  填写已有类目 ID 则创建其子类目；留空创建一级类目。
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

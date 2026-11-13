import React from "react";
import HGImageCrop from "../../components/hg_image_crop/hg_image_crop.jsx";
import HGUpload from "../../components/hg_upload/hg_upload.jsx";
import { normalizeVideoCoverUrl } from "../bilibili/hg_bili_media_url.js";
import HGCommerceVM from "./hg_commerce_vm.js";
import styles from "./hg_merchant_center.module.css";

/** 编辑平台普通类目；有子类目时服务端仅允许更新名称和图片。 */
export default class HGCommerceCategoryEditPage extends React.Component {
  state = {
    hgOriginalId: "", // 当前服务端类目 ID；ID 修改成功后同步更新，支持继续保存。
    hgCategoryId: "", // 修改后的业务 ID，1-64 位安全 ASCII 字符。
    hgName: "", // 修改后的类目名称，1-64 字符。
    hgParentId: "", // 修改后的上级类目 ID；空表示一级类目。
    hgAdminCategories: [], // 管理端普通类目列表（含父类目）；用于目标解析和上级下拉。
    hgFile: null, // 新选择的本地图片；null 表示不上传新图片。
    hgPreview: "", // 本地图片 blob 预览地址；空表示没有本地选择。
    hgImageURL: "", // 本次保存期望绑定的服务端图片；空表示移除图片。
    hgOriginalImageURL: "", // 加载时图片 URL；移除本地新图时恢复该值。
    hgUnused: [], // 本管理员尚未绑定、可直接选择的图片 URL。
    hgLoaded: false, // 是否已从管理列表解析出目标类目。
    hgBusy: false, // 提交中禁用表单与返回。
    hgError: "", // 最近一次失败提示；空表示无错误。
    hgNotice: "", // 最近一次成功提示；空表示无提示。
  };

  hgMounted = false; // 卸载后丢弃过期请求结果。
  hgFlight = false; // 写操作同步门闩，避免异步 setState 期间重复提交。

  componentDidMount() {
    this.hgMounted = true;
    this.hgLoad();
    this.hgLoadUnused();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
  }

  /** 从管理列表加载目标全部可编辑字段，并保留列表作为上级候选。 */
  hgLoad = async () => {
    const hgID = this.props.params?.categoryId;
    if (!hgID) {
      this.setState({ hgError: "缺少类目 ID，请从类目管理列表进入" });
      return;
    }
    try {
      const hgCategories = await HGCommerceVM.adminCategories();
      if (!this.hgMounted) return;
      const hgTarget = (hgCategories || []).find(
        (hgItem) => hgItem.categoryId === hgID
      );
      if (!hgTarget) {
        this.setState({
          hgError: "未找到该类目；可能已被禁用或删除，请刷新类目列表",
        });
        return;
      }
      this.setState({
        hgOriginalId: hgTarget.categoryId,
        hgCategoryId: hgTarget.categoryId,
        hgName: hgTarget.name,
        hgParentId: hgTarget.parentId || "",
        hgImageURL: hgTarget.imageURL || "",
        hgOriginalImageURL: hgTarget.imageURL || "",
        hgAdminCategories: hgCategories || [],
        hgLoaded: true,
      });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "类目信息加载失败" });
    }
  };

  /** 加载本人未绑定图片，编辑时可直接替换而不重复上传。 */
  hgLoadUnused = async () => {
    try {
      const hgResult = await HGCommerceVM.unusedCategoryImages();
      if (this.hgMounted) this.setState({ hgUnused: hgResult?.imageURLs || [] });
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "未使用类目图片加载失败" });
    }
  };

  /** 上传组件选择前限制图片类型和大小，服务端仍校验真实内容。 */
  hgBeforeChooseImage = (hgFile) => {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(hgFile.type) ||
      hgFile.size < 1 ||
      hgFile.size > 5 << 20
    ) {
      this.setState({ hgError: "类目图片只支持 JPG、PNG、WebP，每张不超过 5 MiB" });
      return false;
    }
    return hgFile;
  };

  /** 保存新选择的单张本地图片；空列表仅清理本地预览。 */
  hgChooseImage = (hgChange) => {
    const hgItem = hgChange.fileList?.[0] || null;
    const hgLegacyFile = hgChange.target?.files?.[0] || null;
    if (hgChange.target) hgChange.target.value = "";
    const hgFile = hgItem?.originFileObj || hgLegacyFile;
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

  /** 删除照片墙项目：本地新图恢复原图，服务端原图则标记为保存时解绑。 */
  hgRemoveImage = (hgItem) => {
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
    const hgRemovingLocal = hgItem?.uid === "category-edit-local";
    this.setState({
      hgFile: null,
      hgPreview: "",
      hgImageURL: hgRemovingLocal ? this.state.hgOriginalImageURL : "",
    });
    return true;
  };

  /** 直接选择本人未绑定图片作为修改目标。 */
  hgUseImage = (hgURL) => {
    if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
    this.setState({ hgFile: null, hgPreview: "", hgImageURL: hgURL, hgError: "" });
  };

  /** 返回来源页；导航能力由路由包装注入，测试环境允许缺失。 */
  hgBack = () => {
    if (this.state.hgBusy) return;
    this.props.navigate?.(-1);
  };

  hgSubmit = async (hgEvent) => {
    hgEvent.preventDefault();
    if (this.hgFlight || !this.state.hgLoaded) return;
    this.hgFlight = true;
    this.setState({ hgBusy: true, hgError: "", hgNotice: "" });
    try {
      const hgCategoryId = this.state.hgCategoryId.trim();
      const hgName = this.state.hgName.trim();
      const hgParentId = this.state.hgParentId.trim();
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(hgCategoryId))
        throw new Error("类目 ID 须为 1-64 位字母、数字、连字符或下划线");
      if (!hgName || /[<>\r\n\0]/.test(hgName))
        throw new Error("请填写 1-64 字的类目名称，且不能包含 < > 或换行符");
      if (hgParentId && !/^[A-Za-z0-9_-]{1,64}$/.test(hgParentId))
        throw new Error("上级类目 ID 须从下拉列表选择");
      let hgImageURL = this.state.hgImageURL;
      if (this.state.hgFile && !hgImageURL) {
        const hgResult = await HGCommerceVM.uploadCategoryImage(this.state.hgFile);
        if (!hgResult?.imageURL) throw new Error("类目图片上传响应异常");
        hgImageURL = hgResult.imageURL;
        if (this.hgMounted) this.setState({ hgImageURL });
      }
      const hgResult = await HGCommerceVM.editCategory(this.state.hgOriginalId, {
        categoryId: hgCategoryId,
        name: hgName,
        parentId: hgParentId,
        imageURL: hgImageURL,
      });
      if (this.hgMounted) {
        if (this.state.hgPreview) URL.revokeObjectURL(this.state.hgPreview);
        this.setState({
          hgOriginalId: hgResult?.categoryId || hgCategoryId,
          hgCategoryId: hgResult?.categoryId || hgCategoryId,
          hgParentId: hgResult?.parentId ?? hgParentId,
          hgName: hgResult?.name || hgName,
          hgFile: null,
          hgPreview: "",
          hgImageURL: hgResult?.imageURL ?? hgImageURL,
          hgOriginalImageURL: hgResult?.imageURL ?? hgImageURL,
          hgUnused: this.state.hgUnused.filter((hgURL) => hgURL !== hgImageURL),
          hgNotice: "类目已更新",
        });
      }
    } catch (hgError) {
      if (this.hgMounted)
        this.setState({ hgError: hgError?.message || "更新失败，请重试" });
    } finally {
      this.hgFlight = false;
      if (this.hgMounted) this.setState({ hgBusy: false });
    }
  };

  renderImageField() {
    const { hgFile, hgPreview, hgImageURL, hgBusy } = this.state;
    const hgFileList = hgPreview
      ? [{ uid: "category-edit-local", name: hgFile?.name || "类目图片", status: "done", type: hgFile?.type || "image/*", originFileObj: hgFile, url: hgPreview }]
      : hgImageURL
        ? [{ uid: "category-edit-server", name: "当前类目图片", status: "done", type: "image/*", url: normalizeVideoCoverUrl(hgImageURL) }]
        : [];
    return (
      <div className={styles.field}>
        <label htmlFor="category-edit-image">类目图片（可选，JPG/PNG/WebP，最多 5 MiB）</label>
        <HGImageCrop aspect={1} outputWidth={800} rotationSlider>
          <HGUpload
            id="category-edit-image"
            accept="image/jpeg,image/png,image/webp"
            fileList={hgFileList}
            maxCount={1}
            multiple={false}
            disabled={hgBusy}
            beforeUpload={this.hgBeforeChooseImage}
            onChange={this.hgChooseImage}
            onRemove={this.hgRemoveImage}
            uploadText="选择并裁切替换图片"
          />
        </HGImageCrop>
      </div>
    );
  }

  renderUnusedImages() {
    if (!this.state.hgUnused.length) return null;
    return (
      <section className={styles.sectionBody} aria-label="未绑定的类目图片">
        <h3>可复用图片</h3>
        <div className={styles.imgGrid}>
          {this.state.hgUnused.map((hgURL) => (
            <div key={hgURL} className={styles.imgItem}>
              <img src={normalizeVideoCoverUrl(hgURL)} alt="未绑定类目图片" />
              <button type="button" className={styles.btnGhost} disabled={this.state.hgBusy} onClick={() => this.hgUseImage(hgURL)}>
                使用此图
              </button>
            </div>
          ))}
        </div>
      </section>
    );
  }

  render() {
    const { hgOriginalId, hgCategoryId, hgName, hgParentId, hgAdminCategories, hgLoaded, hgBusy, hgError, hgNotice } = this.state;
    const hgParentMissing = hgParentId && !hgAdminCategories.some((hgItem) => hgItem.categoryId === hgParentId);
    const hgHasChildren = hgAdminCategories.some((hgItem) => hgItem.parentId === hgOriginalId); // 父类目只能原位修改名称/图片，服务端会再次校验。
    return (
      <main className={styles.page} aria-label="编辑普通类目">
        {hgError && <p role="alert" className={styles.errorBar}>{hgError}</p>}
        {hgNotice && <p role="status" className={styles.noticeBar}>{hgNotice}</p>}
        <section className={styles.panel}>
          <div className={styles.head}>
            <h2>编辑普通类目</h2>
            <span className={styles.headSmall}>当前 ID：{hgOriginalId || "未知"}</span>
          </div>
          <p className={styles.desc}>父类目可修改名称和图片；有子类目时不能修改 ID 或上级。叶子类目可修改 ID、名称、上级和图片；已有商品时服务端会拒绝修改 ID。</p>
          <form className={styles.publishForm} onSubmit={this.hgSubmit}>
            <fieldset className={styles.commerceFieldset} disabled={hgBusy || !hgLoaded}>
              <legend>类目信息</legend>
              <div className={styles.field}>
                <label htmlFor="category-edit-id">类目 ID</label>
                <input id="category-edit-id" required maxLength={64} disabled={hgHasChildren} value={hgCategoryId} onChange={(hgEvent) => this.setState({ hgCategoryId: hgEvent.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="category-edit-name">类目名称</label>
                <input id="category-edit-name" required maxLength={64} value={hgName} onChange={(hgEvent) => this.setState({ hgName: hgEvent.target.value })} />
              </div>
              <div className={styles.field}>
                <label htmlFor="category-edit-parent">上级类目（可选）</label>
                <select id="category-edit-parent" value={hgParentId} disabled={hgHasChildren} onChange={(hgEvent) => this.setState({ hgParentId: hgEvent.target.value })}>
                  <option value="">一级类目（无上级）</option>
                  {hgParentMissing && <option value={hgParentId}>当前上级（ID: {hgParentId}）</option>}
                  {hgAdminCategories.filter((hgItem) => hgItem.categoryId !== hgOriginalId && hgItem.categoryId !== hgCategoryId).map((hgItem) => (
                    <option key={hgItem.categoryId} value={hgItem.categoryId}>{hgItem.name}（ID: {hgItem.categoryId}）</option>
                  ))}
                </select>
              </div>
              {this.renderImageField()}
            </fieldset>
            <div className={styles.actions}>
              <button type="submit" className={styles.btn} disabled={hgBusy || !hgLoaded}>{hgBusy ? "提交中…" : "保存修改"}</button>
              <button type="button" className={styles.btnGhost} disabled={hgBusy} onClick={this.hgBack}>返回</button>
            </div>
          </form>
          {this.renderUnusedImages()}
        </section>
      </main>
    );
  }
}

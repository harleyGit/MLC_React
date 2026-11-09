import React from "react";
import HGIconPage from "../hg_icon/hg_icon_page.jsx";
import styles from "./hg_upload.module.css";

let hgUploadUid = 0;

/**
 * 照片墙式上传组件。
 * 支持图片与普通文件、受控文件列表、上传前转换、自定义上传、图片预览和删除。
 */
export default class HGUpload extends React.Component {
  static defaultProps = {
    accept: "", // 默认允许选择任意文件；调用方可使用 input accept 语法限制类型。
    disabled: false, // 默认允许选择和操作文件。
    fileList: undefined, // 缺省时由组件内部维护列表；传入数组后切换为受控模式。
    listType: "picture-card", // 默认使用照片墙卡片布局。
    maxCount: 8, // 默认最多展示 8 个文件，达到上限后隐藏上传入口。
    multiple: true, // 默认允许一次选择多个文件。
    uploadText: "上传", // 上传卡片的默认文案。
  };

  state = {
    hgInnerFileList: this.props.defaultFileList || [], // 非受控文件列表；空数组表示尚未选择文件。
    hgPreviewItem: null, // 正在预览的图片项；null 表示预览弹窗关闭。
  };

  hgObjectURLs = new Map(); // 组件为本地文件创建的临时地址，键为文件 uid，卸载或删除时释放。
  hgInputRef = React.createRef(); // 隐藏文件输入，用于上传卡片触发系统选择器。

  componentWillUnmount() {
    this.hgObjectURLs.forEach((hgURL) => URL.revokeObjectURL(hgURL));
    this.hgObjectURLs.clear();
  }

  /** 返回当前受控或非受控文件列表。 */
  hgGetFileList = () => this.props.fileList ?? this.state.hgInnerFileList;

  /** 同步列表并向调用方报告 Ant Upload 风格的变更信息。 */
  hgChangeFileList = (hgFile, hgFileList) => {
    if (this.props.fileList === undefined) {
      this.setState({ hgInnerFileList: hgFileList });
    }
    this.props.onChange?.({ file: hgFile, fileList: hgFileList });
  };

  /** 为选择文件生成稳定展示项，图片临时地址只由本组件负责回收。 */
  hgCreateItem = (hgFile) => {
    const hgUid = `hg-upload-${Date.now()}-${hgUploadUid++}`; // 单页生命周期内稳定且唯一的列表键。
    const hgIsImage = hgFile.type.startsWith("image/"); // MIME 以 image/ 开头时提供缩略图和预览。
    const hgURL =
      hgIsImage && this.props.fileList === undefined
        ? URL.createObjectURL(hgFile)
        : ""; // 受控模式由调用方提供 URL，避免组件失去 uid 后无法及时回收地址。
    if (hgURL) this.hgObjectURLs.set(hgUid, hgURL);
    return {
      uid: hgUid,
      name: hgFile.name,
      status: "ready",
      type: hgFile.type,
      size: hgFile.size,
      originFileObj: hgFile,
      thumbUrl: hgURL,
      url: hgURL,
    };
  };

  /** 选择后依次执行 beforeUpload，允许裁切组件异步替换原始 File。 */
  hgHandleSelect = async (hgEvent) => {
    const hgSelected = Array.from(hgEvent.target.files || []); // 本次系统选择结果；取消时为空数组。
    hgEvent.target.value = "";
    if (!hgSelected.length || this.props.disabled) return;

    let hgFileList = [...this.hgGetFileList()]; // 逐个追加，确保 maxCount 在多选时同样生效。
    const hgSlots = Math.max(0, this.props.maxCount - hgFileList.length); // 本次最多可接收的剩余数量。
    for (const hgOriginalFile of hgSelected.slice(0, hgSlots)) {
      let hgFile = hgOriginalFile; // beforeUpload 可返回裁切或压缩后的 File/Blob。
      try {
        const hgBeforeResult = await this.props.beforeUpload?.(
          hgOriginalFile,
          hgSelected
        );
        if (hgBeforeResult === false) continue;
        if (hgBeforeResult instanceof Blob) {
          hgFile =
            hgBeforeResult instanceof File
              ? hgBeforeResult
              : new File([hgBeforeResult], hgOriginalFile.name, {
                  type: hgBeforeResult.type || hgOriginalFile.type,
                });
        }
      } catch (hgError) {
        this.props.onError?.(hgError, hgOriginalFile);
        continue;
      }

      const hgItem = this.hgCreateItem(hgFile); // 当前文件的展示和上传状态载体。
      hgItem.status =
        this.props.action || this.props.customRequest ? "uploading" : "done";
      hgFileList = [...hgFileList, hgItem];
      this.hgChangeFileList(hgItem, hgFileList);
      if (this.props.action || this.props.customRequest) {
        this.hgUploadFile(hgItem, hgFileList);
      }
    }
  };

  /** 执行 customRequest 或原生 fetch 上传，并更新对应卡片状态。 */
  hgUploadFile = async (hgItem, hgInitialFileList) => {
    try {
      let hgResponse; // 上传服务响应；无 action 时不会进入此方法。
      if (this.props.customRequest) {
        hgResponse = await this.props.customRequest({
          file: hgItem.originFileObj,
          filename: this.props.name || "file",
        });
      } else {
        const hgFormData = new FormData(); // 默认 multipart 字段名为 file，可由 name 覆盖。
        hgFormData.append(this.props.name || "file", hgItem.originFileObj);
        const hgResult = await fetch(this.props.action, {
          method: this.props.method || "POST",
          headers: this.props.headers,
          body: hgFormData,
          credentials: this.props.withCredentials ? "include" : "same-origin",
        });
        if (!hgResult.ok) throw new Error(`上传失败（${hgResult.status}）`);
        const hgContentType = hgResult.headers.get("content-type") || "";
        hgResponse = hgContentType.includes("application/json")
          ? await hgResult.json()
          : await hgResult.text();
      }
      this.hgUpdateItem(
        hgItem.uid,
        { status: "done", response: hgResponse },
        hgInitialFileList
      );
      this.props.onSuccess?.(hgResponse, hgItem.originFileObj);
    } catch (hgError) {
      this.hgUpdateItem(
        hgItem.uid,
        { status: "error", error: hgError },
        hgInitialFileList
      );
      this.props.onError?.(hgError, hgItem.originFileObj);
    }
  };

  /** 不可变更新单个文件，避免异步上传覆盖其他文件的列表变化。 */
  hgUpdateItem = (hgUid, hgPatch, hgFallbackFileList = []) => {
    const hgCurrentFileList = this.hgGetFileList(); // setState 尚未提交时使用刚追加的回退列表。
    const hgSourceFileList = hgCurrentFileList.some(
      (hgItem) => hgItem.uid === hgUid
    )
      ? hgCurrentFileList
      : hgFallbackFileList;
    const hgFileList = hgSourceFileList.map((hgItem) =>
      hgItem.uid === hgUid ? { ...hgItem, ...hgPatch } : hgItem
    );
    const hgFile = hgFileList.find((hgItem) => hgItem.uid === hgUid);
    if (hgFile) this.hgChangeFileList(hgFile, hgFileList);
  };

  /** 删除前允许调用方异步阻止操作，返回 false 时保留文件。 */
  hgRemove = async (hgItem) => {
    if (this.props.disabled) return;
    const hgAllowed = await this.props.onRemove?.(hgItem);
    if (hgAllowed === false) return;
    const hgFileList = this.hgGetFileList().filter(
      (hgFile) => hgFile.uid !== hgItem.uid
    );
    const hgObjectURL = this.hgObjectURLs.get(hgItem.uid); // 仅释放组件自己创建的地址。
    if (hgObjectURL) URL.revokeObjectURL(hgObjectURL);
    this.hgObjectURLs.delete(hgItem.uid);
    this.setState((hgState) => ({
      hgPreviewItem:
        hgState.hgPreviewItem?.uid === hgItem.uid
          ? null
          : hgState.hgPreviewItem,
    }));
    this.hgChangeFileList({ ...hgItem, status: "removed" }, hgFileList);
  };

  /** 图片卡片可打开原图预览；普通文件不展示预览入口。 */
  hgPreview = (hgItem) => {
    this.props.onPreview?.(hgItem);
    this.setState({ hgPreviewItem: hgItem });
  };

  renderFileItem(hgItem) {
    const hgImageURL = hgItem.url || hgItem.thumbUrl; // 远程 URL 优先，否则使用本地缩略图。
    const hgIsImage =
      hgItem.type?.startsWith("image/") || Boolean(hgImageURL); // 服务端图片可仅提供 URL。
    return (
      <div key={hgItem.uid || hgItem.url} className={styles.fileItem}>
        {hgIsImage ? (
          <img src={hgImageURL} alt={hgItem.name || "上传图片"} />
        ) : (
          <div className={styles.filePlaceholder}>
            <HGIconPage type="file" />
            <span>{hgItem.name || "文件"}</span>
          </div>
        )}
        <div className={styles.fileMask}>
          {hgIsImage && (
            <button
              type="button"
              aria-label={`预览 ${hgItem.name || "图片"}`}
              onClick={() => this.hgPreview(hgItem)}
            >
              <HGIconPage type="eye" />
            </button>
          )}
          <button
            type="button"
            aria-label={`删除 ${hgItem.name || "文件"}`}
            onClick={() => this.hgRemove(hgItem)}
          >
            <HGIconPage type="delete" />
          </button>
        </div>
        {hgItem.status === "uploading" && (
          <span className={styles.status}>上传中…</span>
        )}
        {hgItem.status === "error" && (
          <span className={`${styles.status} ${styles.statusError}`}>上传失败</span>
        )}
      </div>
    );
  }

  renderPreview() {
    const { hgPreviewItem } = this.state; // null 表示不渲染预览遮罩。
    if (!hgPreviewItem) return null;
    return (
      <div
        className={styles.previewOverlay}
        role="dialog"
        aria-modal="true"
        aria-label="图片预览"
        onClick={() => this.setState({ hgPreviewItem: null })}
      >
        <button
          type="button"
          className={styles.previewClose}
          aria-label="关闭预览"
          onClick={() => this.setState({ hgPreviewItem: null })}
        >
          <HGIconPage type="close" />
        </button>
        <img
          src={hgPreviewItem.url || hgPreviewItem.thumbUrl}
          alt={hgPreviewItem.name || "原图预览"}
          onClick={(hgEvent) => hgEvent.stopPropagation()}
        />
      </div>
    );
  }

  render() {
    const hgFileList = this.hgGetFileList(); // 当前展示列表，达到上限后隐藏上传卡片。
    const hgCanUpload =
      !this.props.disabled && hgFileList.length < this.props.maxCount;
    return (
      <div className={styles.upload} data-list-type={this.props.listType}>
        <div className={styles.list}>
          {hgFileList.map((hgItem) => this.renderFileItem(hgItem))}
          {hgCanUpload && (
            <button
              type="button"
              className={styles.uploadButton}
              onClick={() => this.hgInputRef.current?.click()}
            >
              <HGIconPage type="plus" />
              <span>{this.props.children || this.props.uploadText}</span>
            </button>
          )}
        </div>
        <input
          ref={this.hgInputRef}
          id={this.props.id}
          className={styles.hiddenInput}
          type="file"
          accept={this.props.accept}
          multiple={this.props.multiple && this.props.maxCount > 1}
          disabled={this.props.disabled}
          onChange={this.hgHandleSelect}
        />
        {this.renderPreview()}
      </div>
    );
  }
}

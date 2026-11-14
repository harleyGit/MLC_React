import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGFileManagementVM, { SCENE_OPTIONS } from "./hg_file_management_vm";
import HGFileListPage from "./file_list/hg_file_list_page";
import styles from "./hg_file_management.module.css";

/** 仅以当前登录人身份创建隔离上传；业务引用需由各业务服务单独授权。 */
class HGFileManagementPage extends Component {
  state = {
    purpose: "", // 必选的后端业务用途；空字符串禁止提交。
    selectedFiles: [], // 当前待传文件，最多 20 个；清空或上传后不保留对象字节。
    uploading: false, // 顺序上传期间为 true，防止重复提交。
    assetIDs: [], // 本次页面会话已创建的资源 ID，可能仍处于 pending；不是持久列表。
  };
  fileInputRef = React.createRef(); // 原生文件选择器；不在表单中保存 File 内容。
  hgListRef = React.createRef(); // 完成确认后立即刷新刚创建的资源状态。
  hgMounted = false; // 卸载后禁止更新页面，不能把未完成上传宣称成功。
  hgAbort = null; // 当前顺序上传的取消信号；卸载时中断未完成的网络请求。

  componentDidMount() { this.hgMounted = true; }
  componentWillUnmount() { this.hgMounted = false; this.hgAbort?.abort(); }

  /** 切换用途后丢弃不符合新用途的候选文件。 */
  handlePurpose = (purpose) => {
    this.setState({ purpose: purpose || "", selectedFiles: [] });
  };

  handleFiles = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length > 20) { message.error("每次最多选择 20 个文件"); return; }
    try {
      files.forEach((file) => HGFileManagementVM.validateFile(file, this.state.purpose));
      this.setState({ selectedFiles: files });
    } catch (error) { message.error(error.message); }
  };

  /** 不并行摘要或 PUT；单个失败即停止，已完成的资源仍可点查审核状态。 */
  handleUpload = async () => {
    const { selectedFiles, purpose, uploading } = this.state;
    if (uploading || !selectedFiles.length) return;
    this.hgAbort = new AbortController();
    this.setState({ uploading: true });
    try {
      for (const file of selectedFiles) {
        const assetID = await HGFileManagementVM.uploadFile(file, purpose, (createdID) => {
          if (this.hgMounted) this.setState((state) => ({ assetIDs: [...state.assetIDs, createdID].slice(-20) }));
        }, this.hgAbort.signal);
        if (!this.hgMounted) return;
        this.hgListRef.current?.loadAsset(assetID);
      }
      if (this.hgMounted) { message.success("已提交审核；审核通过前不可预览或引用"); this.setState({ selectedFiles: [] }); }
    } catch (error) {
      if (this.hgMounted && error.name !== "AbortError") message.error(error.message || "上传未完成，请按资源 ID 核对状态");
    } finally { if (this.hgMounted) this.setState({ uploading: false }); this.hgAbort = null; }
  };

  renderUploadForm() {
    const { purpose, selectedFiles, uploading, assetIDs } = this.state;
    return <div className={styles.uploadSection}>
      <h3 className={styles.uploadSectionTitle}>本人隔离上传</h3>
      <p>指定真实业务用途；上传完成仅进入审核，不会替任何用户修改头像、商品或视频。</p>
      <HGSelectPage placeholder="请选择业务用途" value={purpose || undefined} onChange={this.handlePurpose}
        options={SCENE_OPTIONS.map(({ value, label }) => ({ value, label }))} />
      <input ref={this.fileInputRef} type="file" multiple accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,application/pdf"
        onChange={this.handleFiles} disabled={!purpose || uploading} style={{ display: "none" }} />
      <div className={styles.uploadArea}>
        <HGButtonPage onClick={() => this.fileInputRef.current?.click()} disabled={!purpose || uploading}>选择文件</HGButtonPage>
        {selectedFiles.map((file, index) => <div key={`${file.name}-${index}`}>
          {file.name}（{HGFileManagementVM.formatFileSize(file.size)}）
        </div>)}
      </div>
      <div className={styles.submitRow}>
        <HGButtonPage type="primary" onClick={this.handleUpload} disabled={!purpose || !selectedFiles.length || uploading} loading={uploading}>提交审核</HGButtonPage>
        <HGButtonPage onClick={() => this.setState({ selectedFiles: [] })} disabled={uploading}>清空选择</HGButtonPage>
      </div>
      {assetIDs.length > 0 && <div className={styles.fileInfo}>
        <p>本次页面会话已创建的资源 ID（请自行记录；失败时也可能仍是待上传状态）：</p>
        {assetIDs.map((id) => <div key={id}>{id}</div>)}
      </div>}
    </div>;
  }

  render() {
    return <div className={styles.fileManagementContainer}>
      <h2 className={styles.formTitle}>文件管理</h2>
      {this.renderUploadForm()}
      <HGFileListPage ref={this.hgListRef} hgAssetIDs={this.state.assetIDs} hgEmbedded />
    </div>;
  }
}

export default HGFileManagementPage;

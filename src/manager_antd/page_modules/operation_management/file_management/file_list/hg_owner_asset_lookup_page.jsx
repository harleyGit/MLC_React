import React, { Component } from "react";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGInputPage from "../../../../../components/hg_input/hg_input_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGFileManagementVM from "../hg_file_management_vm";
import styles from "./hg_file_list.module.css";

/** 独立或嵌入上传页点查本人资源，不需要全平台盘点权限。 */
class HGOwnerAssetLookupPage extends Component {
  static defaultProps = {
    hgAssetIDs: [], // 上传页注入当前会话创建的 UUID 列表；缺省为空，不自动点查。
    hgEmbedded: false, // 缺省使用独立页外边距；嵌入上传页时取消外边距。
  };

  state = {
    assetID: "", // 手动输入的本人资源 UUID，空时不发请求。
    ownerAsset: null, // 最近一次本人点查结果，null 表示暂无可展示数据。
    ownerLoading: false, // 正在查询时禁用重复提交。
  };
  hgMounted = false; // 卸载后不再更新界面。
  hgOwnerRequest = 0; // 点查序号；完成确认以更新的请求覆盖初始化状态。

  componentDidMount() {
    this.hgMounted = true;
  }

  componentWillUnmount() {
    this.hgMounted = false;
    this.hgOwnerRequest += 1;
  }

  componentDidUpdate(prevProps) {
    const newest = this.props.hgAssetIDs.at(-1); // 最新创建的资源；没有上传时为 undefined。
    if (newest && newest !== prevProps.hgAssetIDs.at(-1)) this.loadAsset(newest);
  }

  /** 沿用本人资源授权；上传失败仍可手动点查后端实际状态。 */
  loadAsset = async (assetID) => {
    if (!assetID) return;
    const request = ++this.hgOwnerRequest; // 仅最新点查可更新结果。
    this.setState({ ownerLoading: true, ownerAsset: null });
    try {
      const asset = await HGFileManagementVM.getAsset(assetID.trim());
      if (this.hgMounted && request === this.hgOwnerRequest) this.setState({ ownerAsset: asset });
    } catch (error) {
      if (this.hgMounted && request === this.hgOwnerRequest)
        message.error(error.message || "无法查询本人资源状态");
    } finally {
      if (this.hgMounted && request === this.hgOwnerRequest) this.setState({ ownerLoading: false });
    }
  };

  handlePreview = async (asset) => {
    try {
      await HGFileManagementVM.previewImage(asset);
    } catch (error) {
      if (this.hgMounted) message.error(error.message || "预览不可用");
    }
  };

  renderOwnerLookup() {
    const { assetID, ownerAsset, ownerLoading } = this.state;
    return (
      <div className={styles.filterBar}>
        <HGInputPage
          placeholder="按资源 ID 点查本人文件（UUID）"
          value={assetID}
          onChange={(event) => this.setState({ assetID: event?.target ? event.target.value : event })}
        />
        <HGButtonPage onClick={() => this.loadAsset(assetID)} disabled={ownerLoading || !assetID.trim()}>
          查询本人资源
        </HGButtonPage>
        {ownerAsset && (
          <span>
            本人资源：{ownerAsset.asset_id}（{ownerAsset.status}）
            {HGFileManagementVM.canPreviewImage(ownerAsset) && (
              <HGButtonPage onClick={() => this.handlePreview(ownerAsset)}>申请本人预览</HGButtonPage>
            )}
          </span>
        )}
      </div>
    );
  }

  render() {
    return (
      <section className={`${styles.fileListContainer} ${this.props.hgEmbedded ? styles.embedded : ""}`}>
        <h2 className={styles.pageTitle}>本人资源查询</h2>
        {this.renderOwnerLookup()}
      </section>
    );
  }
}

export default HGOwnerAssetLookupPage;

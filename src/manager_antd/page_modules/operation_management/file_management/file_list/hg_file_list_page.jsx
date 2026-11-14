import React, { Component } from "react";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGInputPage from "../../../../../components/hg_input/hg_input_page";
import HGSelectPage from "../../../../../components/hg_select/hg_select_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGFileManagementVM, { SCENE_OPTIONS } from "../hg_file_management_vm";
import styles from "./hg_file_list.module.css";

const hgKindOptions = [
  { value: "", label: "全部种类" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
  { value: "file", label: "文件" },
]; // 服务端在游标分页前按类别筛选，不能只筛本页结果。

const hgSourceLabels = {
  new: "新媒体", legacy_mall: "旧商城图片", legacy_video: "旧视频文件",
  legacy_avatar: "旧用户头像", legacy_im: "旧 IM 私有附件",
}; // 旧来源仅允许查看元数据；不提供预览、删除或业务引用。

/** 管理端元数据盘点：独立 IAM 权限，固定来源顺序逐来源主键游标，不查询旧文件字节。 */
class HGFileListPage extends Component {
  static defaultProps = {
    hgAssetIDs: [], // 独立列表页没有刚上传的资源，默认空数组。
    hgEmbedded: false, // 默认独立页面；嵌入文件管理页时取消重复的外边距。
  };
  state = {
    kind: "", // 空字符串表示全部种类；其它值为 image/video/audio/file。
    items: [], // 后端返回的当前页最多 20 条元数据；不缓存全站文件。
    cursors: [""], // 最近至多 100 页的入口游标；切换种类后清空。
    historyBase: 0, // cursors[0] 对应的绝对页码，避免深分页时内存无限增长。
    pageIndex: 0, // 当前绝对页码从 0 开始，可继续向后翻至完整来源末尾。
    nextCursor: "", // 为空表示当前筛选范围已遍历到底。
    loading: false, // 列表请求中禁用重复翻页。
    error: "", // 列表查询错误；有错时不展示过期结果。
    assetID: "", // 单独点查本人资源的 UUID；不改变管理员列表的过滤条件。
    ownerAsset: null, // 本人点查结果；null 表示尚未查到，不提供跨用户预览。
    ownerLoading: false, // 本人点查期间禁止重复点击。
  };
  hgMounted = false; // 页面卸载后停止状态更新。
  hgRequest = 0; // 最新列表请求序号，避免旧响应覆盖新筛选。
  hgAbort = null; // 当前列表请求取消信号；切换筛选或卸载时中断。
  hgOwnerRequest = 0; // 本人点查序号，避免旧响应覆盖新 ID。

  componentDidMount() {
    this.hgMounted = true;
    this.loadInventory("", "", 0);
  }
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgAbort?.abort();
    this.hgRequest += 1;
    this.hgOwnerRequest += 1;
  }

  componentDidUpdate(prevProps) {
    const newest = this.props.hgAssetIDs.at(-1);
    if (newest && newest !== prevProps.hgAssetIDs.at(-1)) this.loadAsset(newest);
  }

  /** 列表由服务端先过滤再分页；任何失败均清空旧结果，不将其伪装成当前类别。 */
  loadInventory = async (kind, cursor, pageIndex) => {
    this.hgAbort?.abort();
    this.hgAbort = new AbortController();
    const request = ++this.hgRequest;
    this.setState((state) => ({
      kind, loading: true, error: "", items: [], nextCursor: "", pageIndex,
      cursors: (pageIndex > 0 && kind === state.kind ? [...state.cursors.slice(0, pageIndex - state.historyBase), cursor] : [cursor]).slice(-100),
      historyBase: pageIndex > 0 && kind === state.kind ? Math.max(state.historyBase, pageIndex - 99) : 0,
    }));
    try {
      const result = await HGFileManagementVM.getInventory(kind, cursor, this.hgAbort.signal);
      if (this.hgMounted && request === this.hgRequest) this.setState({
        items: result.items, nextCursor: result.next_cursor,
      });
    } catch (error) {
      if (this.hgMounted && request === this.hgRequest && error.name !== "AbortError") {
        this.setState({ error: error.message || "媒体列表暂不可用" });
      }
    } finally {
      if (this.hgMounted && request === this.hgRequest) this.setState({ loading: false });
    }
  };

  /** 仅本人已审核资源可申请有限预览，管理员列表不会转交任何私有读取权限。 */
  loadAsset = async (assetID) => {
    if (!assetID) return;
    const request = ++this.hgOwnerRequest;
    this.setState({ ownerLoading: true, ownerAsset: null });
    try {
      const asset = await HGFileManagementVM.getAsset(assetID.trim());
      if (this.hgMounted && request === this.hgOwnerRequest) this.setState({ ownerAsset: asset });
    } catch (error) {
      if (this.hgMounted && request === this.hgOwnerRequest) message.error(error.message || "无法查询本人资源状态");
    } finally {
      if (this.hgMounted && request === this.hgOwnerRequest) this.setState({ ownerLoading: false });
    }
  };

  handlePreview = async (asset) => {
    try { await HGFileManagementVM.previewImage(asset); }
    catch (error) { if (this.hgMounted) message.error(error.message || "预览不可用"); }
  };

  renderFilters() {
    const { kind, loading, pageIndex, historyBase, cursors, nextCursor } = this.state;
    return <div className={styles.filterBar}>
      <label>媒体种类 <HGSelectPage value={kind} options={hgKindOptions}
        onChange={(value) => this.loadInventory(value || "", "", 0)} disabled={loading} /></label>
      <HGButtonPage onClick={() => this.loadInventory(kind, cursors[pageIndex - historyBase], pageIndex)} disabled={loading}>刷新</HGButtonPage>
      <div className={styles.pagination}>
        <HGButtonPage disabled={loading || pageIndex === historyBase}
          onClick={() => this.loadInventory(kind, cursors[pageIndex - 1 - historyBase], pageIndex - 1)}>上一页</HGButtonPage>
        <span className={styles.paginationInfo}>第 {pageIndex + 1} 页</span>
        <HGButtonPage disabled={loading || !nextCursor}
          onClick={() => this.loadInventory(kind, nextCursor, pageIndex + 1)}>下一页</HGButtonPage>
      </div>
    </div>;
  }

  renderInventory() {
    const { items, loading, error } = this.state;
    if (loading) return <div className={styles.emptyState} role="status">正在加载媒体元数据...</div>;
    if (error) return <div className={styles.emptyState} role="alert">{error}</div>;
    if (!items.length) return <div className={styles.emptyState}>当前范围没有更多媒体记录。</div>;
    return <div className={styles.tableContainer}><table className={styles.fileTable}>
      <thead><tr className={styles.tableHeaderRow}>
        <th className={styles.thCell}>来源</th><th className={styles.thCell}>来源内 ID</th>
        <th className={styles.thCell}>种类</th><th className={styles.thCell}>业务用途</th>
        <th className={styles.thCell}>声明类型</th><th className={styles.thCell}>登记大小</th>
        <th className={styles.thCell}>状态</th>
      </tr></thead><tbody>{items.map((item) => <tr key={`${item.source}:${item.id}`} className={styles.trRow}>
        <td className={styles.tdCell}>{hgSourceLabels[item.source]}</td>
        <td className={styles.tdCell} title={item.id}>{item.id}</td>
        <td className={styles.tdCell}>{hgKindOptions.find((option) => option.value === item.kind)?.label || item.kind}</td>
        <td className={styles.tdCell}>{SCENE_OPTIONS.find((option) => option.value === item.purpose)?.label || item.purpose}</td>
        <td className={styles.tdCell}>{item.mime_type || "未登记"}</td>
        <td className={styles.tdCell}>{item.file_size ? HGFileManagementVM.formatFileSize(item.file_size) : "未知"}</td>
        <td className={styles.tdCell}>{item.status?.startsWith("legacy:") ? `旧链路：${item.status.slice(7)}` : item.status}</td>
      </tr>)}</tbody></table></div>;
  }

  renderOwnerLookup() {
    const { assetID, ownerAsset, ownerLoading } = this.state;
    return <div className={styles.filterBar}>
      <HGInputPage placeholder="按资源 ID 点查本人文件（UUID）" value={assetID}
        onChange={(event) => this.setState({ assetID: event?.target ? event.target.value : event })} />
      <HGButtonPage onClick={() => this.loadAsset(assetID)} disabled={ownerLoading || !assetID.trim()}>查询本人资源</HGButtonPage>
      {ownerAsset && <span>本人资源：{ownerAsset.asset_id}（{ownerAsset.status}）
        {ownerAsset.status === "ready" && ownerAsset.mime_type?.startsWith("image/") &&
          <HGButtonPage onClick={() => this.handlePreview(ownerAsset)}>申请本人预览</HGButtonPage>}
      </span>}
    </div>;
  }

  render() {
    return <div className={`${styles.fileListContainer} ${this.props.hgEmbedded ? styles.embedded : ""}`}>
      <h2 className={styles.pageTitle}>媒体资源盘点</h2>
      <p className={styles.pageDesc}>盘点新媒体与已登记的旧 IM、头像、商城图片、视频元数据。来源按固定顺序逐表分页；旧文件未迁移，任何状态都不代表可跨用户预览或删除。</p>
      {this.renderFilters()}
      {this.renderInventory()}
      {this.renderOwnerLookup()}
    </div>;
  }
}

export default HGFileListPage;

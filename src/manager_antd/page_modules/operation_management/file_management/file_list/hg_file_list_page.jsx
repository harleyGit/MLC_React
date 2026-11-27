import React, { Component } from "react";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../../components/hg_modal/hg_modal_page";
import HGSelectPage from "../../../../../components/hg_select/hg_select_page";
import HGTablePage from "../../../../../components/hg_table/hg_table_page";
import { hgTableColumns, hgTableProps } from "../../../../../components/hg_table/hg_table_contract";
import { hgEvaluateAccess } from "../../../../../modules/iam/hg_access_evaluator";
import { HGIAMContext } from "../../../../../modules/iam/hg_iam_provider";
import { HG_PERMISSIONS } from "../../../../../modules/iam/hg_permission_codes";
import HGFileManagementVM, { HG_MEDIA_INVENTORY_PAGE_SIZE, SCENE_OPTIONS } from "../hg_file_management_vm";
import styles from "./hg_file_list.module.css";

// 最多保留最近 100 页的入口游标，不缓存全站记录。
const hgCursorHistoryLimit = 100;

const hgKindOptions = [
  { value: "", label: "全部种类" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "audio", label: "音频" },
  { value: "file", label: "文件" },
]; // 服务端在游标分页前按类别筛选，不能只筛本页结果。

const hgSourceLabels = {
  new: "新媒体",
  legacy_mall: "旧商城图片",
  legacy_video: "旧视频文件",
  legacy_avatar: "旧用户头像",
  legacy_im: "旧 IM 私有附件",
}; // 旧来源仅允许查看元数据；不提供预览、删除或业务引用。

/** 独立盘点页；每行可查看元数据，预览和删除仅针对独立授权的新媒体。 */
class HGFileListPage extends Component {
  static contextType = HGIAMContext; // 控制操作入口；最终由后端逐请求重新授权。

  state = {
    kind: "", // 空字符串表示全部种类；其它值为 image/video/audio/file。
    items: [], // 后端返回的当前页最多 20 条元数据；不缓存全站文件。
    cursors: [""], // 最近至多 100 页的入口游标；切换种类后清空。
    historyBase: 0, // cursors[0] 对应的绝对页码，避免深分页时内存无限增长。
    pageIndex: 0, // 当前绝对页码从 0 开始，可继续向后翻至完整来源末尾。
    nextCursor: "", // 为空表示当前筛选范围已遍历到底。
    loading: true, // 首次挂载或列表请求中禁用重复翻页。
    error: "", // 列表查询错误；有错时不展示过期结果。
    preview: null, // 当前弹窗的数据；null 表示关闭，URL 只保留在打开的弹窗中。
    detail: null, // 正在查看的记录元数据；null 表示详情弹窗关闭。
    deleteTarget: null, // 待二次确认的单个新资源；null 表示未选择。
    deleting: false, // 正在提交删除，禁止翻页、退出确认弹窗或重复提交。
    deleteError: "", // 删除失败提示；空字符串表示尚无错误。
    previewAvailable: false, // 后端启用预览签名；仍须检查独立授权及记录状态。
    deleteAvailable: false, // 后端启用异步清理；仍须检查独立授权及记录状态。
  };
  hgMounted = false; // 页面卸载后停止状态更新。
  hgRequest = 0; // 最新列表请求序号，避免旧响应覆盖新筛选。
  hgAbort = null; // 当前列表请求取消信号；切换筛选或卸载时中断。
  hgPreviewAbort = null; // 当前预览请求；关闭、翻页或卸载时取消并清理签名。

  componentDidMount() {
    this.hgMounted = true;
    this.loadInventory("", "", 0);
  }
  componentWillUnmount() {
    this.hgMounted = false;
    this.hgAbort?.abort();
    this.hgRequest += 1;
    this.hgPreviewAbort?.abort();
  }

  /** 列表由服务端先过滤再分页；任何失败均清空旧结果，不将其伪装成当前类别。 */
  loadInventory = async (kind, cursor, pageIndex) => {
    if (this.state.deleting) return;
    this.closePreview();
    this.hgAbort?.abort();
    this.hgAbort = new AbortController();
    const request = ++this.hgRequest; // 只接收本次请求的结果和错误。
    this.setState((state) => ({
      kind,
      loading: true,
      error: "",
      items: [],
      nextCursor: "",
      detail: null,
      deleteTarget: null,
      pageIndex,
      cursors: (pageIndex > 0 && kind === state.kind
        ? [...state.cursors.slice(0, pageIndex - state.historyBase), cursor]
        : [cursor]
      ).slice(-hgCursorHistoryLimit),
      historyBase:
        pageIndex > 0 && kind === state.kind
          ? Math.max(state.historyBase, pageIndex - hgCursorHistoryLimit + 1)
          : 0,
    }));
    try {
      const result = await HGFileManagementVM.getInventory(
        kind,
        cursor,
        this.hgAbort.signal
      );
      if (this.hgMounted && request === this.hgRequest)
        this.setState({
          items: result.items,
          nextCursor: result.next_cursor,
          previewAvailable: result.preview_available === true,
          deleteAvailable: result.delete_available === true,
        });
    } catch (error) {
      if (
        this.hgMounted &&
        request === this.hgRequest &&
        error.name !== "AbortError"
      ) {
        this.setState({ error: error.message || "媒体列表暂不可用" });
      }
    } finally {
      if (this.hgMounted && request === this.hgRequest)
        this.setState({ loading: false });
    }
  };

  /** 表格回调为 1 基页码，只接受相邻且有入口游标的页。 */
  handlePageChange = ({ current }) => {
    const { kind, pageIndex, cursors, historyBase, nextCursor, loading } = this.state;
    if (loading) return;
    const target = current - 1; // 组件内部的 0 基页码。
    if (target === pageIndex + 1 && nextCursor)
      return this.loadInventory(kind, nextCursor, target);
    if (target === pageIndex - 1 && target >= historyBase)
      return this.loadInventory(kind, cursors[target - historyBase], target);
  };

  closePreview = () => {
    this.hgPreviewAbort?.abort();
    this.hgPreviewAbort = null;
    this.setState({ preview: null });
  };

  /** IAM 快照只预判可见入口，状态和引用可能在交互期间变化。 */
  canUsePermission = (permission) => hgEvaluateAccess(this.context?.snapshot, { permission }).allowed;

  canPreview = (item) => this.state.previewAvailable && this.canUsePermission(HG_PERMISSIONS.MEDIA_ASSET_PREVIEW) &&
    HGFileManagementVM.canAdminActOn(item) && item.status === "ready" && ["image", "video", "audio"].includes(item.kind);

  canDelete = (item) => this.state.deleteAvailable && this.canUsePermission(HG_PERMISSIONS.MEDIA_ASSET_DELETE) &&
    HGFileManagementVM.canAdminActOn(item) && ["ready", "failed"].includes(item.status);

  /** 只传新媒体标识，服务端重新核验归属、审核状态和用途。 */
  handlePreview = async (item) => {
    if (!this.canPreview(item)) return;
    this.closePreview();
    const abort = new AbortController(); // 仅这个弹窗可接收本次签名结果。
    this.hgPreviewAbort = abort;
    this.setState({ preview: { kind: item.kind } });
    try {
      const url = await HGFileManagementVM.getAdminPreview(item, abort.signal);
      if (!abort.signal.aborted) this.setState({ preview: { url, kind: item.kind } });
    } catch (error) {
      if (!abort.signal.aborted) this.setState({ preview: { error: error.message || "资源暂不可预览。音视频须为本人未绑定的已审核上传。" } });
    }
  };

  /** 忽略已经关闭或替换的媒体加载错误，避免晚到事件重新打开弹窗。 */
  handleMediaError = (url) => {
    this.setState(({ preview }) => preview?.url === url
      ? { preview: { error: "媒体暂不可用、授权已过期或浏览器不支持此格式。请关闭后重新预览。" } }
      : null);
  };

  closeDelete = () => {
    if (!this.state.deleting) this.setState({ deleteTarget: null, deleteError: "" });
  };

  /** 二次确认后才发起请求；超时不自动重提，服务端会按资产状态去重。 */
  handleDelete = async () => {
    const { deleteTarget, deleting } = this.state; // 仅提交打开确认前选定的记录。
    if (!deleteTarget || deleting || !this.canDelete(deleteTarget)) return;
    this.setState({ deleting: true, deleteError: "" });
    try {
      const result = await HGFileManagementVM.requestAdminDelete(deleteTarget);
      if (!this.hgMounted) return;
      this.setState(({ items }) => ({
        deleteTarget: null,
        items: items.map((item) => item.source === "new" && item.id === result.asset_id
          ? { ...item, status: result.status }
          : item),
      }));
      message.success(result.status === "deleted" ? "资源已清理" : "已提交删除，等待后台清理");
    } catch (error) {
      if (this.hgMounted) this.setState({ deleteError: error.message || "未能确认删除结果，请重新进入列表核对状态。" });
    } finally {
      if (this.hgMounted) this.setState({ deleting: false });
    }
  };

  renderFilters() {
    const { kind, deleting } = this.state; // 空字符串表示全部种类，切换时重新从第一页请求。
    return (
      <div className={styles.filterBar}>
        <label>
          媒体种类{" "}
          <HGSelectPage
            value={kind}
            options={hgKindOptions}
            disabled={deleting}
            onChange={(value) => this.loadInventory(value || "", "", 0)}
          />
        </label>
      </div>
    );
  }

  renderActionHint() {
    const { loading, error, previewAvailable, deleteAvailable } = this.state;
    if (loading || error) return null;
    // 区分存储未启用与有盘点权限但缺操作授权，避免操作列只剩详情时无从排查。
    const previewHint = !previewAvailable ? "当前环境未启用媒体预览。" :
      !this.canUsePermission(HG_PERMISSIONS.MEDIA_ASSET_PREVIEW) ? "当前账号没有媒体预览权限。" : "";
    const deleteHint = !deleteAvailable ? "当前环境未启用媒体清理。" :
      !this.canUsePermission(HG_PERMISSIONS.MEDIA_ASSET_DELETE) ? "当前账号没有媒体删除权限。" : "";
    if (!previewHint && !deleteHint) return null;
    return <p className={styles.pageDesc}>{previewHint} {deleteHint}</p>;
  }

  renderActions(item) {
    return (
      <div className={styles.rowActions}>
        <HGButtonPage size="small" onClick={() => this.setState({ detail: item })}>详情</HGButtonPage>
        {this.canPreview(item) && <HGButtonPage size="small" onClick={() => this.handlePreview(item)}>预览</HGButtonPage>}
        {this.canDelete(item) && <HGButtonPage size="small" danger
          onClick={() => this.setState({ deleteTarget: item, deleteError: "" })}>删除</HGButtonPage>}
      </div>
    );
  }

  /** 操作放在首列，窄屏不必先拖动横向滚动条。 */
  hgColumns = hgTableColumns([
    { title: "操作", key: "action", width: 206, render: (_, item) => this.renderActions(item) },
    { title: "来源", dataIndex: "source", width: 124, render: (value) => hgSourceLabels[value] },
    { title: "来源内 ID", dataIndex: "id", width: 292, align: "left" },
    { title: "种类", dataIndex: "kind", width: 74, render: (value) => hgKindOptions.find((option) => option.value === value)?.label || value },
    { title: "业务用途", dataIndex: "purpose", minWidth: 130, render: (value) => SCENE_OPTIONS.find((option) => option.value === value)?.label || value },
    { title: "声明类型", dataIndex: "mime_type", minWidth: 140, render: (value) => value || "未登记" },
    { title: "登记大小", dataIndex: "file_size", width: 100, render: (value) => (value ? HGFileManagementVM.formatFileSize(value) : "未知") },
    { title: "状态", dataIndex: "status", minWidth: 110, render: (value) => (value?.startsWith("legacy:") ? `旧链路：${value.slice(7)}` : value) },
  ]);

  renderInventory() {
    const { kind, items, loading, error, pageIndex, historyBase, cursors, nextCursor, deleting } = this.state;
    return (
      <>
        {error && <div className={styles.filterBar} role="alert">
          <span>{error}</span>
          <HGButtonPage onClick={() => this.loadInventory(kind, cursors[pageIndex - historyBase], pageIndex)}>
            重试
          </HGButtonPage>
        </div>}
        <HGTablePage {...hgTableProps({
          columns: this.hgColumns,
          dataSource: items,
          rowKey: (item) => `${item.source}:${item.id}`, // 不同来源的 ID 可能相同。
          loading,
          pagination: {
            mode: "cursor",
            current: pageIndex + 1,
            pageSize: HG_MEDIA_INVENTORY_PAGE_SIZE,
            hasPreviousPage: !deleting && pageIndex > historyBase,
            hasNextPage: !deleting && Boolean(nextCursor),
          },
          onChange: this.handlePageChange,
        })} />
      </>
    );
  }

  renderPreview() {
    const { preview } = this.state; // 未授权或已关闭时不挂载任何媒体 URL。
    if (!preview) return null;
    return (
      <HGModalPage visible title="媒体预览" onClose={this.closePreview} cancelText="关闭" onCancel={this.closePreview}>
        {this.renderPreviewBody(preview)}
      </HGModalPage>
    );
  }

  renderPreviewBody({ url, kind, error }) {
    if (error) return <p role="alert">{error}</p>;
    if (!url) return <p role="status">正在申请预览…</p>;
    const onError = () => this.handleMediaError(url); // 只处理当前临时地址的失败。
    if (kind === "video") return <video className={styles.previewMedia} src={url} controls playsInline preload="metadata" onError={onError} aria-label="视频预览" />;
    if (kind === "audio") return <audio className={styles.previewMedia} src={url} controls preload="metadata" onError={onError} aria-label="音频预览" />;
    return <img className={styles.previewMedia} src={url} alt="已审核图片预览" referrerPolicy="no-referrer" onError={onError} />;
  }

  renderDetail() {
    const { detail } = this.state; // 本行的既有元数据，不请求任何旧对象地址。
    if (!detail) return null;
    const close = () => this.setState({ detail: null }); // 仅关闭只读详情。
    return (
      <HGModalPage visible title="资源详情" onClose={close} cancelText="关闭" onCancel={close}>
        <dl className={styles.details}>
          {this.hgColumns.filter((column) => column.dataIndex).map((column) => {
            const value = detail[column.dataIndex]; // 与列表复用标题和值的格式。
            return <div key={column.dataIndex}><dt>{column.title}</dt><dd>{column.render ? column.render(value, detail) : value}</dd></div>;
          })}
        </dl>
        {detail.source !== "new" && <p>旧链路资源仅可查看详情，需从所属业务入口处理。</p>}
      </HGModalPage>
    );
  }

  renderDelete() {
    const { deleteTarget, deleting, deleteError } = this.state;
    if (!deleteTarget) return null;
    return (
      <HGModalPage visible title="确认删除资源" closable={!deleting} onClose={this.closeDelete}
        footer={<div className={styles.rowActions}>
          <HGButtonPage disabled={deleting} onClick={this.closeDelete}>取消</HGButtonPage>
          <HGButtonPage danger loading={deleting} disabled={!this.canDelete(deleteTarget)}
            onClick={this.handleDelete}>提交删除</HGButtonPage>
        </div>}>
        <p>资源 ID：{deleteTarget.id}</p>
        <p>若资源未被业务引用且不在保护期，提交后将无法再引用，并由后台延时清理。</p>
        {deleteError && <p role="alert">{deleteError}</p>}
      </HGModalPage>
    );
  }

  render() {
    return (
      <>
        {this.renderFilters()}
        {this.renderActionHint()}
        {this.renderInventory()}
        {this.renderPreview()}
        {this.renderDetail()}
        {this.renderDelete()}
      </>
    );
  }
}

export default HGFileListPage;

import React, { Component } from "react";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGModalPage from "../../../../../components/hg_modal/hg_modal_page";
import HGSelectPage from "../../../../../components/hg_select/hg_select_page";
import HGTablePage from "../../../../../components/hg_table/hg_table_page";
import { hgTableColumns, hgTableProps } from "../../../../../components/hg_table/hg_table_contract";
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

/** 独立盘点页的表格及筛选；旧记录只读，新图片预览仍走原上传者授权。 */
class HGFileListPage extends Component {
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
  };
  hgMounted = false; // 页面卸载后停止状态更新。
  hgRequest = 0; // 最新列表请求序号，避免旧响应覆盖新筛选。
  hgAbort = null; // 当前列表请求取消信号；切换筛选或卸载时中断。
  hgPreviewAbort = null; // 当前本人预览请求；关闭、翻页或卸载时取消并清理签名。

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

  /** 只传 UUID，服务端重新核验本人归属、审核状态和用途；列表权限不能换取私有链接。 */
  handlePreview = async (item) => {
    if (item.source !== "new" || !HGFileManagementVM.canPreviewImage(item)) return;
    this.closePreview();
    const abort = new AbortController(); // 仅这个弹窗可接收本次签名结果。
    this.hgPreviewAbort = abort;
    this.setState({ preview: {} });
    try {
      const url = await HGFileManagementVM.getImagePreviewURL(item.id, abort.signal);
      if (!abort.signal.aborted) this.setState({ preview: { url } });
    } catch {
      if (!abort.signal.aborted) this.setState({ preview: { error: "无法预览。图片须属于当前登录人且已通过审核。" } });
    }
  };

  /** 忽略已经关闭或替换的预览图片错误，避免晚到事件重新打开弹窗。 */
  handlePreviewImageError = (url) => {
    this.setState(({ preview }) => preview?.url === url
      ? { preview: { error: "图片暂不可用，请关闭后重新申请预览。" } }
      : null);
  };

  renderFilters() {
    const { kind } = this.state; // 空字符串表示全部种类，切换时重新从第一页请求。
    return (
      <div className={styles.filterBar}>
        <label>
          媒体种类{" "}
          <HGSelectPage
            value={kind}
            options={hgKindOptions}
            onChange={(value) => this.loadInventory(value || "", "", 0)}
          />
        </label>
      </div>
    );
  }

  /** 表格对新旧来源统一展示元数据；仅在原授权策略允许的记录上展示本人预览入口。 */
  hgColumns = hgTableColumns([
    { title: "来源", dataIndex: "source", width: 124, render: (value) => hgSourceLabels[value] },
    { title: "来源内 ID", dataIndex: "id", width: 292, align: "left" },
    { title: "种类", dataIndex: "kind", width: 74, render: (value) => hgKindOptions.find((option) => option.value === value)?.label || value },
    { title: "业务用途", dataIndex: "purpose", minWidth: 130, render: (value) => SCENE_OPTIONS.find((option) => option.value === value)?.label || value },
    { title: "声明类型", dataIndex: "mime_type", minWidth: 140, render: (value) => value || "未登记" },
    { title: "登记大小", dataIndex: "file_size", width: 100, render: (value) => (value ? HGFileManagementVM.formatFileSize(value) : "未知") },
    { title: "状态", dataIndex: "status", minWidth: 110, render: (value) => (value?.startsWith("legacy:") ? `旧链路：${value.slice(7)}` : value) },
    {
      title: "操作",
      key: "action",
      width: 108,
      render: (_, item) => item.source === "new" && HGFileManagementVM.canPreviewImage(item)
        ? <HGButtonPage size="small" onClick={() => this.handlePreview(item)}>本人预览</HGButtonPage>
        : "—",
    },
  ]);

  renderInventory() {
    const { kind, items, loading, error, pageIndex, historyBase, cursors, nextCursor } = this.state;
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
            hasPreviousPage: pageIndex > historyBase,
            hasNextPage: Boolean(nextCursor),
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
      <HGModalPage visible title="本人图片预览" onClose={this.closePreview} cancelText="关闭" onCancel={this.closePreview}>
        {preview.url ? <img className={styles.previewImage} src={preview.url} alt="本人已审核图片"
          referrerPolicy="no-referrer" onError={() => this.handlePreviewImageError(preview.url)} />
          : preview.error ? <p role="alert">{preview.error}</p> : <p role="status">正在申请本人预览…</p>}
      </HGModalPage>
    );
  }

  render() {
    return (
      <>
        {this.renderFilters()}
        {this.renderInventory()}
        {this.renderPreview()}
      </>
    );
  }
}

export default HGFileListPage;

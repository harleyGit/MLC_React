/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-30
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/file_management/file_list/hg_file_list_page.jsx
 * @Description: 文件列表页面，展示文件管理提交后形成的文件信息数据
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../../components/hg_button/hg_button_page";
import HGInputPage from "../../../../../components/hg_input/hg_input_page";
import HGSelectPage from "../../../../../components/hg_select/hg_select_page";
import { hgMessage as message } from "../../../../../components/hg_message/hg_message_page";
import HGFileManagementVM, { SCENE_OPTIONS } from "../hg_file_management_vm";
import styles from "./hg_file_list.module.css";

/**
 * 文件类型筛选选项
 * 职责：提供文件列表页按类型过滤的固定选项
 */
const FILE_TYPE_FILTER_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "document", label: "文档" },
  { value: "other", label: "其他" },
];

/**
 * 文件列表页面
 * 职责：只展示和操作提交后形成的文件信息列表，不承担上传表单职责
 */
class HGFileListPage extends Component {
  constructor(props) {
    super(props);
    this.state = {
      allFileList: [],
      displayList: [],
      loading: false,
      keyword: "",
      filterScene: "",
      filterFileType: "",
      current: 1,
      pageSize: 10,
      total: 0,
      previewVisible: false,
      previewFile: null,
    };
  }

  /**
   * 挂载后加载由文件管理提交形成的文件信息列表
   */
  componentDidMount() {
    this.loadFileList();
  }

  /**
   * 加载文件信息列表，并按当前筛选条件刷新分页展示
   */
  loadFileList = () => {
    this.setState({ loading: true });
    HGFileManagementVM.getFileList()
      .then((res) => {
        if (res.code === 0) {
          this.setState({ allFileList: res.data || [] }, () => {
            this.refreshDisplay();
          });
        } else {
          message.error(res.message || "获取文件列表失败");
        }
      })
      .catch(() => {
        message.error("获取文件列表失败");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 根据搜索、场景、文件类型筛选条件刷新当前页数据
   */
  refreshDisplay = () => {
    const { allFileList, keyword, filterScene, filterFileType, current, pageSize } = this.state;
    const { data, total } = HGFileManagementVM.filterAndPaginate(allFileList, {
      keyword,
      scene: filterScene,
      fileType: filterFileType,
      page: current,
      pageSize,
    });
    this.setState({ displayList: data, total });
  };

  /**
   * 搜索关键字变更后回到第一页，并刷新展示列表
   * @param {string} value 搜索关键字
   */
  handleKeywordChange = (value) => {
    this.setState({ keyword: value, current: 1 }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 业务场景筛选变更后回到第一页，并刷新展示列表
   * @param {string} value 场景值
   */
  handleSceneFilter = (value) => {
    this.setState({ filterScene: value, current: 1 }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 文件类型筛选变更后回到第一页，并刷新展示列表
   * @param {string} value 文件类型
   */
  handleFileTypeFilter = (value) => {
    this.setState({ filterFileType: value, current: 1 }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 切换分页页码
   * @param {number} page 目标页码
   */
  handlePageChange = (page) => {
    this.setState({ current: page }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 删除文件信息后重新加载列表
   * @param {number} fileId 文件 ID
   */
  handleDelete = (fileId) => {
    HGFileManagementVM.deleteFile(fileId)
      .then((res) => {
        if (res.code === 0) {
          message.success("删除成功");
          this.loadFileList();
        } else {
          message.error(res.message || "删除失败");
        }
      })
      .catch(() => {
        message.error("网络异常，请稍后重试");
      });
  };

  /**
   * 打开文件预览弹窗
   * @param {Object} file 文件信息
   */
  handlePreview = (file) => {
    if (!file.file_url) {
      message.warning("暂无预览地址");
      return;
    }
    this.setState({ previewVisible: true, previewFile: file });
  };

  /**
   * 关闭文件预览弹窗
   */
  handleClosePreview = () => {
    this.setState({ previewVisible: false, previewFile: null });
  };

  /**
   * 渲染搜索筛选栏
   * @returns {React.ReactNode} 搜索筛选区域
   */
  renderFilterBar = () => {
    const { keyword, filterScene, filterFileType } = this.state;
    return (
      <div className={styles.filterBar}>
        <HGInputPage
          placeholder="搜索文件名、标识、上传人"
          value={keyword}
          onChange={(e) => this.handleKeywordChange(e.target ? e.target.value : e)}
          className={styles.filterInput}
        />
        <HGSelectPage
          placeholder="业务场景"
          value={filterScene || undefined}
          onChange={this.handleSceneFilter}
          options={[{ value: "", label: "全部场景" }, ...SCENE_OPTIONS]}
          className={styles.filterSelect}
          allowClear
        />
        <HGSelectPage
          placeholder="文件类型"
          value={filterFileType || undefined}
          onChange={this.handleFileTypeFilter}
          options={FILE_TYPE_FILTER_OPTIONS}
          className={styles.filterSelect}
          allowClear
        />
        <HGButtonPage onClick={this.loadFileList}>刷新</HGButtonPage>
      </div>
    );
  };

  /**
   * 渲染文件列表表格
   * @returns {React.ReactNode} 表格节点
   */
  renderFileTable = () => {
    const { displayList, loading } = this.state;

    if (loading) {
      return <div className={styles.emptyState}>加载中...</div>;
    }

    if (displayList.length === 0) {
      return <div className={styles.emptyState}>暂无文件记录</div>;
    }

    return (
      <div className={styles.tableContainer}>
        <table className={styles.fileTable}>
          <thead>
            <tr className={styles.tableHeaderRow}>
              <th className={styles.thCell}>文件名</th>
              <th className={styles.thCell}>业务场景</th>
              <th className={styles.thCell}>文件类型</th>
              <th className={styles.thCell}>文件大小</th>
              <th className={styles.thCell}>上传人</th>
              <th className={styles.thCell}>上传时间</th>
              <th className={styles.thCell}>IP地址</th>
              <th className={styles.thCellCenter}>操作</th>
            </tr>
          </thead>
          <tbody>
            {displayList.map((file) => (
              <tr key={file.id} className={styles.trRow}>
                <td className={styles.tdCell} title={file.file_key}>{file.file_name}</td>
                <td className={styles.tdCell}>
                  {SCENE_OPTIONS.find((s) => s.value === file.scene)?.label || file.scene}
                </td>
                <td className={styles.tdCell}>{file.file_type}</td>
                <td className={styles.tdCell}>{HGFileManagementVM.formatFileSize(file.file_size)}</td>
                <td className={styles.tdCell}>{file.user_id}</td>
                <td className={styles.tdCell}>{file.upload_time}</td>
                <td className={styles.tdCell}>{file.ip}</td>
                <td className={styles.tdCellCenter}>
                  <div className={styles.actionButtons}>
                    <button className={styles.previewButton} onClick={() => this.handlePreview(file)}>
                      预览
                    </button>
                    <button className={styles.deleteButton} onClick={() => this.handleDelete(file.id)}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  /**
   * 渲染分页控件
   * @returns {React.ReactNode} 分页节点
   */
  renderPagination = () => {
    const { current, pageSize, total } = this.state;
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return null;

    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }

    return (
      <div className={styles.pagination}>
        <span className={styles.paginationInfo}>共 {total} 条，第 {current}/{totalPages} 页</span>
        <HGButtonPage disabled={current <= 1} onClick={() => this.handlePageChange(current - 1)}>
          上一页
        </HGButtonPage>
        {pages.map((p) => (
          <HGButtonPage
            key={p}
            type={p === current ? "primary" : "default"}
            onClick={() => this.handlePageChange(p)}
          >
            {p}
          </HGButtonPage>
        ))}
        <HGButtonPage disabled={current >= totalPages} onClick={() => this.handlePageChange(current + 1)}>
          下一页
        </HGButtonPage>
      </div>
    );
  };

  /**
   * 渲染预览弹窗
   * @returns {React.ReactNode} 预览弹窗节点
   */
  renderPreviewModal = () => {
    const { previewVisible, previewFile } = this.state;
    if (!previewVisible || !previewFile) return null;

    let previewContent = null;
    if (previewFile.file_type === "image") {
      previewContent = <img src={previewFile.file_url} alt={previewFile.file_name} className={styles.previewImage} />;
    } else if (previewFile.file_type === "video") {
      previewContent = <video src={previewFile.file_url} controls className={styles.previewVideo} />;
    } else {
      previewContent = (
        <div className={styles.unsupportedPreview}>
          <p>该文件类型不支持在线预览</p>
          <HGButtonPage type="primary" onClick={() => window.open(previewFile.file_url, "_blank")}>
            在新窗口中打开
          </HGButtonPage>
        </div>
      );
    }

    return (
      <div className={styles.modalOverlay} onClick={this.handleClosePreview}>
        <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
          <div className={styles.modalHeader}>
            <span className={styles.modalTitle}>{previewFile.file_name}</span>
            <button className={styles.modalClose} onClick={this.handleClosePreview}>×</button>
          </div>
          <div className={styles.modalBody}>{previewContent}</div>
        </div>
      </div>
    );
  };

  render() {
    return (
      <div className={styles.fileListContainer}>
        <h2 className={styles.pageTitle}>文件列表</h2>
        <p className={styles.pageDesc}>展示文件管理提交后形成的文件信息数据。</p>
        {this.renderFilterBar()}
        {this.renderFileTable()}
        {this.renderPagination()}
        {this.renderPreviewModal()}
      </div>
    );
  }
}

export default HGFileListPage;

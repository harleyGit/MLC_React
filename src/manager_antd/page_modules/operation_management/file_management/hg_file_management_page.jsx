/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/file_management/hg_file_management_page.jsx
 * @Description: 文件管理页面，统一管理系统所有上传图片、视频、文档文件
 */
import React, { Component } from "react";
import HGButtonPage from "../../../../components/hg_button/hg_button_page";
import {
  HGFormPage as Form,
  HGFormItem as Item,
} from "../../../../components/hg_form/hg_form_page";
import HGInputPage from "../../../../components/hg_input/hg_input_page";
import HGSelectPage from "../../../../components/hg_select/hg_select_page";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import styles from "./hg_file_management.module.css";
import HGFileManagementVM, { SCENE_OPTIONS } from "./hg_file_management_vm";

/**
 * 文件类型筛选选项
 */
const FILE_TYPE_FILTER_OPTIONS = [
  { value: "", label: "全部类型" },
  { value: "image", label: "图片" },
  { value: "video", label: "视频" },
  { value: "document", label: "文档" },
  { value: "other", label: "其他" },
];

/**
 * 文件管理页面
 * 职责：统一管理系统所有上传图片、视频、文档文件
 * 功能：文件上传、分页列表、搜索筛选、文件预览与删除
 * 约束：类组件，使用表单收集上传信息，支持多文件上传
 */
class HGFileManagementPage extends Component {
  constructor(props) {
    super(props);
    this.formRef = React.createRef();
    this.fileInputRef = React.createRef();
    this.state = {
      allFileList: [], // 全量文件列表
      displayList: [], // 当前页展示列表
      uploading: false,
      selectedFiles: [],
      loading: false,
      // 搜索筛选
      keyword: "",
      filterScene: "",
      filterFileType: "",
      // 分页
      current: 1,
      pageSize: 10,
      total: 0,
      // 预览弹窗
      previewVisible: false,
      previewFile: null,
    };
  }

  /**
   * 挂载后：获取文件列表数据
   */
  componentDidMount() {
    this.loadFileList();
  }

  /**
   * 加载文件列表并刷新分页
   */
  loadFileList = () => {
    this.setState({ loading: true });
    HGFileManagementVM.getFileList()
      .then((res) => {
        if (res.code === 0) {
          this.setState({ allFileList: res.data || [] }, () => {
            this.refreshDisplay();
          });
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
   * 根据搜索筛选条件刷新当前页展示数据
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
   * 打开文件选择器
   */
  handleOpenFilePicker = () => {
    this.fileInputRef.current?.click();
  };

  /**
   * 处理文件选择事件，含大小校验
   * @param {Event} event 文件选择事件
   */
  handleFileChange = (event) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      const result = HGFileManagementVM.validateFiles(fileArray);
      if (!result.valid) {
        message.error(result.message);
        event.target.value = "";
        return;
      }
      this.setState({ selectedFiles: fileArray });
    }
    event.target.value = "";
  };

  /**
   * 处理文件上传提交
   * @param {Object} values 表单值
   */
  handleUpload = (values) => {
    const { selectedFiles } = this.state;
    if (selectedFiles.length === 0) {
      message.warning("请先选择要上传的文件");
      return;
    }

    this.setState({ uploading: true });
    const submitData = HGFileManagementVM.transformSubmitData(values, selectedFiles);

    HGFileManagementVM.submitFileList(submitData)
      .then((res) => {
        if (res.code === 0) {
          message.success("上传成功");
          this.setState({ selectedFiles: [] });
          this.loadFileList();
        } else {
          message.error(res.message || "上传失败");
        }
      })
      .catch(() => {
        message.error("网络异常，请稍后重试");
      })
      .finally(() => {
        this.setState({ uploading: false });
      });
  };

  /**
   * 处理文件删除
   * @param {number} fileId 文件ID
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
   * 关闭预览弹窗
   */
  handleClosePreview = () => {
    this.setState({ previewVisible: false, previewFile: null });
  };

  /**
   * 搜索关键字变更
   * @param {string} value 关键字
   */
  handleKeywordChange = (value) => {
    this.setState({ keyword: value, current: 1 }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 场景筛选变更
   * @param {string} value 场景值
   */
  handleSceneFilter = (value) => {
    this.setState({ filterScene: value, current: 1 }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 文件类型筛选变更
   * @param {string} value 类型值
   */
  handleFileTypeFilter = (value) => {
    this.setState({ filterFileType: value, current: 1 }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 翻页
   * @param {number} page 目标页码
   */
  handlePageChange = (page) => {
    this.setState({ current: page }, () => {
      this.refreshDisplay();
    });
  };

  /**
   * 渲染场景选择字段
   * @returns {React.ReactNode} 下拉选择器
   */
  renderSceneField = () => (
    <Item
      label="业务场景"
      name="scene"
      rules={HGFileManagementVM.getFormRules().scene}
      className={styles.formItem}
    >
      <HGSelectPage
        placeholder="请选择业务场景"
        options={SCENE_OPTIONS}
        className={styles.sceneSelector}
      />
    </Item>
  );

  /**
   * 渲染上传人ID字段
   * @returns {React.ReactNode} 输入框
   */
  renderUserIdField = () => (
    <Item
      label="上传人ID"
      name="user_id"
      rules={HGFileManagementVM.getFormRules().user_id}
      className={styles.formItem}
    >
      <HGInputPage placeholder="请输入上传人ID" />
    </Item>
  );

  /**
   * 渲染上传人类型字段
   * @returns {React.ReactNode} 输入框
   */
  renderUserTypeField = () => (
    <Item
      label="上传人类型"
      name="user_type"
      rules={HGFileManagementVM.getFormRules().user_type}
      className={styles.formItem}
    >
      <HGInputPage placeholder="请输入上传人类型（如：admin、user）" />
    </Item>
  );

  /**
   * 渲染文件上传区域
   * @returns {React.ReactNode} 上传区域
   */
  renderUploadArea = () => {
    const { selectedFiles, uploading } = this.state;
    return (
      <div className={styles.uploadArea}>
        <input
          type="file"
          ref={this.fileInputRef}
          onChange={this.handleFileChange}
          multiple
          accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
          style={{ display: "none" }}
        />
        <HGButtonPage
          type="dashed"
          onClick={this.handleOpenFilePicker}
          className={styles.uploadButton}
        >
          选择文件
        </HGButtonPage>
        <div className={styles.uploadTips}>
          支持图片（≤10MB）、视频（≤50MB）、文档（≤20MB），可同时选择多个文件
        </div>
        {selectedFiles.length > 0 && (
          <div className={styles.fileSizeInfo}>
            <span className={styles.fileSizeItem}>
              已选择 <span>{selectedFiles.length}</span> 个文件
            </span>
            <span className={styles.fileSizeItem}>
              总大小{" "}
              <span>
                {HGFileManagementVM.formatFileSize(
                  selectedFiles.reduce((sum, f) => sum + f.size, 0)
                )}
              </span>
            </span>
          </div>
        )}
      </div>
    );
  };

  /**
   * 渲染文件信息展示
   * @returns {React.ReactNode} 文件信息
   */
  renderFileInfo = () => {
    const { selectedFiles } = this.state;
    if (selectedFiles.length === 0) return null;

    return (
      <div className={styles.fileInfo}>
        {selectedFiles.map((file, index) => (
          <div key={index} className={styles.fileInfoItem}>
            <span className={styles.fileInfoLabel}>文件{index + 1}:</span>
            <span className={styles.fileInfoValue}>{file.name}</span>
            <span className={styles.fileInfoValue}>
              {HGFileManagementVM.formatFileSize(file.size)}
            </span>
            <span className={styles.fileInfoValue}>
              {HGFileManagementVM.getFileTypeCategory(file.name)}
            </span>
          </div>
        ))}
      </div>
    );
  };

  /**
   * 渲染只读信息展示
   * @returns {React.ReactNode} 只读信息
   */
  renderReadOnlyInfo = () => (
    <div className={styles.fileInfo}>
      <div className={styles.fileInfoItem}>
        <span className={styles.fileInfoLabel}>IP地址:</span>
        <div className={styles.readOnlyField}>127.0.0.1（系统自动获取）</div>
      </div>
      <div className={styles.fileInfoItem}>
        <span className={styles.fileInfoLabel}>上传时间:</span>
        <div className={styles.readOnlyField}>提交时自动生成</div>
      </div>
    </div>
  );

  /**
   * 渲染上传按钮
   * @returns {React.ReactNode} 按钮组
   */
  renderUploadActions = () => {
    const { uploading, selectedFiles } = this.state;
    return (
      <div className={styles.submitRow}>
        <HGButtonPage
          type="primary"
          onClick={() => {
            if (this.formRef.current) {
              this.formRef.current.submit();
            }
          }}
          loading={uploading}
          disabled={selectedFiles.length === 0}
        >
          上传文件
        </HGButtonPage>
        <HGButtonPage
          onClick={() => {
            this.setState({ selectedFiles: [] });
          }}
        >
          清空选择
        </HGButtonPage>
      </div>
    );
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
   * 渲染分页控件
   * @returns {React.ReactNode} 分页
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
        <span className={styles.paginationInfo}>
          共 {total} 条，第 {current}/{totalPages} 页
        </span>
        <HGButtonPage
          disabled={current <= 1}
          onClick={() => this.handlePageChange(current - 1)}
        >
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
        <HGButtonPage
          disabled={current >= totalPages}
          onClick={() => this.handlePageChange(current + 1)}
        >
          下一页
        </HGButtonPage>
      </div>
    );
  };

  /**
   * 渲染预览弹窗
   * 根据文件类型：图片直接展示，视频播放器，文档新窗口打开
   * @returns {React.ReactNode} 弹窗节点
   */
  renderPreviewModal = () => {
    const { previewVisible, previewFile } = this.state;
    if (!previewVisible || !previewFile) return null;

    let previewContent = null;
    if (previewFile.file_type === "image") {
      previewContent = (
        <img
          src={previewFile.file_url}
          alt={previewFile.file_name}
          style={{ maxWidth: "100%", maxHeight: "70vh", display: "block", margin: "0 auto" }}
        />
      );
    } else if (previewFile.file_type === "video") {
      previewContent = (
        <video
          src={previewFile.file_url}
          controls
          style={{ maxWidth: "100%", maxHeight: "70vh", display: "block", margin: "0 auto" }}
        />
      );
    } else {
      previewContent = (
        <div style={{ textAlign: "center", padding: "40px" }}>
          <p>该文件类型不支持在线预览</p>
          <HGButtonPage
            type="primary"
            onClick={() => window.open(previewFile.file_url, "_blank")}
          >
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
            <button className={styles.modalClose} onClick={this.handleClosePreview}>
              ×
            </button>
          </div>
          <div className={styles.modalBody}>{previewContent}</div>
        </div>
      </div>
    );
  };

  /**
   * 渲染文件列表表格
   * @returns {React.ReactNode} 表格
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
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
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
                <td className={styles.tdCell} title={file.file_key}>
                  {file.file_name}
                </td>
                <td className={styles.tdCell}>
                  {SCENE_OPTIONS.find((s) => s.value === file.scene)?.label || file.scene}
                </td>
                <td className={styles.tdCell}>{file.file_type}</td>
                <td className={styles.tdCell}>
                  {HGFileManagementVM.formatFileSize(file.file_size)}
                </td>
                <td className={styles.tdCell}>{file.user_id}</td>
                <td className={styles.tdCell}>{file.upload_time}</td>
                <td className={styles.tdCell}>{file.ip}</td>
                <td className={styles.tdCellCenter}>
                  <div className={styles.actionButtons}>
                    <button
                      className={styles.previewButton}
                      onClick={() => this.handlePreview(file)}
                    >
                      预览
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() => this.handleDelete(file.id)}
                    >
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

  render() {
    return (
      <div className={styles.fileManagementContainer}>
        <h2 className={styles.formTitle}>文件管理</h2>

        <div className={styles.uploadSection}>
          <h3 className={styles.uploadSectionTitle}>上传文件</h3>
          <Form ref={this.formRef} layout="vertical" onFinish={this.handleUpload}>
            {this.renderSceneField()}
            {this.renderUserIdField()}
            {this.renderUserTypeField()}
            {this.renderUploadArea()}
            {this.renderFileInfo()}
            {this.renderReadOnlyInfo()}
            {this.renderUploadActions()}
          </Form>
        </div>

        <div className={styles.tableSection}>
          <h3 className={styles.tableSectionTitle}>文件列表</h3>
          {this.renderFilterBar()}
          {this.renderFileTable()}
          {this.renderPagination()}
        </div>

        {this.renderPreviewModal()}
      </div>
    );
  }
}

export default HGFileManagementPage;

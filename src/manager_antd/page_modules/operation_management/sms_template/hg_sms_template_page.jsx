/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25 03:00:06
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/sms_template/hg_sms_template_page.jsx
 * @Description: 短信模板管理页面，支持模板的增删改查
 * 
 * 配置验证码、通知类短信模板，对接第三方短信平台，统一管理短信文案、签名，实现业务场景一键发短信。
页面提交字段
 */
import React from "react";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGModalPage from "../../../../components/hg_modal/hg_modal_page";
import HGSmsTemplateVM, {
  SMS_PLATFORM_CONFIG,
  INITIAL_FORM_DATA,
} from "./hg_sms_template_vm";
import styles from "./hg_sms_template.module.css";

/**
 * 短信模板管理页面组件。
 * 职责：展示短信模板列表，支持模板的新增、编辑、删除。
 * 约束：使用类组件实现。
 */
class HGSmsTemplatePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      templates: [],
      loading: false,
      showModal: false,
      modalType: "add", // "add" | "edit"
      editingId: null,
      formData: { ...INITIAL_FORM_DATA },
      errors: {},
      submitting: false,
    };
  }

  /**
   * 生命周期挂载：加载数据。
   */
  componentDidMount() {
    this.loadData();
  }

  /**
   * 加载页面数据。
   */
  loadData = async () => {
    this.setState({ loading: true });
    try {
      const res = await HGSmsTemplateVM.fetchTemplateList();
      this.setState({ templates: res.data || [] });
    } catch {
      message.error("加载数据失败");
    } finally {
      this.setState({ loading: false });
    }
  };

  /**
   * 打开新增弹窗。
   */
  openAddModal = () => {
    this.setState({
      showModal: true,
      modalType: "add",
      editingId: null,
      formData: { ...INITIAL_FORM_DATA },
      errors: {},
    });
  };

  /**
   * 打开编辑弹窗。
   * @param {Object} template 模板数据。
   */
  openEditModal = (template) => {
    this.setState({
      showModal: true,
      modalType: "edit",
      editingId: template.id,
      formData: {
        scene_code: template.scene_code,
        sign_name: template.sign_name,
        platform_tmpl_id: template.platform_tmpl_id,
        tmpl_str: template.tmpl_str,
        status: template.status,
        platform: template.platform,
      },
      errors: {},
    });
  };

  /**
   * 关闭弹窗。
   */
  closeModal = () => {
    this.setState({ showModal: false, editingId: null, errors: {} });
  };

  /**
   * 处理表单字段变化。
   * @param {string} field 字段名。
   * @param {*} value 字段值。
   */
  handleFieldChange = (field, value) => {
    this.setState((prevState) => ({
      formData: { ...prevState.formData, [field]: value },
      errors: { ...prevState.errors, [field]: undefined },
    }));
  };

  /**
   * 处理输入框变化。
   * @param {string} field 字段名。
   * @param {React.ChangeEvent} e 输入事件。
   */
  handleInputChange = (field, e) => {
    this.handleFieldChange(field, e.target.value);
  };

  /**
   * 提交表单。
   */
  handleSubmit = async () => {
    const { formData, editingId } = this.state;
    const validation = HGSmsTemplateVM.validateForm(formData);
    if (!validation.valid) {
      this.setState({ errors: validation.errors });
      message.error("请填写必填项");
      return;
    }

    this.setState({ submitting: true });
    try {
      const result = await HGSmsTemplateVM.submitTemplate(formData, editingId);
      if (result.success) {
        message.success(result.message);
        this.closeModal();
        this.loadData();
      }
    } catch (error) {
      if (error.type === "validation") {
        this.setState({ errors: error.errors });
      } else {
        message.error("操作失败");
      }
    } finally {
      this.setState({ submitting: false });
    }
  };

  /**
   * 处理删除模板。
   * @param {number} templateId 模板 ID。
   */
  handleDelete = async (templateId) => {
    try {
      const result = await HGSmsTemplateVM.deleteTemplate(templateId);
      if (result.success) {
        message.success(result.message);
        this.loadData();
      }
    } catch {
      message.error("删除失败");
    }
  };

  /**
   * 处理状态切换。
   * @param {number} templateId 模板 ID。
   * @param {boolean} currentStatus 当前状态。
   */
  handleToggleStatus = async (templateId, currentStatus) => {
    try {
      const result = await HGSmsTemplateVM.toggleStatus(templateId, !currentStatus);
      if (result.success) {
        message.success(result.message);
        this.loadData();
      }
    } catch {
      message.error("操作失败");
    }
  };

  /**
   * 渲染表单弹窗。
   * @returns {React.ReactNode} 弹窗节点。
   */
  renderFormModal = () => {
    const { showModal, modalType, formData, errors, submitting } = this.state;
    if (!showModal) return null;

    const title = modalType === "add" ? "新增短信模板" : "编辑短信模板";

    return (
      <HGModalPage
        visible={showModal}
        title={title}
        size="large"
        onClose={this.closeModal}
        onCancel={this.closeModal}
        onOk={this.handleSubmit}
        okText={submitting ? "提交中..." : "确认"}
        cancelText="取消"
      >
        <div className={styles.formCard} style={{ boxShadow: "none", padding: 0, margin: 0 }}>
          <div className={styles.formItem}>
            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
              业务场景编码
            </label>
            <div className={styles.formControl}>
              <input
                type="text"
                className={styles.input}
                placeholder="如：LOGIN_VERIFY"
                value={formData.scene_code}
                onChange={(e) => this.handleInputChange("scene_code", e)}
              />
              {errors.scene_code && <div className={styles.formError}>{errors.scene_code}</div>}
            </div>
          </div>

          <div className={styles.formItem}>
            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
              短信签名
            </label>
            <div className={styles.formControl}>
              <input
                type="text"
                className={styles.input}
                placeholder="如：MLC平台"
                value={formData.sign_name}
                onChange={(e) => this.handleInputChange("sign_name", e)}
              />
              {errors.sign_name && <div className={styles.formError}>{errors.sign_name}</div>}
            </div>
          </div>

          <div className={styles.formItem}>
            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
              平台模板ID
            </label>
            <div className={styles.formControl}>
              <input
                type="text"
                className={styles.input}
                placeholder="如：SMS_001"
                value={formData.platform_tmpl_id}
                onChange={(e) => this.handleInputChange("platform_tmpl_id", e)}
              />
              {errors.platform_tmpl_id && <div className={styles.formError}>{errors.platform_tmpl_id}</div>}
            </div>
          </div>

          <div className={styles.formItem}>
            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
              短信服务商
            </label>
            <div className={styles.formControl}>
              <select
                className={styles.select}
                value={formData.platform}
                onChange={(e) => this.handleFieldChange("platform", e.target.value)}
              >
                {Object.entries(SMS_PLATFORM_CONFIG).map(([key, config]) => (
                  <option key={key} value={key}>
                    {config.label}
                  </option>
                ))}
              </select>
              {errors.platform && <div className={styles.formError}>{errors.platform}</div>}
            </div>
          </div>

          <div className={styles.formItem}>
            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
              短信文案
            </label>
            <div className={styles.formControl}>
              <textarea
                className={styles.textarea}
                placeholder="请输入短信文案，变量用{xxx}表示"
                value={formData.tmpl_str}
                onChange={(e) => this.handleInputChange("tmpl_str", e)}
                rows={4}
              />
              {errors.tmpl_str && <div className={styles.formError}>{errors.tmpl_str}</div>}
              <div className={styles.formHint}>
                示例：【签名】您的验证码是{`{code}`}，5分钟内有效。
              </div>
            </div>
          </div>

          <div className={styles.formItem}>
            <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
              启用状态
            </label>
            <div className={styles.formControl}>
              <div className={styles.switchWrapper}>
                <button
                  type="button"
                  className={`${styles.switch} ${formData.status ? styles.switchChecked : styles.switchUnchecked}`}
                  onClick={() => this.handleFieldChange("status", !formData.status)}
                >
                  <span className={`${styles.switchDot} ${formData.status ? styles.switchDotChecked : styles.switchDotUnchecked}`} />
                </button>
                <span className={styles.switchLabel}>
                  {formData.status ? "启用" : "禁用"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </HGModalPage>
    );
  };

  /**
   * 渲染状态标签。
   * @param {boolean} status 状态值。
   * @returns {React.ReactNode} 状态标签节点。
   */
  renderStatusTag = (status) => {
    return (
      <span className={`${styles.statusTag} ${status ? styles.statusEnabled : styles.statusDisabled}`}>
        {status ? "启用" : "禁用"}
      </span>
    );
  };

  /**
   * 渲染平台标签。
   * @param {string} platform 平台值。
   * @returns {React.ReactNode} 平台标签节点。
   */
  renderPlatformTag = (platform) => {
    const config = SMS_PLATFORM_CONFIG[platform] || { label: platform };
    return <span className={styles.platformTag}>{config.label}</span>;
  };

  /**
   * 渲染模板列表。
   * @returns {React.ReactNode} 列表节点。
   */
  renderTable = () => {
    const { templates } = this.state;

    return (
      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>短信模板列表</h3>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={this.openAddModal}
          >
            新增模板
          </button>
        </div>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>场景编码</th>
                <th>短信签名</th>
                <th>平台模板ID</th>
                <th>服务商</th>
                <th>短信文案</th>
                <th>状态</th>
                <th>更新时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {templates.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", padding: "40px", color: "#999" }}>
                    暂无数据
                  </td>
                </tr>
              ) : (
                templates.map((template) => (
                  <tr key={template.id}>
                    <td>{template.scene_code}</td>
                    <td>{template.sign_name}</td>
                    <td>{template.platform_tmpl_id}</td>
                    <td>{this.renderPlatformTag(template.platform)}</td>
                    <td>
                      <div className={styles.tmplPreview}>{template.tmpl_str}</div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.switch} ${template.status ? styles.switchChecked : styles.switchUnchecked}`}
                        onClick={() => this.handleToggleStatus(template.id, template.status)}
                      >
                        <span className={`${styles.switchDot} ${template.status ? styles.switchDotChecked : styles.switchDotUnchecked}`} />
                      </button>
                    </td>
                    <td>{HGSmsTemplateVM.formatDate(template.updated_at)}</td>
                    <td>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnPrimary}`}
                        onClick={() => this.openEditModal(template)}
                      >
                        编辑
                      </button>
                      <button
                        type="button"
                        className={`${styles.actionBtn} ${styles.actionBtnDanger}`}
                        onClick={() => this.handleDelete(template.id)}
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  render() {
    const { loading } = this.state;

    return (
      <div className={styles.container}>
        {loading && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
          </div>
        )}
        {this.renderTable()}
        {this.renderFormModal()}
      </div>
    );
  }
}

export default HGSmsTemplatePage;

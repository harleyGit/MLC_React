/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/course_management/hg_course_management_page.jsx
 * @Description: 课程提交表单页面，包含课程信息的录入与提交功能
 */
import React from "react";
import { hgMessage as message } from "../../../../components/hg_message/hg_message_page";
import HGCourseManagementVM, {
  SALE_TYPE_OPTIONS,
  SERVICE_TIME_OPTIONS,
  INITIAL_FORM_DATA,
} from "./hg_course_management_vm";
import styles from "./hg_course_management.module.css";

/**
 * SVG 图标组件。
 */
const Icon = {
  /** 上传图标 */
  Upload: () => (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

/**
 * 课程提交表单页面组件。
 * 职责：展示课程提交表单，处理表单输入与提交。
 * 约束：使用类组件实现，表单字段需满足必填校验。
 */
class HGCourseManagementPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      formData: { ...INITIAL_FORM_DATA },
      errors: {},
      submitting: false,
      coverPreview: "",
      introPreview: "",
    };
    this.coverInputRef = React.createRef();
    this.introInputRef = React.createRef();
  }

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
   * 处理数字输入变化。
   * @param {string} field 字段名。
   * @param {number} value 数值。
   */
  handleNumberChange = (field, value) => {
    this.handleFieldChange(field, value);
  };

  /**
   * 处理数字增减。
   * @param {string} field 字段名。
   * @param {number} step 步长。
   */
  handleNumberStep = (field, step) => {
    const { formData } = this.state;
    const currentValue = formData[field] || 0;
    const newValue = Math.max(0, currentValue + step);
    this.handleFieldChange(field, newValue);
  };

  /**
   * 处理图片上传。
   * @param {string} field 字段名（cover_key 或 intro_key）。
   * @param {React.ChangeEvent} e 文件输入事件。
   */
  handleImageUpload = async (field, e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 验证文件类型
    if (!file.type.startsWith("image/")) {
      message.error("请上传图片文件");
      return;
    }

    // 验证文件大小（5MB）
    if (file.size > 5 * 1024 * 1024) {
      message.error("图片大小不能超过5MB");
      return;
    }

    try {
      const result = await HGCourseManagementVM.uploadImage(file);
      if (result.success) {
        this.handleFieldChange(field, result.key);
        const previewField = field === "cover_key" ? "coverPreview" : "introPreview";
        this.setState({ [previewField]: result.url });
        message.success("图片上传成功");
      }
    } catch {
      message.error("图片上传失败");
    }
  };

  /**
   * 触发图片选择。
   * @param {string} type 图片类型（cover 或 intro）。
   */
  triggerImageSelect = (type) => {
    if (type === "cover") {
      this.coverInputRef.current?.click();
    } else {
      this.introInputRef.current?.click();
    }
  };

  /**
   * 处理表单提交。
   */
  handleSubmit = async () => {
    const { formData } = this.state;

    // 验证表单
    const validation = HGCourseManagementVM.validateForm(formData);
    if (!validation.valid) {
      this.setState({ errors: validation.errors });
      message.error("请填写必填项");
      return;
    }

    this.setState({ submitting: true });

    try {
      const result = await HGCourseManagementVM.submitCourse(formData);
      if (result.success) {
        message.success(result.message);
        // 重置表单
        this.setState({
          formData: { ...INITIAL_FORM_DATA },
          errors: {},
          coverPreview: "",
          introPreview: "",
        });
      }
    } catch (error) {
      if (error.type === "validation") {
        this.setState({ errors: error.errors });
      } else {
        message.error("提交失败，请重试");
      }
    } finally {
      this.setState({ submitting: false });
    }
  };

  /**
   * 处理表单重置。
   */
  handleReset = () => {
    this.setState({
      formData: { ...INITIAL_FORM_DATA },
      errors: {},
      coverPreview: "",
      introPreview: "",
    });
    message.info("表单已重置");
  };

  /**
   * 渲染输入框。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {Object} options 配置选项。
   * @returns {React.ReactNode} 输入框节点。
   */
  renderInput = (label, field, options = {}) => {
    const { formData, errors } = this.state;
    const { placeholder, required, disabled, maxLength } = options;
    const hasError = !!errors[field];

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${required ? styles.formLabelRequired : ""}`}>
          {label}
        </label>
        <div className={styles.formControl}>
          <input
            type="text"
            className={`${styles.input} ${disabled ? styles.inputDisabled : ""}`}
            value={formData[field] || ""}
            placeholder={placeholder || `请输入${label}`}
            disabled={disabled}
            maxLength={maxLength}
            onChange={(e) => this.handleInputChange(field, e)}
          />
          {hasError && <div className={styles.formError}>{errors[field]}</div>}
        </div>
      </div>
    );
  };

  /**
   * 渲染文本域。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {Object} options 配置选项。
   * @returns {React.ReactNode} 文本域节点。
   */
  renderTextarea = (label, field, options = {}) => {
    const { formData } = this.state;
    const { placeholder, rows } = options;

    return (
      <div className={styles.formItem}>
        <label className={styles.formLabel}>{label}</label>
        <div className={styles.formControl}>
          <textarea
            className={styles.textarea}
            value={formData[field] || ""}
            placeholder={placeholder || `请输入${label}`}
            rows={rows || 4}
            onChange={(e) => this.handleInputChange(field, e)}
          />
        </div>
      </div>
    );
  };

  /**
   * 渲染数字输入框。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {Object} options 配置选项。
   * @returns {React.ReactNode} 数字输入框节点。
   */
  renderInputNumber = (label, field, options = {}) => {
    const { formData, errors } = this.state;
    const { min, max, step, prefix, suffix, required } = options;
    const hasError = !!errors[field];
    const currentValue = formData[field] || 0;

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${required ? styles.formLabelRequired : ""}`}>
          {label}
        </label>
        <div className={styles.formControl}>
          <div className={styles.inputNumberWrapper}>
            <button
              type="button"
              className={`${styles.inputNumberBtn} ${currentValue <= (min || 0) ? styles.inputNumberBtnDisabled : ""}`}
              onClick={() => this.handleNumberStep(field, -(step || 1))}
              disabled={currentValue <= (min || 0)}
            >
              -
            </button>
            <input
              type="number"
              className={styles.inputNumberInput}
              value={currentValue}
              min={min}
              max={max}
              step={step || 1}
              onChange={(e) => this.handleNumberChange(field, parseFloat(e.target.value) || 0)}
            />
            <button
              type="button"
              className={`${styles.inputNumberBtn} ${max !== undefined && currentValue >= max ? styles.inputNumberBtnDisabled : ""}`}
              onClick={() => this.handleNumberStep(field, step || 1)}
              disabled={max !== undefined && currentValue >= max}
            >
              +
            </button>
          </div>
          {prefix && <span className={styles.formHint}>{prefix}</span>}
          {suffix && <span className={styles.formHint}>{suffix}</span>}
          {hasError && <div className={styles.formError}>{errors[field]}</div>}
        </div>
      </div>
    );
  };

  /**
   * 渲染图片上传。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {string} type 图片类型（cover 或 intro）。
   * @returns {React.ReactNode} 图片上传节点。
   */
  renderImageUpload = (label, field, type) => {
    const { errors, coverPreview, introPreview } = this.state;
    const hasError = !!errors[field];
    const preview = type === "cover" ? coverPreview : introPreview;
    const hasImage = !!preview;

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
          {label}
        </label>
        <div className={styles.formControl}>
          <input
            type="file"
            ref={type === "cover" ? this.coverInputRef : this.introInputRef}
            accept="image/*"
            style={{ display: "none" }}
            onChange={(e) => this.handleImageUpload(field, e)}
          />
          <div
            className={`${styles.uploadArea} ${hasImage ? styles.uploadAreaHasImage : ""}`}
            onClick={() => this.triggerImageSelect(type)}
          >
            {hasImage ? (
              <div className={styles.uploadPreview}>
                <img src={preview} alt={label} />
                <div className={styles.uploadPreviewOverlay}>点击更换</div>
              </div>
            ) : (
              <>
                <div className={styles.uploadIcon}>
                  <Icon.Upload />
                </div>
                <span className={styles.uploadText}>点击上传</span>
              </>
            )}
          </div>
          {hasError && <div className={styles.formError}>{errors[field]}</div>}
          <div className={styles.formHint}>支持 JPG、PNG 格式，最大 5MB</div>
        </div>
      </div>
    );
  };

  /**
   * 渲染单选框组。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {Array} options 选项列表。
   * @returns {React.ReactNode} 单选框组节点。
   */
  renderRadioGroup = (label, field, options) => {
    const { formData, errors } = this.state;
    const hasError = !!errors[field];

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
          {label}
        </label>
        <div className={styles.formControl}>
          <div className={styles.radioGroup}>
            {options.map((option) => (
              <label key={option.value} className={styles.radioItem}>
                <input
                  type="radio"
                  className={styles.radioInput}
                  name={field}
                  value={option.value}
                  checked={formData[field] === option.value}
                  onChange={() => this.handleFieldChange(field, option.value)}
                />
                <span className={styles.radioLabel}>{option.label}</span>
              </label>
            ))}
          </div>
          {hasError && <div className={styles.formError}>{errors[field]}</div>}
        </div>
      </div>
    );
  };

  /**
   * 渲染开关。
   * @param {string} label 标签文本。
   * @param {string} field 字段名。
   * @param {Object} options 配置选项。
   * @returns {React.ReactNode} 开关节点。
   */
  renderSwitch = (label, field, options = {}) => {
    const { formData } = this.state;
    const { checkedLabel, uncheckedLabel } = options;
    const isChecked = !!formData[field];

    return (
      <div className={styles.formItem}>
        <label className={`${styles.formLabel} ${styles.formLabelRequired}`}>
          {label}
        </label>
        <div className={styles.formControl}>
          <div className={styles.switchWrapper}>
            <button
              type="button"
              className={`${styles.switch} ${isChecked ? styles.switchChecked : styles.switchUnchecked}`}
              onClick={() => this.handleFieldChange(field, !isChecked)}
            >
              <span className={`${styles.switchDot} ${isChecked ? styles.switchDotChecked : styles.switchDotUnchecked}`} />
            </button>
            <span className={styles.switchLabel}>
              {isChecked ? (checkedLabel || "上架") : (uncheckedLabel || "下架")}
            </span>
          </div>
        </div>
      </div>
    );
  };

  render() {
    const { submitting } = this.state;

    return (
      <div className={styles.container}>
        {submitting && (
          <div className={styles.loadingOverlay}>
            <div className={styles.loadingSpinner} />
          </div>
        )}
        <div className={styles.formCard}>
          <h2 className={styles.formTitle}>课程提交</h2>

          {this.renderInput("课程名称", "name", {
            placeholder: "请输入课程名称",
            required: true,
            maxLength: 50,
          })}

          {this.renderImageUpload("封面图", "cover_key", "cover")}

          {this.renderImageUpload("介绍图", "intro_key", "intro")}

          {this.renderTextarea("课程简介", "desc", {
            placeholder: "请输入课程简介（选填）",
            rows: 4,
          })}

          {this.renderInputNumber("课程价格", "goods_price", {
            min: 0,
            step: 1,
            prefix: "单位：元",
            required: true,
          })}

          {this.renderRadioGroup("服务时长", "service_time", SERVICE_TIME_OPTIONS)}

          {this.renderRadioGroup("售卖类型", "sale_type", SALE_TYPE_OPTIONS)}

          {this.renderSwitch("上架状态", "status", {
            checkedLabel: "上架",
            uncheckedLabel: "下架",
          })}

          <div className={styles.formActions}>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnPrimary} ${submitting ? styles.btnDisabled : ""}`}
              onClick={this.handleSubmit}
              disabled={submitting}
            >
              {submitting ? "提交中..." : "提交"}
            </button>
            <button
              type="button"
              className={`${styles.btn} ${styles.btnDefault}`}
              onClick={this.handleReset}
              disabled={submitting}
            >
              重置
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default HGCourseManagementPage;

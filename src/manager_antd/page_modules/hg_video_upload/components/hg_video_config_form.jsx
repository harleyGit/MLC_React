import React from "react";
import styles from "./hg_video_config_form.module.css";
import HGTagSelector from "./hg_tag_selector";
import HGDropdownSelector from "./hg_dropdown_selector";

/** 推荐标签列表 */
const RECOMMEND_TAGS = [
  { value: "生活记录", label: "生活记录" },
  { value: "直播", label: "直播" },
  { value: "录屏", label: "录屏" },
  { value: "记录", label: "记录" },
  { value: "自用", label: "自用" },
  { value: "学习", label: "学习" },
  { value: "PS", label: "PS" },
  { value: "原创", label: "原创" },
];

/** 分区列表 */
const CATEGORY_OPTIONS = [
  { value: "生活", label: "生活" },
  { value: "知识", label: "知识" },
  { value: "科技", label: "科技" },
  { value: "游戏", label: "游戏" },
  { value: "音乐", label: "音乐" },
  { value: "动画", label: "动画" },
  { value: "影视", label: "影视" },
  { value: "舞蹈", label: "舞蹈" },
];

/**
 * 视频配置表单组件：每个视频对应的封面、标题、类型、分区、标签等配置。
 * @param {Object} props
 * @param {Object} props.config 当前视频配置对象。
 * @param {Function} props.onConfigChange 配置变更回调。
 */
class HGVideoConfigForm extends React.Component {
  /**
   * 更新配置字段。
   * @param {string} fieldName 字段名。
   * @param {*} fieldValue 字段值。
   */
  handleFieldChange = (fieldName, fieldValue) => {
    const { config, onConfigChange } = this.props;
    if (onConfigChange) {
      onConfigChange({
        ...config,
        [fieldName]: fieldValue,
      });
    }
  };

  /**
   * 渲染封面选择区域：从视频帧中选择封面。
   * @returns {React.ReactNode} 封面选择 JSX。
   */
  renderCoverSection = () => {
    const { config } = this.props;
    return (
      <div className={styles.formItem}>
        <span className={styles.formLabel}>封面 <span className={styles.required}>*</span></span>
        <div className={styles.coverArea}>
          {config.coverUrl ? (
            <img src={config.coverUrl} alt="封面预览" className={styles.coverPreview} />
          ) : (
            <div className={styles.coverEmpty}>从视频帧中选择封面</div>
          )}
        </div>
      </div>
    );
  };

  /**
   * 渲染类型选择（自制/转载）。
   * @returns {React.ReactNode} 类型选择 JSX。
   */
  renderTypeSection = () => {
    const { config } = this.props;
    return (
      <div className={styles.formItem}>
        <span className={styles.formLabel}>类型</span>
        <div className={styles.radioGroup}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="videoType"
              checked={config.videoType === "自制"}
              onChange={() => this.handleFieldChange("videoType", "自制")}
            />
            <span>自制</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="videoType"
              checked={config.videoType === "转载"}
              onChange={() => this.handleFieldChange("videoType", "转载")}
            />
            <span>转载</span>
          </label>
        </div>
        {config.videoType === "转载" ? (
          <input
            className={styles.inputControl}
            value={config.sourceUrl || ""}
            placeholder="请输入转载来源 URL"
            onChange={(e) => this.handleFieldChange("sourceUrl", e.target.value)}
          />
        ) : null}
      </div>
    );
  };

  /**
   * 渲染标签选择区域。
   * @returns {React.ReactNode} 标签选择 JSX。
   */
  renderTagSection = () => {
    const { config } = this.props;
    return (
      <div className={styles.formItem}>
        <span className={styles.formLabel}>
          标签 <span className={styles.required}>*</span>
          <span className={styles.tagLimit}>（最多 7 个）</span>
        </span>
        <HGTagSelector
          options={RECOMMEND_TAGS}
          value={config.tags || []}
          multiple
          maxCount={7}
          onChange={(newTags) => this.handleFieldChange("tags", newTags)}
        />
      </div>
    );
  };

  /**
   * 组件主渲染：封面、标题、类型、分区、标签、简介。
   * @returns {React.ReactNode} 视频配置表单 JSX。
   */
  render() {
    const { config } = this.props;

    return (
      <div className={styles.container}>
        {this.renderCoverSection()}

        <label className={styles.formItem}>
          <span className={styles.formLabel}>
            标题 <span className={styles.required}>*</span>
          </span>
          <input
            className={styles.inputControl}
            value={config.title || ""}
            maxLength={80}
            placeholder="请输入稿件标题"
            onChange={(e) => this.handleFieldChange("title", e.target.value)}
          />
          <span className={styles.charCount}>{(config.title || "").length}/80</span>
        </label>

        {this.renderTypeSection()}

        <div className={styles.formItem}>
          <span className={styles.formLabel}>
            分区 <span className={styles.required}>*</span>
          </span>
          <HGDropdownSelector
            options={CATEGORY_OPTIONS}
            value={config.category || ""}
            placeholder="请选择分区"
            onChange={(val) => this.handleFieldChange("category", val)}
          />
        </div>

        {this.renderTagSection()}

        <label className={styles.formItem}>
          <span className={styles.formLabel}>简介</span>
          <textarea
            className={`${styles.inputControl} ${styles.textareaControl}`}
            value={config.description || ""}
            maxLength={2000}
            placeholder="填写视频简介，让观众更快了解你的作品"
            onChange={(e) => this.handleFieldChange("description", e.target.value)}
          />
        </label>
      </div>
    );
  }
}

export default HGVideoConfigForm;

import React from "react";
import styles from "./hg_more_settings.module.css";

/** 创作声明选项 */
const CREATION_STATEMENTS = [
  { value: "ai", label: "作者声明：该视频使用人工智能合成技术" },
  { value: "danger", label: "作者声明：视频内含有危险行为，请勿轻易模仿" },
  { value: "entertainment", label: "作者声明：该内容仅供娱乐，请勿过分解读" },
  { value: "uncomfortable", label: "作者声明：该内容可能引人不适，请谨慎选择观看" },
  { value: "consume", label: "作者声明：请理性适度消费" },
  { value: "personal", label: "作者声明：个人观点，仅供参考" },
];

/**
 * 更多设置组件：展开/收起，包含水印、可见范围、声明权益、视频元素、互动管理。
 * @param {Object} props
 * @param {Object} props.settings 设置对象。
 * @param {Function} props.onSettingsChange 设置变更回调。
 */
class HGMoreSettings extends React.Component {
  /**
   * 构造函数：初始化展开状态。
   * @param {Object} props 组件属性。
   */
  constructor(props) {
    super(props);
    this.state = {
      expanded: false,
    };
  }

  /**
   * 切换展开/收起。
   */
  toggleExpanded = () => {
    this.setState((prev) => ({ expanded: !prev.expanded }));
  };

  /**
   * 更新设置字段。
   * @param {string} fieldName 字段名。
   * @param {*} fieldValue 字段值。
   */
  handleFieldChange = (fieldName, fieldValue) => {
    const { settings, onSettingsChange } = this.props;
    if (onSettingsChange) {
      onSettingsChange({
        ...settings,
        [fieldName]: fieldValue,
      });
    }
  };

  /**
   * 渲染水印设置。
   * @returns {React.ReactNode} 水印设置 JSX。
   */
  renderWatermark = () => {
    const { settings } = this.props;
    return (
      <div className={styles.settingItem}>
        <span className={styles.settingLabel}>添加水印</span>
        <label className={styles.switchLabel}>
          <input
            type="checkbox"
            checked={settings?.watermark || false}
            onChange={(e) => this.handleFieldChange("watermark", e.target.checked)}
          />
          <span>开启</span>
        </label>
        <span className={styles.settingHint}>仅对此次上传的视频有效</span>
      </div>
    );
  };

  /**
   * 渲染可见范围设置。
   * @returns {React.ReactNode} 可见范围 JSX。
   */
  renderVisibility = () => {
    const { settings } = this.props;
    return (
      <div className={styles.settingItem}>
        <span className={styles.settingLabel}>可见范围</span>
        <div className={styles.radioGroup}>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="visibility"
              checked={settings?.visibility === "public"}
              onChange={() => this.handleFieldChange("visibility", "public")}
            />
            <span>公开可见</span>
          </label>
          <label className={styles.radioOption}>
            <input
              type="radio"
              name="visibility"
              checked={settings?.visibility === "private"}
              onChange={() => this.handleFieldChange("visibility", "private")}
            />
            <span>仅自己可见</span>
          </label>
        </div>
      </div>
    );
  };

  /**
   * 渲染创作声明设置。
   * @returns {React.ReactNode} 创作声明 JSX。
   */
  renderDeclaration = () => {
    const { settings } = this.props;
    return (
      <div className={styles.settingItem}>
        <span className={styles.settingLabel}>创作声明</span>
        <select
          className={styles.selectControl}
          value={settings?.declaration || ""}
          onChange={(e) => this.handleFieldChange("declaration", e.target.value)}
        >
          <option value="">无</option>
          {CREATION_STATEMENTS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  };

  /**
   * 渲染高级设置（杜比音效、Hi-Res）。
   * @returns {React.ReactNode} 高级设置 JSX。
   */
  renderAdvancedSettings = () => {
    const { settings } = this.props;
    return (
      <div className={styles.settingItem}>
        <span className={styles.settingLabel}>高级设置</span>
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={settings?.dolbyAudio || false}
              onChange={(e) => this.handleFieldChange("dolbyAudio", e.target.checked)}
            />
            <span>杜比音效</span>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={settings?.hiResAudio || false}
              onChange={(e) => this.handleFieldChange("hiResAudio", e.target.checked)}
            />
            <span>Hi-Res 无损音质</span>
          </label>
        </div>
      </div>
    );
  };

  /**
   * 渲染互动管理设置。
   * @returns {React.ReactNode} 互动管理 JSX。
   */
  renderInteractionSettings = () => {
    const { settings } = this.props;
    return (
      <div className={styles.settingItem}>
        <span className={styles.settingLabel}>互动管理</span>
        <div className={styles.checkboxGroup}>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={settings?.disableDanmaku || false}
              onChange={(e) => this.handleFieldChange("disableDanmaku", e.target.checked)}
            />
            <span>关闭弹幕</span>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={settings?.disableComment || false}
              onChange={(e) => this.handleFieldChange("disableComment", e.target.checked)}
            />
            <span>关闭评论</span>
          </label>
          <label className={styles.checkboxOption}>
            <input
              type="checkbox"
              checked={settings?.featuredComment || false}
              onChange={(e) => this.handleFieldChange("featuredComment", e.target.checked)}
            />
            <span>开启精选评论</span>
          </label>
        </div>
      </div>
    );
  };

  /**
   * 组件主渲染：展开/收起按钮 + 设置面板。
   * @returns {React.ReactNode} 更多设置 JSX。
   */
  render() {
    const { expanded } = this.state;

    return (
      <div className={styles.container}>
        <button
          type="button"
          className={styles.toggleBtn}
          onClick={this.toggleExpanded}
        >
          <span>更多设置</span>
          <span className={`${styles.arrow} ${expanded ? styles.arrowUp : ""}`}>▾</span>
        </button>
        {expanded ? (
          <div className={styles.settingsPanel}>
            {this.renderWatermark()}
            {this.renderVisibility()}
            {this.renderDeclaration()}
            {this.renderAdvancedSettings()}
            {this.renderInteractionSettings()}
          </div>
        ) : null}
      </div>
    );
  }
}

export default HGMoreSettings;

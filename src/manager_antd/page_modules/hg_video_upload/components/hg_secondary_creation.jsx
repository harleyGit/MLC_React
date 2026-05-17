import React from "react";
import styles from "./hg_secondary_creation.module.css";

/** 商业推广类型选项 */
const PROMOTION_TYPE_OPTIONS = [
  { value: "手机游戏", label: "手机游戏" },
  { value: "通用行业", label: "通用行业" },
  { value: "主机游戏", label: "主机游戏" },
  { value: "网页游戏", label: "网页游戏" },
  { value: "PC单机游戏", label: "PC 单机游戏" },
  { value: "PC网络游戏", label: "PC 网络游戏" },
  { value: "软件及APP", label: "软件及 APP" },
];

/** 推广形式选项 */
const PROMOTION_FORM_OPTIONS = [
  { value: "定制软广", label: "定制软广" },
  { value: "其他", label: "其他" },
  { value: "口播", label: "口播" },
  { value: "贴片", label: "贴片" },
  { value: "字幕推广", label: "字幕推广" },
  { value: "TVC植入", label: "TVC植入" },
  { value: "Logo", label: "Logo" },
  { value: "二维码", label: "二维码" },
  { value: "节目赞助", label: "节目赞助" },
  { value: "slogan", label: "slogan" },
];

/**
 * 二创设置组件：允许二创开关 + 商业推广设置。
 * @param {Object} props
 * @param {boolean} props.allowSecondaryCreation 是否允许二创。
 * @param {boolean} props.hasCommercial 是否包含商业推广。
 * @param {Object} props.commercialInfo 商业推广信息 {type, name, form}。
 * @param {Function} props.onSecondaryCreationChange 二创开关回调。
 * @param {Function} props.onCommercialChange 商业推广开关回调。
 * @param {Function} props.onCommercialInfoChange 商业推广信息变更回调。
 */
class HGSecondaryCreation extends React.Component {
  /**
   * 组件主渲染：二创开关、商业推广开关及配置。
   * @returns {React.ReactNode} 二创设置 JSX。
   */
  render() {
    const {
      allowSecondaryCreation,
      hasCommercial,
      commercialInfo,
      onSecondaryCreationChange,
      onCommercialChange,
      onCommercialInfoChange,
    } = this.props;

    return (
      <div className={styles.container}>
        <div className={styles.row}>
          <label className={styles.radioLabel}>
            <input
              type="checkbox"
              checked={allowSecondaryCreation}
              onChange={(e) => onSecondaryCreationChange?.(e.target.checked)}
            />
            <span>允许二创</span>
          </label>
        </div>

        <div className={styles.row}>
          <label className={styles.radioLabel}>
            <input
              type="checkbox"
              checked={hasCommercial}
              onChange={(e) => onCommercialChange?.(e.target.checked)}
            />
            <span>增加商业推广信息（单稿件仅支持一种商业推广信息）</span>
          </label>
        </div>

        {hasCommercial ? (
          <div className={styles.commercialBox}>
            <div className={styles.commercialItem}>
              <span className={styles.commercialLabel}>推广类型</span>
              <select
                className={styles.selectControl}
                value={commercialInfo?.type || ""}
                onChange={(e) =>
                  onCommercialInfoChange?.({
                    ...commercialInfo,
                    type: e.target.value,
                  })
                }
              >
                <option value="">请选择</option>
                {PROMOTION_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.commercialItem}>
              <span className={styles.commercialLabel}>推广名称</span>
              <input
                className={styles.inputControl}
                value={commercialInfo?.name || ""}
                placeholder="请输入推广名称"
                onChange={(e) =>
                  onCommercialInfoChange?.({
                    ...commercialInfo,
                    name: e.target.value,
                  })
                }
              />
            </div>
            <div className={styles.commercialItem}>
              <span className={styles.commercialLabel}>推广形式</span>
              <select
                className={styles.selectControl}
                value={commercialInfo?.form || ""}
                onChange={(e) =>
                  onCommercialInfoChange?.({
                    ...commercialInfo,
                    form: e.target.value,
                  })
                }
              >
                <option value="">请选择</option>
                {PROMOTION_FORM_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
      </div>
    );
  }
}

export default HGSecondaryCreation;

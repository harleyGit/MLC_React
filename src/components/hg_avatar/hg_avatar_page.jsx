/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-10-29
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/components/hg_avatar/hg_avatar_page.jsx
 * @Description: 头像组件，无图时按名称首字生成带确定性底色的文字头像
 */
import React from "react";
import styles from "./hg_avatar_page.module.css";

/** 头像尺寸映射。 */
const SIZE_CLASS_MAP = {
  small: styles.sizeSmall,
  default: styles.sizeDefault,
  large: styles.sizeLarge,
};

/** 预设底色盘：按名称哈希取色，保证同名头像颜色稳定。 */
const AVATAR_COLORS = [
  "#3370ff",
  "#00b42a",
  "#ff7d00",
  "#722ed1",
  "#f53f3f",
  "#14c0cc",
  "#f7ba1e",
  "#f77eb9",
];

/**
 * 头像组件。
 * 职责：展示头像图片或名称首字文字头像，只负责展示。
 *
 * Props:
 * - name: 用户名称，用于生成文字头像与底色。
 * - src: 头像图片地址；有值时优先展示图片。
 * - size: 尺寸，small / default / large，默认 default。
 */
class HGAvatarPage extends React.PureComponent {
  /**
   * 取名称展示字符：中文取首字，英文取首字母并大写。
   * @param {string} name 用户名称。
   * @returns {string} 展示字符。
   */
  getDisplayChar = (name) => {
    const text = String(name || "").trim();
    if (!text) return "?";
    return text.slice(0, 1).toUpperCase();
  };

  /**
   * 按名称哈希确定性选择底色，避免随机色导致同用户颜色跳动。
   * @param {string} name 用户名称。
   * @returns {string} 十六进制颜色值。
   */
  getAvatarColor = (name) => {
    const text = String(name || "").trim();
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 100000;
    }
    return AVATAR_COLORS[hash % AVATAR_COLORS.length];
  };

  render() {
    const { name = "", src, size = "default" } = this.props;
    const rootClass = [
      styles.avatar,
      SIZE_CLASS_MAP[size] || SIZE_CLASS_MAP.default,
    ]
      .filter(Boolean)
      .join(" ");

    if (src) {
      return <img className={rootClass} src={src} alt={name} />;
    }

    return (
      <span
        className={rootClass}
        style={{ background: this.getAvatarColor(name) }}
      >
        {this.getDisplayChar(name)}
      </span>
    );
  }
}

export default HGAvatarPage;

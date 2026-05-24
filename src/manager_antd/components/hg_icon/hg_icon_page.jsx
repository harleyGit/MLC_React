import React from "react";
import styles from "./hg_icon.module.css";

const ICON_PATHS = {
  user: "M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v1.2c0 .7.5 1.2 1.2 1.2h16.8c.7 0 1.2-.5 1.2-1.2v-1.2c0-3.2-6.4-4.8-9.6-4.8z",
  lock: "M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1s3.1 1.39 3.1 3.1v2z",
  mail: "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
  mobile: "M17 1.01L7 1c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-1.99-2-1.99zM17 19H7V5h10v14zm-4.2-5.78v1.75l3.2-2.99L12.8 9v1.7c-3.11.43-4.35 2.56-4.8 4.7 1.11-1.55 2.71-2.2 4.8-2.18z",
};

/**
 * SVG 图标组件，通过 type 渲染对应图标。
 * 支持 user、lock、mail、mobile 四种图标类型。
 */
class HGIconPage extends React.PureComponent {
  /**
   * 获取图标 SVG 路径。
   * @returns {string} SVG path d 属性值。
   */
  getPath = () => {
    const { type } = this.props;
    return ICON_PATHS[type] || ICON_PATHS.user;
  };

  render() {
    const { style, className = "", onClick } = this.props;
    const wrapperClass = [styles.icon, className].filter(Boolean).join(" ");

    return (
      <span className={wrapperClass} style={style} onClick={onClick} role={onClick ? "button" : undefined}>
        <svg
          viewBox="0 0 24 24"
          width="1em"
          height="1em"
          fill="currentColor"
          aria-hidden="true"
          focusable="false"
        >
          <path d={this.getPath()} />
        </svg>
      </span>
    );
  }
}

export default HGIconPage;

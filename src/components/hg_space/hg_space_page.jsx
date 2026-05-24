/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_space/hg_space_page.jsx
 * @Description: 自定义间距组件，替代 antd Space，支持 direction、size 与 flexbox 布局
 */
import React from "react";
import styles from "./hg_space.module.css";

const SIZE_GAP_MAP = {
  small: 8,
  middle: 16,
  large: 24,
};

/**
 * 自定义间距组件，兼容 antd Space 主要 props。
 * 支持 direction、size、className、style 等属性。
 * 使用 flexbox 布局，通过 gap 控制子元素间距。
 */
class HGSpacePage extends React.PureComponent {
  /**
   * 获取 gap 数值（像素）。
   * @returns {number} gap 值。
   */
  getGap = () => {
    const { size = "middle" } = this.props;
    if (typeof size === "number") {
      return size;
    }
    return SIZE_GAP_MAP[size] ?? SIZE_GAP_MAP.middle;
  };

  /**
   * 获取 Space 根节点 className。
   * @returns {string} 组合后的 className。
   */
  getClassName = () => {
    const { direction = "horizontal", className = "" } = this.props;
    return [
      styles.space,
      direction === "vertical" ? styles.vertical : styles.horizontal,
      className,
    ]
      .filter(Boolean)
      .join(" ");
  };

  /**
   * 获取内联样式（含 gap）。
   * @returns {Object} 合并后的 style 对象。
   */
  getStyle = () => {
    const { style } = this.props;
    return {
      gap: this.getGap(),
      ...style,
    };
  };

  /**
   * 渲染间距组件。
   * @returns {React.ReactNode} Space 节点。
   */
  render() {
    const { children } = this.props;

    return (
      <div className={this.getClassName()} style={this.getStyle()}>
        {children}
      </div>
    );
  }
}

export default HGSpacePage;

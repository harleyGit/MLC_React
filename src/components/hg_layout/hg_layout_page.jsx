/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-24
 * @FilePath: /MLC_React/src/manager_antd/components/hg_layout/hg_layout_page.jsx
 * @Description: 页面布局组件集，替代 antd Layout，包含 Layout/Header/Content/Footer 四个子组件
 */
import React from "react";
import styles from "./hg_layout.module.css";

/**
 * 根布局容器，替代 antd Layout。
 * 职责：提供页面整体布局结构（flex 纵向排列）。
 * 输入：className, style, children。
 */
/** @extends {React.Component<Partial<typeof HGLayoutPage.defaultProps>>} */
class HGLayoutPage extends React.Component {
  static defaultProps = {
    /** 布局子区块，默认 undefined 无内容。 @type {React.ReactNode} */
    children: undefined,
    /** 根布局附加样式类，默认空字符串。 */
    className: "",
    /** 根布局行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  /**
   * 渲染根布局容器。
   * @returns {React.ReactNode} 布局节点。
   */
  render() {
    const { className = "", style, children } = this.props;
    return (
      <div className={`${styles.layout} ${className}`} style={style}>
        {children}
      </div>
    );
  }
}

/**
 * 顶部固定 Header 容器，替代 antd Layout.Header。
 * 职责：渲染深色顶部导航栏，固定在页面顶部。
 * 输入：className, style, children。
 */
/** @extends {React.Component<Partial<typeof HGLayoutHeader.defaultProps>>} */
class HGLayoutHeader extends React.Component {
  static defaultProps = {
    /** 页头内容，默认 undefined 无内容。 @type {React.ReactNode} */
    children: undefined,
    /** 页头附加样式类，默认空字符串。 */
    className: "",
    /** 页头行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  /**
   * 渲染顶部 Header 容器。
   * @returns {React.ReactNode} header 节点。
   */
  render() {
    const { className = "", style, children } = this.props;
    return (
      <header className={`${styles.header} ${className}`} style={style}>
        {children}
      </header>
    );
  }
}

/**
 * 主内容区域，替代 antd Layout.Content。
 * 职责：占据剩余空间渲染页面主体内容。
 * 输入：className, style, children。
 */
/** @extends {React.Component<Partial<typeof HGLayoutContent.defaultProps>>} */
class HGLayoutContent extends React.Component {
  static defaultProps = {
    /** 页面主体，默认 undefined 无内容。 @type {React.ReactNode} */
    children: undefined,
    /** 主体附加样式类，默认空字符串。 */
    className: "",
    /** 主体行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  /**
   * 渲染主内容区域。
   * @returns {React.ReactNode} main 节点。
   */
  render() {
    const { className = "", style, children } = this.props;
    return (
      <main className={`${styles.content} ${className}`} style={style}>
        {children}
      </main>
    );
  }
}

/**
 * 底部 Footer 容器，替代 antd Layout.Footer。
 * 职责：渲染页面底部区域。
 * 输入：className, style, children。
 */
/** @extends {React.Component<Partial<typeof HGLayoutFooter.defaultProps>>} */
class HGLayoutFooter extends React.Component {
  static defaultProps = {
    /** 页脚内容，默认 undefined 无内容。 @type {React.ReactNode} */
    children: undefined,
    /** 页脚附加样式类，默认空字符串。 */
    className: "",
    /** 页脚行内样式，默认 undefined。 @type {React.CSSProperties|undefined} */
    style: undefined,
  };

  /**
   * 渲染底部 Footer 容器。
   * @returns {React.ReactNode} footer 节点。
   */
  render() {
    const { className = "", style, children } = this.props;
    return (
      <footer className={`${styles.footer} ${className}`} style={style}>
        {children}
      </footer>
    );
  }
}

export { HGLayoutPage, HGLayoutHeader, HGLayoutContent, HGLayoutFooter };
export default HGLayoutPage;

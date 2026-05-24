import React from "react";
import styles from "./hg_layout.module.css";

/**
 * 根布局容器，替代 antd Layout。
 * 职责：提供页面整体布局结构（flex 纵向排列）。
 * 输入：className, style, children。
 */
class HGLayoutPage extends React.Component {
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
class HGLayoutHeader extends React.Component {
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
class HGLayoutContent extends React.Component {
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
class HGLayoutFooter extends React.Component {
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

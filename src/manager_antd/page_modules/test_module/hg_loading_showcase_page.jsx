/**
 * hg_loading_showcase_page.jsx
 * 测试模块「UI组件 > CSS 加载动画」展示页（由单文件 HTML 演示页转换而来）。
 * 职责：渲染 8 种动画卡片网格（实时预览 + 名称 + 描述 + 复制按钮），
 * 并维护「复制成功」的临时 UI 状态。因存在交互状态与定时器清理，
 * 按项目约定使用类组件。
 * 依赖：动画预览组件来自 hg_loading_animations 组件库，数据来自 hg_loading_animations_data.js。
 */

import React from "react";
import styles from "./hg_loading_showcase.module.css";
import { LOADING_ANIMATIONS } from "./hg_loading_animations_data.js";

/** 「已复制」提示的展示时长（毫秒），超时后按钮文案恢复 */
const COPY_FEEDBACK_MS = 1600;

export default class HGLoadingShowcasePage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // 当前已复制成功的动画 key，用于按钮文案与高亮；null 表示无
      copiedKey: null,
    };
    // 恢复按钮文案的定时器句柄，卸载时需清理避免内存泄漏
    this.resetTimer = null;
  }

  componentWillUnmount() {
    // 组件卸载时清理定时器，防止对已卸载组件调用 setState
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
  }

  /**
   * 复制指定动画的 CSS 片段到剪贴板。
   * 边界：优先使用异步 Clipboard API，失败时降级为 execCommand 方案；
   * 两种路径统一走 onCopySuccess 更新 UI 反馈。
   */
  handleCopy = (item) => {
    const writePromise =
      navigator.clipboard && navigator.clipboard.writeText
        ? navigator.clipboard.writeText(item.css)
        : Promise.resolve(this.copyByExecCommand(item.css));

    writePromise
      .then(() => this.onCopySuccess(item.key))
      .catch(() => this.onCopySuccess(item.key));
  };

  /** 降级复制方案：临时 textarea + execCommand，兼容旧环境 */
  copyByExecCommand(text) {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
  }

  /** 复制成功后的 UI 反馈：标记 copiedKey，并在固定时长后复位 */
  onCopySuccess(key) {
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.setState({ copiedKey: key });
    this.resetTimer = setTimeout(() => {
      this.setState({ copiedKey: null });
      this.resetTimer = null;
    }, COPY_FEEDBACK_MS);
  }

  /** 渲染页头：标题与副标题说明 */
  renderHeader() {
    return (
      <header className={styles.pageHeader}>
        <h1 className={styles.title}>CSS 加载动画合集</h1>
        <p className={styles.subtitle}>
          8 种纯 CSS Loading 动画 · 仅使用 keyframes + transform · 复制即可使用
        </p>
      </header>
    );
  }

  /** 渲染单张动画卡片：预览区 + 名称 + 描述 + 复制按钮 */
  renderCard(item) {
    const { Preview } = item;
    const isCopied = this.state.copiedKey === item.key;
    const btnClass = isCopied
      ? `${styles.copyBtn} ${styles.copyBtnActive}`
      : styles.copyBtn;

    return (
      <div className={styles.card} key={item.key}>
        <div className={styles.preview}>
          <Preview />
        </div>
        <h3 className={styles.cardTitle}>{item.name}</h3>
        <p className={styles.cardDesc}>{item.desc}</p>
        <button
          type="button"
          className={btnClass}
          onClick={() => this.handleCopy(item)}
        >
          {isCopied ? "已复制 ✓" : "复制 CSS"}
        </button>
      </div>
    );
  }

  /** 渲染卡片网格：响应式多列布局 */
  renderGrid() {
    return (
      <main className={styles.grid}>
        {LOADING_ANIMATIONS.map((item) => this.renderCard(item))}
      </main>
    );
  }

  render() {
    return (
      <div className={styles.page}>
        {this.renderHeader()}
        {this.renderGrid()}
      </div>
    );
  }
}

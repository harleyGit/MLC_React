/**
 * hg_loading_animations.jsx
 * 8 种纯 CSS 加载动画的可复用组件库，供工程各业务直接引用。
 * 职责边界：仅渲染动画 DOM，无业务状态，按项目约定使用简单函数组件；
 * 动画本体由 hg_loading_animations.module.css 提供（仅 keyframes + transform）。
 * 约定：
 * 1. 动画颜色跟随使用处的文字色（currentColor），可用 color 属性覆盖；
 * 2. 通用 props：className（追加样式）、style（内联覆盖尺寸等）、color（主色）；
 * 3. prefers-reduced-motion 降级统一在 module.css 末尾处理。
 * 动画效果预览页见测试模块 test_module/hg_loading_showcase_page.jsx。
 */

import styles from "./hg_loading_animations.module.css";

/**
 * 组装组件根节点内联样式：color 需要透传为 color（驱动 currentColor）。
 * @param {string|undefined} color 主色。
 * @param {Object|undefined} style 调用方传入的内联样式，优先级更高。
 * @returns {Object|undefined} 根节点 style。
 */
const hgBuildRootStyle = (color, style) => {
  if (!color) return style;
  return { color, ...style };
};

/**
 * 拼接根节点 className（CSS Modules 类 + 调用方追加类）。
 * @param {string} moduleClass CSS Modules 类名。
 * @param {string} className 调用方追加类名。
 * @returns {string} 根节点 className。
 */
const hgJoinClass = (moduleClass, className = "") => {
  return `${moduleClass} ${className}`.trim();
};

/** 动画 1：旋转圆环 —— 渐变边框旋转，经典加载指示器 */
export function HGRingSpinner({ className, style, color }) {
  return (
    <span
      className={hgJoinClass(styles.ringSpinner, className)}
      style={hgBuildRootStyle(color, style)}
      aria-hidden="true"
    />
  );
}

/** 动画 2：脉冲圆点 —— 三点交错缩放，简约节奏感 */
export function HGPulseDots({ className, style, color }) {
  return (
    <span
      className={hgJoinClass(styles.pulseDots, className)}
      style={hgBuildRootStyle(color, style)}
      aria-hidden="true"
    >
      <span /><span /><span />
    </span>
  );
}

/**
 * 动画 3：弹跳柱条 —— 五柱交错弹跳。
 * @param {string} size 尺寸："default"（56px 高）| "small"（18px 高，语音气泡等紧凑场景）。
 */
export function HGBounceBars({ className, style, color, size = "default" }) {
  const sizeClass = size === "small" ? styles.bounceBarsSmall : "";
  return (
    <span
      className={hgJoinClass(`${styles.bounceBars} ${sizeClass}`, className)}
      style={hgBuildRootStyle(color, style)}
      aria-hidden="true"
    >
      <span /><span /><span /><span /><span />
    </span>
  );
}

/** 动画 4：波纹圆圈 —— 涟漪扩散，雷达探测感 */
export function HGRipple({ className, style, color }) {
  return (
    <span
      className={hgJoinClass(styles.ripple, className)}
      style={hgBuildRootStyle(color, style)}
      aria-hidden="true"
    >
      <span /><span />
    </span>
  );
}

/** 动画 5：渐变旋转器 —— conic-gradient 锥形渐变旋转，请求加载推荐样式 */
export function HGConicSpinner({ className, style, color }) {
  return (
    <span
      className={hgJoinClass(styles.conicSpinner, className)}
      style={hgBuildRootStyle(color, style)}
      aria-hidden="true"
    />
  );
}

/** 动画 6：打字指示器 —— 聊天气泡三点，对话 UI 必备 */
export function HGTypingBubble({ className, style }) {
  return (
    <span
      className={hgJoinClass(styles.typingBubble, className)}
      style={style}
      aria-hidden="true"
    >
      <span /><span /><span />
    </span>
  );
}

/** 动画 7：骨架屏微光 —— 头像 + 文本行 + 内容块的扫光占位组合 */
export function HGSkeleton({ className, style }) {
  return (
    <div
      className={hgJoinClass(styles.skeleton, className)}
      style={style}
      aria-hidden="true"
    >
      <div className={styles.skeletonRow}>
        <div className={styles.skeletonAvatar} />
        <div className={styles.skeletonLines}>
          <div className={styles.skeletonLine} />
          <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
        </div>
      </div>
      <div className={styles.skeletonBlock} />
    </div>
  );
}

/**
 * 列表骨架屏：按行数渲染「头像 + 文本行」占位卡片，用于列表数据未返回前的占位。
 * @param {number} rows 占位行数，范围 1-10，默认 3。
 */
export function HGSkeletonList({ className, style, rows = 3 }) {
  const safeRows = Math.max(1, Math.min(Number(rows) || 3, 10));
  return (
    <div
      className={hgJoinClass(styles.skeletonListRoot, className)}
      style={style}
      role="status"
      aria-label="内容加载中"
    >
      {Array.from({ length: safeRows }, (_, index) => (
        <div className={styles.skeletonListRow} key={index} aria-hidden="true">
          <div className={styles.skeletonAvatar} />
          <div className={styles.skeletonLines}>
            <div className={styles.skeletonLine} />
            <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** 动画 8：DNA 双螺旋 —— 双链旋转，科技生物感 */
export function HGDnaHelix({ className, style, color }) {
  return (
    <span
      className={hgJoinClass(styles.dna, className)}
      style={hgBuildRootStyle(color, style)}
      aria-hidden="true"
    >
      <i /><i className={styles.dnaChainB} />
      <i /><i className={styles.dnaChainB} />
      <i /><i className={styles.dnaChainB} />
      <i /><i className={styles.dnaChainB} />
    </span>
  );
}

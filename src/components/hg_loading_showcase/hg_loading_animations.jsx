/**
 * hg_loading_animations.jsx
 * 8 种纯 CSS 加载动画的展示组件。
 * 职责边界：仅负责单个动画的 DOM 结构渲染，无任何业务状态，
 * 因此按项目约定使用简单函数组件；动画本体由 hg_loading_showcase.module.css 提供。
 * 约束：动画仅依赖 CSS keyframes + transform，不引入第三方库。
 * 动画清单与可复制 CSS 片段见 hg_loading_registry.jsx，
 * 本文件只导出组件，以满足 react-refresh 对组件文件仅导出组件的约束。
 */

import styles from './hg_loading_showcase.module.css';

/** 动画 1：旋转圆环 —— 渐变边框旋转，经典加载指示器 */
export function HGRingSpinner() {
  return <div className={styles.ringSpinner} />;
}

/** 动画 2：脉冲圆点 —— 三点交错缩放，简约节奏感 */
export function HGPulseDots() {
  return (
    <div className={styles.pulseDots}>
      <span /><span /><span />
    </div>
  );
}

/** 动画 3：弹跳柱条 —— 五柱交错弹跳，音频可视化风格 */
export function HGBounceBars() {
  return (
    <div className={styles.bounceBars}>
      <span /><span /><span /><span /><span />
    </div>
  );
}

/** 动画 4：波纹圆圈 —— 涟漪扩散，雷达探测感 */
export function HGRipple() {
  return (
    <div className={styles.ripple}>
      <span /><span />
    </div>
  );
}

/** 动画 5：渐变旋转器 —— conic-gradient 锥形渐变旋转，现代质感 */
export function HGConicSpinner() {
  return <div className={styles.conicSpinner} />;
}

/** 动画 6：打字指示器 —— 聊天气泡三点，对话 UI 必备 */
export function HGTypingBubble() {
  return (
    <div className={styles.typingBubble}>
      <span /><span /><span />
    </div>
  );
}

/** 动画 7：骨架屏微光 —— 占位内容扫光，加载过渡自然 */
export function HGSkeleton() {
  return (
    <div className={styles.skeleton}>
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

/** 动画 8：DNA 双螺旋 —— 双链旋转，科技生物感 */
export function HGDnaHelix() {
  return (
    <div className={styles.dna}>
      <i className={styles.dnaA} /><i className={styles.dnaB} />
      <i className={styles.dnaA} /><i className={styles.dnaB} />
      <i className={styles.dnaA} /><i className={styles.dnaB} />
      <i className={styles.dnaA} /><i className={styles.dnaB} />
    </div>
  );
}

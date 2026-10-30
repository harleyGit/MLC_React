/**
 * hg_loading_registry.jsx
 * 加载动画注册表：将动画名称、描述、预览组件与可复制的 CSS 源码组合成清单。
 * 职责边界：纯数据与组件引用映射，不含渲染逻辑；独立成文件是为了让
 * hg_loading_animations.jsx 仅导出组件、满足 react-refresh 约束。
 * css 字段为独立可用的样式片段（含 keyframes），复制后即可在其他项目使用。
 */

import {
  HGRingSpinner,
  HGPulseDots,
  HGBounceBars,
  HGRipple,
  HGConicSpinner,
  HGTypingBubble,
  HGSkeleton,
  HGDnaHelix,
} from './hg_loading_animations.jsx';

export const LOADING_ANIMATIONS = [
  {
    key: 'ring',
    name: '旋转圆环',
    desc: '渐变边框旋转，经典加载指示器',
    Preview: HGRingSpinner,
    css: `.ring-spinner {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  border: 4px solid rgba(88, 166, 255, 0.15);
  border-top-color: #58a6ff;
  animation: ring-rotate 1s linear infinite;
}
@keyframes ring-rotate {
  to { transform: rotate(360deg); }
}`,
  },
  {
    key: 'pulse',
    name: '脉冲圆点',
    desc: '三点缩放，简约节奏感',
    Preview: HGPulseDots,
    css: `.pulse-dots {
  display: flex;
  gap: 10px;
}
.pulse-dots span {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #bc8cff;
  animation: pulse-scale 1.2s ease-in-out infinite;
}
.pulse-dots span:nth-child(2) { animation-delay: 0.2s; }
.pulse-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes pulse-scale {
  0%, 100% { transform: scale(0.6); opacity: 0.4; }
  50% { transform: scale(1.15); opacity: 1; }
}`,
  },
  {
    key: 'bars',
    name: '弹跳柱条',
    desc: '五柱交错弹跳，音频可视化风格',
    Preview: HGBounceBars,
    css: `.bounce-bars {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 56px;
}
.bounce-bars span {
  width: 8px;
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(180deg, #58a6ff, #bc8cff);
  animation: bounce-bar 1.1s ease-in-out infinite;
  transform-origin: center;
}
.bounce-bars span:nth-child(2) { animation-delay: 0.12s; }
.bounce-bars span:nth-child(3) { animation-delay: 0.24s; }
.bounce-bars span:nth-child(4) { animation-delay: 0.36s; }
.bounce-bars span:nth-child(5) { animation-delay: 0.48s; }
@keyframes bounce-bar {
  0%, 100% { transform: scaleY(0.35); }
  50% { transform: scaleY(1); }
}`,
  },
  {
    key: 'ripple',
    name: '波纹圆圈',
    desc: '涟漪扩散效果，雷达探测感',
    Preview: HGRipple,
    css: `.ripple {
  position: relative;
  width: 72px;
  height: 72px;
}
.ripple span {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid #58a6ff;
  animation: ripple-expand 1.8s cubic-bezier(0, 0.2, 0.8, 1) infinite;
}
.ripple span:nth-child(2) { animation-delay: -0.9s; }
@keyframes ripple-expand {
  0% { transform: scale(0.15); opacity: 1; }
  100% { transform: scale(1); opacity: 0; }
}`,
  },
  {
    key: 'conic',
    name: '渐变旋转器',
    desc: '锥形渐变旋转，现代质感',
    Preview: HGConicSpinner,
    css: `.conic-spinner {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, transparent 10%, #bc8cff);
  -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));
  mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 calc(100% - 5px));
  animation: conic-rotate 0.9s linear infinite;
}
@keyframes conic-rotate {
  to { transform: rotate(360deg); }
}`,
  },
  {
    key: 'typing',
    name: '打字指示器',
    desc: '聊天输入指示器，对话 UI 必备',
    Preview: HGTypingBubble,
    css: `.typing-bubble {
  background: #21262d;
  border-radius: 20px;
  padding: 14px 20px;
  display: flex;
  gap: 7px;
  align-items: center;
}
.typing-bubble span {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #8b949e;
  animation: typing-bounce 1.3s ease-in-out infinite;
}
.typing-bubble span:nth-child(2) { animation-delay: 0.18s; }
.typing-bubble span:nth-child(3) { animation-delay: 0.36s; }
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-7px); opacity: 1; }
}`,
  },
  {
    key: 'skeleton',
    name: '骨架屏微光',
    desc: '占位内容扫光效果，加载过渡自然',
    Preview: HGSkeleton,
    css: `.skeleton .avatar,
.skeleton .line,
.skeleton .block {
  background: linear-gradient(90deg, #21262d 25%, #30363d 50%, #21262d 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s linear infinite;
}
.skeleton .avatar { width: 42px; height: 42px; border-radius: 50%; }
.skeleton .line { height: 12px; border-radius: 6px; }
.skeleton .block { height: 72px; border-radius: 8px; }
@keyframes skeleton-shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}`,
  },
  {
    key: 'dna',
    name: 'DNA 双螺旋',
    desc: '双链旋转动画，科技生物感',
    Preview: HGDnaHelix,
    css: `.dna {
  position: relative;
  width: 64px;
  height: 96px;
}
.dna i {
  position: absolute;
  left: 50%;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  animation: dna-spin 2.2s linear infinite;
}
.dna i.a { background: #58a6ff; }
.dna i.b { background: #bc8cff; }
/* 偶数节点反向相位，形成双链交错 */
.dna i:nth-child(2n) { animation-delay: -2.2s; }
.dna i:nth-child(1) { top: 0; }
.dna i:nth-child(2) { top: 12px; }
.dna i:nth-child(3) { top: 24px; animation-delay: -0.275s; }
.dna i:nth-child(4) { top: 36px; }
.dna i:nth-child(5) { top: 48px; animation-delay: -0.55s; }
.dna i:nth-child(6) { top: 60px; }
.dna i:nth-child(7) { top: 72px; animation-delay: -0.825s; }
.dna i:nth-child(8) { top: 84px; }
@keyframes dna-spin {
  0%   { transform: translateX(calc(-50% - 22px)) scale(0.7); }
  50%  { transform: translateX(calc(-50% + 22px)) scale(1); }
  100% { transform: translateX(calc(-50% - 22px)) scale(0.7); }
}`,
  },
];

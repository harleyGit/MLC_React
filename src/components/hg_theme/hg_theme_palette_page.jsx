import React from "react";
import styles from "./hg_theme_palette.module.css";

// 预览项记录标签上的 HEX；色块仍使用 CSS token，测试逐项核对文字与 CSS 的原值。
const HG_COLOR_GROUPS = [
  {
    title: "品牌与辅助色",
    colors: [
      ["主蓝", "--brand-glacier", "#1677FF"], ["明媚电光蓝", "--brand-electric", "#28B4F5"],
      ["科技蓝", "--brand-sky", "#1677FF"], ["星云蓝紫", "--brand-nebula", "#8185F4"],
      ["冰海浅蓝", "--brand-ocean", "#89C8FF"], ["冰川浅蓝", "--brand-ice", "#89C8FF"],
      ["浅蓝辅助", "--brand-sky-light", "#5FA8FF"], ["冰蓝背景", "--brand-frost", "#CFF0FF"],
    ],
  },
  {
    title: "主交互与次级交互",
    colors: [
      ["主按钮", "--color-primary", "#1677FF"], ["主按钮 Hover", "--color-primary-hover", "#4096FF"],
      ["主按钮 Active", "--color-primary-active", "#0958D9"], ["主交互浅底", "--color-primary-soft", "#EAF4FF"],
      ["次级按钮", "--color-secondary", "#1677FF"], ["次级 Hover", "--color-secondary-hover", "#4096FF"],
      ["次级浅底", "--color-secondary-soft", "#EDF4FF"],
    ],
  },
  {
    title: "电光强调与 AI",
    colors: [
      ["电光强调", "--color-accent", "#28B4F5"], ["强调 Hover", "--color-accent-hover", "#17A2E0"],
      ["强调浅底", "--color-accent-soft", "#E6F8FF"], ["强调按钮", "--color-accent-action", "#6569D8"],
      ["强调按钮 Hover", "--color-accent-action-hover", "#565AC4"],
      ["AI 星云", "--color-ai", "#8185F4"], ["AI Hover", "--color-ai-hover", "#6569D8"],
      ["AI 浅底", "--color-ai-soft", "#F0F0FF"], ["AI 按钮", "--color-ai-action", "#565AC4"],
    ],
  },
  {
    title: "背景与选中态",
    colors: [
      ["页面", "--color-bg-page", "#F0F7FF"], ["卡片", "--color-bg-surface", "#FFFFFF"],
      ["柔和背景", "--color-bg-subtle", "#F6FAFF"], ["悬浮", "--color-bg-hover", "#F2F8FF"],
      ["选中", "--color-bg-selected", "#EAF4FF"], ["禁用", "--color-bg-disabled", "#F1F5F9"],
    ],
  },
  {
    title: "文字、链接与边框",
    colors: [
      ["正文", "--color-text", "#172B4D"], ["标题", "--color-text-title", "#0F2440"],
      ["次级文字", "--color-text-secondary", "#61758E"], ["弱提示", "--color-text-muted", "#71849B"],
      ["反色文字", "--color-text-inverse", "#FFFFFF"], ["链接", "--color-link", "#1677FF"],
      ["链接 Hover", "--color-link-hover", "#4096FF"], ["边框", "--color-border", "#D6E7F9"],
      ["强边框", "--color-border-strong", "#B5D0ED"], ["聚焦边框", "--color-border-focus", "#1677FF"],
    ],
  },
  {
    title: "状态与深海色",
    colors: [
      ["成功", "--color-success", "#16835D"], ["成功浅底", "--color-success-soft", "#E8F8F0"],
      ["警告", "--color-warning", "#C53225"], ["警告浅底", "--color-warning-soft", "#FFF0F2"],
      ["危险", "--color-danger", "#DA332A"], ["危险浅底", "--color-danger-soft", "#FFF0F2"],
      ["信息", "--color-info", "#1677FF"], ["信息浅底", "--color-info-soft", "#EAF4FF"],
      ["冰海", "--color-ocean", "#89C8FF"], ["冰海 Hover", "--color-ocean-hover", "#565AC4"],
      ["冰海边框", "--color-ocean-border", "#8185F4"],
    ],
  },
  {
    title: "中信红色系",
    colors: [
      ["中信主题红", "--color-zhongxin-brand-red", "#EA494A"],
      ["背景主题红 02", "--color-zhongxin-background-red", "#E8423A"],
      ["中信红 2", "--color-zhongxin-accent-red", "#EC6767"],
      ["K 红线", "--color-k-line-red", "#C53225"],
      ["按钮背景红", "--color-button-red", "#E64642"],
      ["按钮背景红（深）", "--color-button-red-strong", "#DA332A"],
      ["按钮背景红（柔和）", "--color-button-red-soft", "#EB5B55"],
      ["按钮背景红（鲜明）", "--color-button-red-bright", "#E84038"],
      ["价格 / 警示红", "--color-price-red", "#E83E36"],
      ["上证指数红", "--color-index-rise-red", "#D65E53"],
    ],
  },
  {
    title: "渐变",
    colors: [
      ["品牌渐变", "--gradient-brand", "#1677FF → #28B4F5 → #8185F4"],
      ["AI 渐变", "--gradient-ai", "#1677FF → #8185F4"],
      ["柔和渐变", "--gradient-soft", "#F0F7FF → #E6F8FF → #F0F0FF"],
    ],
  },
];

// 深色覆写值只用于标签；实际色块仍由 CSS 决定，未覆写的红色沿用浅色标签。
const HG_DARK_HEX = {
  "--color-primary": "#89C8FF", "--color-primary-hover": "#A5D5FF",
  "--color-primary-active": "#5FA8FF", "--color-primary-soft": "#172B4D",
  "--color-secondary": "#8DAEFF", "--color-secondary-hover": "#A7C2FF",
  "--color-secondary-soft": "#172B4D",
  "--color-accent": "#50C8FA", "--color-accent-hover": "#82DAFF",
  "--color-accent-soft": "#0F2440", "--color-accent-action": "#50C8FA",
  "--color-accent-action-hover": "#82DAFF",
  "--color-ai": "#AAA8FF", "--color-ai-hover": "#C1BEFF",
  "--color-ai-soft": "#172B4D", "--color-ai-action": "#AAA8FF",
  "--color-bg-page": "#0F2440", "--color-bg-surface": "#172B4D",
  "--color-bg-subtle": "#0F2440", "--color-bg-hover": "#61758E",
  "--color-bg-selected": "#65D9A4", "--color-bg-disabled": "#61758E",
  "--color-text": "#E0EDFB", "--color-text-title": "#F4F8FF",
  "--color-text-secondary": "#B8CBE1", "--color-text-muted": "#A8BCD4",
  "--color-text-inverse": "#0F2440", "--color-link": "#89C8FF",
  "--color-link-hover": "#B1DDFF", "--color-border": "#89C8FF",
  "--color-border-strong": "#B5D0ED", "--color-border-focus": "#89C8FF",
  "--color-success": "#65D9A4", "--color-success-soft": "#89C8FF",
  "--color-warning": "#FFD078", "--color-warning-soft": "#B1DDFF",
  "--color-danger": "#FF8D9B", "--color-danger-soft": "#B8CBE1",
  "--color-info": "#89C8FF", "--color-info-soft": "#172B4D",
};

const HG_DARK_COLOR_GROUPS = HG_COLOR_GROUPS
  .filter((hgGroup) => hgGroup.title !== "品牌与辅助色" && hgGroup.title !== "渐变")
  .map((hgGroup) => ({
    ...hgGroup,
    colors: hgGroup.colors.map(([hgLabel, hgToken, hgHex]) => [hgLabel, hgToken, HG_DARK_HEX[hgToken] ?? hgHex]),
  }));

/** 在现有测试模块中展示规范色板，不修改应用实际主题或全局 CSS 变量。 */
export default class HGThemePalettePage extends React.Component {
  /** 色块读取 CSS 变量；标签同步展示对应模式的 HEX，渐变展示各色标。 */
  renderGroup(hgGroup) {
    return (
      <section key={hgGroup.title} className={styles.group} aria-label={hgGroup.title}>
        <h3>{hgGroup.title}</h3>
        <div className={styles.grid}>
          {hgGroup.colors.map(([hgLabel, hgToken, hgHex]) => (
            <div key={hgToken} className={styles.card}>
              <span className={styles.sample} style={{ "--preview-color": `var(${hgToken})` }} aria-hidden="true" />
              <span className={styles.label}>{hgLabel}</span>
              <code className={styles.hex}>{hgHex}</code>
              <code className={styles.token}>{hgToken}</code>
            </div>
          ))}
        </div>
      </section>
    );
  }

  /** 浅色和深色色板独立成区，避免预览样式改变全站主题。 */
  renderPalette(hgDark) {
    const hgGroups = hgDark ? HG_DARK_COLOR_GROUPS : HG_COLOR_GROUPS; // 深色区只展示规范中的覆写色及不变的红色。
    const hgTitle = hgDark ? "深色模式" : "浅色模式"; // 两种模式同时可见，不依赖全局主题状态。
    return (
      <section className={`${styles.palette} ${hgDark ? styles.darkPalette : ""}`} aria-label={`${hgTitle}色彩预览`}>
        <h2>{hgTitle}色彩预览</h2>
        <p className={styles.lead}>色块使用主题规范原值；仅作用于本页，变量名可在下方查看。</p>
        {hgGroups.map((hgGroup) => this.renderGroup(hgGroup))}
      </section>
    );
  }

  render() {
    return <div className={styles.page}>{this.renderPalette(false)}{this.renderPalette(true)}</div>;
  }
}

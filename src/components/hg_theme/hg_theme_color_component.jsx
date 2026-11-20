import paletteCss from "./hg_theme_palette.module.css?raw";

// Vite 的 ?raw 读取预览色板原文；只解析浅色 HEX，避免深色覆写污染默认主题。
const hgLightPalette = paletteCss.match(/\.palette\s*\{([\s\S]*?)\n\}/)?.[1];
if (!hgLightPalette) throw new Error("主题色板缺少浅色变量容器");
const hgPaletteColors = Object.fromEntries(
  [...hgLightPalette.matchAll(/(--[\w-]+):\s*(#[\da-fA-F]{6})\s*;/g)]
    .map(([, hgToken, hgHex]) => [hgToken, hgHex.toLowerCase()])
);

/** 从同一份 CSS 中取得原始 HEX，供换肤混色和既有 JS API 使用；缺失 token 不悄悄降级。 */
function hgPaletteColor(hgToken) {
  const hgHex = hgPaletteColors[hgToken]; // 浅色主题的实际色值，深色预览不参与全局默认色板。
  if (!hgHex) throw new Error(`主题色板缺少颜色 ${hgToken}`);
  return hgHex;
}

/**
 * 主题色彩组件：集中维护主题 token 与颜色计算，供 HGThemeUtils 及样式层复用。
 * 职责边界：只处理颜色值和 CSS 变量，不负责 React 渲染、持久化或主题切换交互。
 */
export default class HGThemeColorComponent {
  /** 默认主题主色与“保存”主按钮一致；主操作按钮使用白色文字。 */
  static DEFAULT_PRIMARY = hgPaletteColor("--color-primary");

  /** 品牌渐变的紫色终点；与主题规范保持一致。 */
  static GRADIENT_END = hgPaletteColor("--brand-nebula");

  /** CSS 浅色 token 的 JS 引用；既有消息样式别名也只复用同一份色板的颜色。 */
  static COLOR_PALETTE = {
    brandGlacier: hgPaletteColor("--brand-glacier"),
    brandElectric: hgPaletteColor("--brand-electric"),
    brandSky: hgPaletteColor("--brand-sky"),
    brandNebula: hgPaletteColor("--brand-nebula"),
    brandOcean: hgPaletteColor("--brand-ocean"),
    brandIce: hgPaletteColor("--brand-ice"),
    brandSkyLight: hgPaletteColor("--brand-sky-light"),
    brandFrost: hgPaletteColor("--brand-frost"),
    primary: hgPaletteColor("--color-primary"),
    primaryHover: hgPaletteColor("--color-primary-hover"),
    primaryActive: hgPaletteColor("--color-primary-active"),
    primarySoft: hgPaletteColor("--color-primary-soft"),
    secondary: hgPaletteColor("--color-secondary"),
    secondaryHover: hgPaletteColor("--color-secondary-hover"),
    secondarySoft: hgPaletteColor("--color-secondary-soft"),
    accent: hgPaletteColor("--color-accent"),
    accentHover: hgPaletteColor("--color-accent-hover"),
    accentSoft: hgPaletteColor("--color-accent-soft"),
    accentAction: hgPaletteColor("--color-accent-action"),
    accentActionHover: hgPaletteColor("--color-accent-action-hover"),
    ai: hgPaletteColor("--color-ai"),
    aiHover: hgPaletteColor("--color-ai-hover"),
    aiSoft: hgPaletteColor("--color-ai-soft"),
    aiAction: hgPaletteColor("--color-ai-action"),
    bgPage: hgPaletteColor("--color-bg-page"),
    bgSurface: hgPaletteColor("--color-bg-surface"),
    bgSubtle: hgPaletteColor("--color-bg-subtle"),
    bgHover: hgPaletteColor("--color-bg-hover"),
    bgSelected: hgPaletteColor("--color-bg-selected"),
    bgDisabled: hgPaletteColor("--color-bg-disabled"),
    text: hgPaletteColor("--color-text"),
    textTitle: hgPaletteColor("--color-text-title"),
    textSecondary: hgPaletteColor("--color-text-secondary"),
    textMuted: hgPaletteColor("--color-text-muted"),
    textInverse: hgPaletteColor("--color-text-inverse"),
    link: hgPaletteColor("--color-link"),
    linkHover: hgPaletteColor("--color-link-hover"),
    border: hgPaletteColor("--color-border"),
    borderStrong: hgPaletteColor("--color-border-strong"),
    borderFocus: hgPaletteColor("--color-border-focus"),
    success: hgPaletteColor("--color-success"),
    successSoft: hgPaletteColor("--color-success-soft"),
    warning: hgPaletteColor("--color-warning"),
    warningSoft: hgPaletteColor("--color-warning-soft"),
    danger: hgPaletteColor("--color-danger"),
    dangerSoft: hgPaletteColor("--color-danger-soft"),
    info: hgPaletteColor("--color-info"),
    infoSoft: hgPaletteColor("--color-info-soft"),
    ocean: hgPaletteColor("--color-ocean"),
    oceanHover: hgPaletteColor("--color-ocean-hover"),
    oceanBorder: hgPaletteColor("--color-ocean-border"),
    cssPrimary: hgPaletteColor("--color-primary"), // 保留旧 primary 的 --hg-color-primary 契约。
    cssPrimaryHover: hgPaletteColor("--color-primary-hover"),
    cssPrimaryActive: hgPaletteColor("--color-primary-active"),
    cssText: hgPaletteColor("--color-text"),
    cssTextSecondary: hgPaletteColor("--color-text-secondary"),
    cssBorder: hgPaletteColor("--color-border"),
    bubbleMine: hgPaletteColor("--color-accent-soft"),
    bubbleFile: hgPaletteColor("--color-bg-hover"),
    iceBlue: hgPaletteColor("--brand-ice"),
    skyBlue: hgPaletteColor("--brand-sky"),
    actionBlue: hgPaletteColor("--color-primary"),
    frostWhite: hgPaletteColor("--color-bg-subtle"),
    powderBlue: hgPaletteColor("--color-secondary-soft"),
    brightBlue: hgPaletteColor("--brand-sky-light"),
    frostBlue: hgPaletteColor("--brand-frost"),
    wechatGreen: hgPaletteColor("--color-success"),
    background: hgPaletteColor("--color-bg-page"),
    surface: hgPaletteColor("--color-bg-surface"),
    zhongxinBrandRed: hgPaletteColor("--color-zhongxin-brand-red"), // 中信主题红：活动或品牌展示。
    zhongxinBackgroundRed: hgPaletteColor("--color-zhongxin-background-red"), // 活动主题背景。
    zhongxinAccentRed: hgPaletteColor("--color-zhongxin-accent-red"), // 柔和强调与图标。
    kLineRed: hgPaletteColor("--color-k-line-red"), // 上涨行情线条。
    buttonRed: hgPaletteColor("--color-button-red"), // 场景化红色按钮。
    buttonRedStrong: hgPaletteColor("--color-button-red-strong"), // 白色小字优先使用的深红按钮。
    buttonRedSoft: hgPaletteColor("--color-button-red-soft"), // 辅助按钮或弱强调。
    buttonRedBright: hgPaletteColor("--color-button-red-bright"), // 重点操作。
    priceRed: hgPaletteColor("--color-price-red"), // 价格与金额。
    indexRiseRed: hgPaletteColor("--color-index-rise-red"), // 行情上涨数字。
  };

  /** 兼容既有 --hg-color-*，同时将预览色板的语义 token 下发为同名 CSS 变量。 */
  static CSS_VAR_MAP = {
    primary: "--hg-color-primary",
    primaryHover: "--hg-color-primary-hover",
    primaryActive: "--hg-color-primary-active",
    primaryLight: "--hg-color-primary-light",
    primaryBorder: "--hg-color-primary-border",
    primaryGradient: "--hg-color-primary-gradient",
    bubbleMine: "--hg-color-bubble-mine",
    bubbleFile: "--hg-color-bubble-file",
    zhongxinBrandRed: "--hg-color-zhongxin-brand-red",
    zhongxinBackgroundRed: "--hg-color-zhongxin-background-red",
    zhongxinAccentRed: "--hg-color-zhongxin-accent-red",
    kLineRed: "--hg-color-k-line-red",
    buttonRed: "--hg-color-button-red",
    buttonRedStrong: "--hg-color-button-red-strong",
    buttonRedSoft: "--hg-color-button-red-soft",
    buttonRedBright: "--hg-color-button-red-bright",
    priceRed: "--hg-color-price-red",
    indexRiseRed: "--hg-color-index-rise-red",
    wechatGreen: "--hg-color-wechat-green",
    text: "--hg-color-text",
    textSecondary: "--hg-color-text-secondary",
    background: "--hg-color-background",
    surface: "--hg-color-surface",
    border: "--hg-color-border",
    brandGlacier: "--brand-glacier",
    brandElectric: "--brand-electric",
    brandSky: "--brand-sky",
    brandNebula: "--brand-nebula",
    brandOcean: "--brand-ocean",
    brandIce: "--brand-ice",
    brandSkyLight: "--brand-sky-light",
    brandFrost: "--brand-frost",
    primarySoft: "--color-primary-soft",
    secondary: "--color-secondary",
    secondaryHover: "--color-secondary-hover",
    secondarySoft: "--color-secondary-soft",
    accent: "--color-accent",
    accentHover: "--color-accent-hover",
    accentSoft: "--color-accent-soft",
    accentAction: "--color-accent-action",
    accentActionHover: "--color-accent-action-hover",
    ai: "--color-ai",
    aiHover: "--color-ai-hover",
    aiSoft: "--color-ai-soft",
    aiAction: "--color-ai-action",
    bgPage: "--color-bg-page",
    bgSurface: "--color-bg-surface",
    bgSubtle: "--color-bg-subtle",
    bgHover: "--color-bg-hover",
    bgSelected: "--color-bg-selected",
    bgDisabled: "--color-bg-disabled",
    textTitle: "--color-text-title",
    textMuted: "--color-text-muted",
    textInverse: "--color-text-inverse",
    link: "--color-link",
    linkHover: "--color-link-hover",
    borderStrong: "--color-border-strong",
    borderFocus: "--color-border-focus",
    success: "--color-success",
    successSoft: "--color-success-soft",
    warning: "--color-warning",
    warningSoft: "--color-warning-soft",
    danger: "--color-danger",
    dangerSoft: "--color-danger-soft",
    info: "--color-info",
    infoSoft: "--color-info-soft",
    ocean: "--color-ocean",
    oceanHover: "--color-ocean-hover",
    oceanBorder: "--color-ocean-border",
    cssPrimary: "--color-primary",
    cssPrimaryHover: "--color-primary-hover",
    cssPrimaryActive: "--color-primary-active",
    cssText: "--color-text",
    cssTextSecondary: "--color-text-secondary",
    cssBorder: "--color-border",
    iceBlue: "--hg-color-ice-blue",
    skyBlue: "--hg-color-sky-blue",
    actionBlue: "--hg-color-action-blue",
    frostWhite: "--hg-color-frost-white",
    powderBlue: "--hg-color-powder-blue",
    brightBlue: "--hg-color-bright-blue",
    frostBlue: "--hg-color-frost-blue",
  };

  /** 归一化十六进制颜色；仅接受 #rgb / #rrggbb。 */
  static normalizeHex(hex) {
    const raw = String(hex ?? "").trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(raw))
      return `#${raw
        .split("")
        .map((ch) => ch + ch)
        .join("")
        .toLowerCase()}`;
    if (/^[0-9a-fA-F]{6}$/.test(raw)) return `#${raw.toLowerCase()}`;
    throw new Error(`HGThemeUtils: 非法颜色值 "${hex}"，仅支持 #rgb / #rrggbb`);
  }

  /** 将十六进制颜色拆为 0~255 的 RGB 通道。 */
  static hexToRgb(hex) {
    const full = HGThemeColorComponent.normalizeHex(hex);
    return [
      parseInt(full.slice(1, 3), 16),
      parseInt(full.slice(3, 5), 16),
      parseInt(full.slice(5, 7), 16),
    ];
  }

  /** 将 RGB 通道裁剪并转换为小写十六进制颜色。 */
  static rgbToHex(r, g, b) {
    const clamp = (value) => Math.min(255, Math.max(0, Math.round(value)));
    const to2 = (value) => clamp(value).toString(16).padStart(2, "0");
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  }

  /** 按比例混合两个颜色，用于生成交互状态色。 */
  static mixHex(fromHex, toHex, ratio) {
    const amount = Number.isFinite(Number(ratio))
      ? Math.min(1, Math.max(0, Number(ratio)))
      : 0;
    const [fr, fg, fb] = HGThemeColorComponent.hexToRgb(fromHex);
    const [tr, tg, tb] = HGThemeColorComponent.hexToRgb(toHex);
    return HGThemeColorComponent.rgbToHex(
      fr + (tr - fr) * amount,
      fg + (tg - fg) * amount,
      fb + (tb - fb) * amount
    );
  }

  /** 为半透明阴影、遮罩生成 rgba 颜色。 */
  static withAlpha(hex, alpha) {
    const amount = Number.isFinite(Number(alpha))
      ? Math.min(1, Math.max(0, Number(alpha)))
      : 1;
    const [r, g, b] = HGThemeColorComponent.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${amount})`;
  }

  /** 默认主色直接采用预览原值；自定义主色仍按既有混色比例派生，保持换肤能力。 */
  static buildTheme(primaryHex) {
    const primary = HGThemeColorComponent.normalizeHex(primaryHex);
    const mix = HGThemeColorComponent.mixHex;
    const palette = HGThemeColorComponent.COLOR_PALETTE; // 所有基准色均来自同目录预览 CSS，不再另设常量色板。
    const isDefault = primary === HGThemeColorComponent.DEFAULT_PRIMARY; // 默认主题使用规范明确的 Hover/Active 色。
    return {
      ...palette,
      primary,
      primaryHover: isDefault ? palette.primaryHover : mix(primary, palette.textTitle, 0.1),
      primaryActive: isDefault ? palette.primaryActive : mix(primary, palette.textTitle, 0.2),
      primaryLight: isDefault ? palette.primarySoft : mix(primary, palette.surface, 0.9),
      primaryBorder: isDefault ? palette.borderStrong : mix(primary, palette.surface, 0.7),
      primaryGradient: `linear-gradient(120deg, ${primary} 0%, ${palette.accent} 55%, ${HGThemeColorComponent.GRADIENT_END} 100%)`,
      cssPrimary: primary,
      cssPrimaryHover: isDefault ? palette.primaryHover : mix(primary, palette.textTitle, 0.1),
      cssPrimaryActive: isDefault ? palette.primaryActive : mix(primary, palette.textTitle, 0.2),
    };
  }
}

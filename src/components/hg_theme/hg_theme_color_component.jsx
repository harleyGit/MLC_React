/**
 * 主题色彩组件：集中维护主题 token 与颜色计算，供 HGThemeUtils 及样式层复用。
 * 职责边界：只处理颜色值和 CSS 变量，不负责 React 渲染、持久化或主题切换交互。
 */
export default class HGThemeColorComponent {
  /** 默认主题主色；来自主题规范中的主交互色，保证白色文字具有可读性。 */
  static DEFAULT_PRIMARY = "#2674c7";

  /** 品牌渐变的紫色终点；与主题规范保持一致。 */
  static GRADIENT_END = "#8185f4";

  /** 主题规范中的扩展色板；#Cpf0FF 为非法写法，按规范修正为 #CFF0FF。 */
  static COLOR_PALETTE = {
    bubbleMine: "#e0f2ff",
    bubbleFile: "#f2f8ff",
    iceBlue: "#b6dcff",
    skyBlue: "#7cbaff",
    actionBlue: "#3b82f6",
    frostWhite: "#f5ffff",
    powderBlue: "#b7dbff",
    brightBlue: "#82beff",
    frostBlue: "#cff0ff",
  };

  /** 主题 token 到 CSS 变量的映射，业务样式只依赖语义变量。 */
  static CSS_VAR_MAP = {
    primary: "--hg-color-primary",
    primaryHover: "--hg-color-primary-hover",
    primaryActive: "--hg-color-primary-active",
    primaryLight: "--hg-color-primary-light",
    primaryBorder: "--hg-color-primary-border",
    primaryGradient: "--hg-color-primary-gradient",
    bubbleMine: "--hg-color-bubble-mine",
    bubbleFile: "--hg-color-bubble-file",
    wechatGreen: "--hg-color-wechat-green",
    text: "--hg-color-text",
    textSecondary: "--hg-color-text-secondary",
    background: "--hg-color-background",
    surface: "--hg-color-surface",
    border: "--hg-color-border",
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

  /** 从主色构建完整主题色板；未提供的颜色使用生产主题规范中的语义默认值。 */
  static buildTheme(primaryHex) {
    const primary = HGThemeColorComponent.normalizeHex(primaryHex);
    const mix = HGThemeColorComponent.mixHex;
    return {
      ...HGThemeColorComponent.COLOR_PALETTE,
      primary,
      primaryHover: mix(primary, "#000000", 0.1),
      primaryActive: mix(primary, "#000000", 0.2),
      primaryLight: mix(primary, "#ffffff", 0.9),
      primaryBorder: mix(primary, "#ffffff", 0.7),
      primaryGradient: `linear-gradient(112deg, ${mix(
        primary,
        "#000000",
        0.18
      )} 0%, ${primary} 56%, ${HGThemeColorComponent.GRADIENT_END} 100%)`,
      wechatGreen: "#95ec69",
      text: "#172b4d",
      textSecondary: "#61758e",
      background: "#f0f7ff",
      surface: "#ffffff",
      border: "#d6e7f9",
    };
  }
}

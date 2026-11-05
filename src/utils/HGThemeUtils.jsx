/*
 * @Description: Web 整体主题色彩工具类：维护主色 #3c83f3 与派生色板，
 *              并通过 :root CSS 变量下发全站样式（var(--hg-color-xxx)）。
 */

/**
 * 主题色彩工具类（静态 API）。
 * 职责：
 * - 维护主题色板：主色 #3c83f3 及派生色（hover/active/浅底/描边/品牌渐变）与中性色；
 * - 通过 :root CSS 变量下发主题，全局样式用 var(--hg-color-xxx) 引用；
 * - 支持运行时换主色（applyTheme({ primary })），派生色随主色重新计算。
 * 边界：
 * - 只覆盖色彩 token，不含字号、间距、圆角等非色彩样式；
 * - 不持久化主题，刷新后回到默认值，需持久化时由调用方自行存储并在启动时传入 applyTheme；
 * - 颜色入参仅支持 #rgb / #rrggbb 十六进制，不接受命名色与渐变字符串。
 * 关键约束：
 * - applyTheme / resetTheme 依赖 document，仅浏览器环境调用（非浏览器环境只更新内存色板）；
 * - 派生色按固定比例与黑/白混合，保证换主色后整体色调一致；
 * - applyTheme 以主色为基准重建色板，未显式传入的 token 回到派生/默认值。
 */
export default class HGThemeUtils {
  /** 默认主色：全站品牌主题色 */
  static DEFAULT_PRIMARY = "#3c83f3";

  /** 品牌渐变末端点缀色（与顶栏渐变 #7768ef 保持一致） */
  static GRADIENT_END = "#7768ef";

  /** token -> :root CSS 变量名映射；全站样式统一从这里取变量名，避免手写不一致 */
  static CSS_VAR_MAP = {
    primary: "--hg-color-primary",
    primaryHover: "--hg-color-primary-hover",
    primaryActive: "--hg-color-primary-active",
    primaryLight: "--hg-color-primary-light",
    primaryBorder: "--hg-color-primary-border",
    primaryGradient: "--hg-color-primary-gradient",
    wechatGreen: "--hg-color-wechat-green",
    text: "--hg-color-text",
    textSecondary: "--hg-color-text-secondary",
    background: "--hg-color-background",
    surface: "--hg-color-surface",
    border: "--hg-color-border",
  };

  /** 当前生效色板；懒初始化，首次取用时由 buildTheme(DEFAULT_PRIMARY) 构建 */
  static _themeColors = null;

  /**
   * 归一化十六进制颜色值。
   * 边界：仅接受 #rgb / #rrggbb（允许省略 #），其余输入抛错。
   * @param {string} hex 原始颜色值
   * @returns {string} 小写 #rrggbb
   */
  static normalizeHex(hex) {
    const raw = String(hex ?? "").trim().replace(/^#/, "");
    if (/^[0-9a-fA-F]{3}$/.test(raw)) {
      return `#${raw
        .split("")
        .map((ch) => ch + ch)
        .join("")
        .toLowerCase()}`;
    }
    if (/^[0-9a-fA-F]{6}$/.test(raw)) {
      return `#${raw.toLowerCase()}`;
    }
    throw new Error(`HGThemeUtils: 非法颜色值 "${hex}"，仅支持 #rgb / #rrggbb`);
  }

  /**
   * 十六进制颜色转 RGB 通道数组。
   * @param {string} hex 颜色值（#rgb / #rrggbb）
   * @returns {[number, number, number]} [r, g, b]，各通道 0~255
   */
  static hexToRgb(hex) {
    const full = HGThemeUtils.normalizeHex(hex);
    return [
      parseInt(full.slice(1, 3), 16),
      parseInt(full.slice(3, 5), 16),
      parseInt(full.slice(5, 7), 16),
    ];
  }

  /**
   * RGB 通道数组转十六进制颜色。
   * 边界：各通道按 0~255 截断并四舍五入。
   * @param {number} r 红
   * @param {number} g 绿
   * @param {number} b 蓝
   * @returns {string} 小写 #rrggbb
   */
  static rgbToHex(r, g, b) {
    const clamp = (v) => Math.min(255, Math.max(0, Math.round(v)));
    const to2 = (v) => clamp(v).toString(16).padStart(2, "0");
    return `#${to2(r)}${to2(g)}${to2(b)}`;
  }

  /**
   * 颜色混合：把 fromHex 按 ratio 向 toHex 混合，用于派生 hover/active/浅底等关联色。
   * @param {string} fromHex 起始色
   * @param {string} toHex 目标色
   * @param {number} ratio 向目标色混合比例，0 返回起始色，1 返回目标色
   * @returns {string} 混合后的小写 #rrggbb
   */
  static mixHex(fromHex, toHex, ratio) {
    const t = Number.isFinite(Number(ratio)) ? Math.min(1, Math.max(0, Number(ratio))) : 0;
    const [fr, fg, fb] = HGThemeUtils.hexToRgb(fromHex);
    const [tr, tg, tb] = HGThemeUtils.hexToRgb(toHex);
    return HGThemeUtils.rgbToHex(
      fr + (tr - fr) * t,
      fg + (tg - fg) * t,
      fb + (tb - fb) * t
    );
  }

  /**
   * 带透明度的颜色：输出 rgba() 字符串，供阴影、遮罩等半透明场景使用。
   * @param {string} hex 颜色值（#rgb / #rrggbb）
   * @param {number} alpha 不透明度 0~1
   * @returns {string} rgba(r, g, b, a)
   */
  static withAlpha(hex, alpha) {
    const a = Number.isFinite(Number(alpha)) ? Math.min(1, Math.max(0, Number(alpha))) : 1;
    const [r, g, b] = HGThemeUtils.hexToRgb(hex);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  }

  /**
   * 由主色构建完整主题色板。
   * 职责：派生 hover/active/浅底/描边/品牌渐变，并附带中性色 token。
   * 边界：仅做固定比例黑白混合与字符串拼装，不校验业务语义。
   * @param {string} primaryHex 主色（#rgb / #rrggbb）
   * @returns {object} token -> 颜色值的色板对象
   */
  static buildTheme(primaryHex) {
    const primary = HGThemeUtils.normalizeHex(primaryHex);
    return {
      primary,
      // hover/active：向黑色混合 10% / 20%，换主色后反馈色仍保持同色系
      primaryHover: HGThemeUtils.mixHex(primary, "#000000", 0.1),
      primaryActive: HGThemeUtils.mixHex(primary, "#000000", 0.2),
      // 浅底/描边：向白色混合 90% / 70%，用于标签底、选中态描边等
      primaryLight: HGThemeUtils.mixHex(primary, "#ffffff", 0.9),
      primaryBorder: HGThemeUtils.mixHex(primary, "#ffffff", 0.7),
      // 品牌渐变：深色起点 + 主色中段 + 固定紫调终点，与顶栏渐变风格一致
      primaryGradient: `linear-gradient(112deg, ${HGThemeUtils.mixHex(
        primary,
        "#000000",
        0.18
      )} 0%, ${primary} 56%, ${HGThemeUtils.GRADIENT_END} 100%)`,
      // 微信绿：IM 聊天气泡专用品牌色（微信交付风格），不随主色派生，固定值
      wechatGreen: "#95ec69",
      // 中性色：背景/描边与 App.css 的 --cm-hg-style、--cm-hg-border-level-2-color 对齐
      text: "#1f2329",
      textSecondary: "#646a73",
      background: "#f5f7fa",
      surface: "#ffffff",
      border: "#dcdcdc",
    };
  }

  /**
   * 获取当前生效色板（懒初始化）。
   * @returns {object} token -> 颜色值的色板对象
   */
  static getThemeColors() {
    if (!HGThemeUtils._themeColors) {
      HGThemeUtils._themeColors = HGThemeUtils.buildTheme(HGThemeUtils.DEFAULT_PRIMARY);
    }
    return HGThemeUtils._themeColors;
  }

  /**
   * 获取单个 token 的原始颜色值。
   * @param {string} token 色板 token（如 primary / primaryHover）
   * @returns {string|null} 颜色值，未知 token 返回 null
   */
  static getThemeColor(token) {
    return HGThemeUtils.getThemeColors()[token] ?? null;
  }

  /**
   * 获取 token 对应的 CSS 变量引用串，用于 JS 内联样式（style={{ color: getCssVar("primary") }}）。
   * @param {string} token 色板 token
   * @returns {string|null} var(--hg-color-xxx)，未知 token 返回 null
   */
  static getCssVar(token) {
    const cssVarName = HGThemeUtils.CSS_VAR_MAP[token];
    return cssVarName ? `var(${cssVarName})` : null;
  }

  /**
   * 应用主题：以主色为基准重建色板并下发 :root CSS 变量。
   * 职责：全站主题生效入口；支持只换主色，或显式覆盖任意 token。
   * 边界：未知 token 会被忽略；未传入的 token 回到派生/默认值（非增量合并）。
   * 关键约束：依赖 document，非浏览器环境仅更新内存色板并提前返回。
   * @param {object} [overrides] 覆盖项，如 { primary: "#3c83f3", text: "#333333" }
   * @returns {object} 应用后的完整色板
   */
  static applyTheme(overrides = {}) {
    const options = overrides && typeof overrides === "object" ? { ...overrides } : {};
    if (options.primary != null) {
      options.primary = HGThemeUtils.normalizeHex(options.primary);
    }
    const primary = options.primary ?? HGThemeUtils.getThemeColors().primary;
    HGThemeUtils._themeColors = { ...HGThemeUtils.buildTheme(primary), ...options };

    if (typeof document === "undefined") {
      return HGThemeUtils._themeColors;
    }
    const rootStyle = document.documentElement.style;
    Object.entries(HGThemeUtils.CSS_VAR_MAP).forEach(([token, cssVarName]) => {
      const value = HGThemeUtils._themeColors[token];
      if (value != null) {
        rootStyle.setProperty(cssVarName, String(value));
      }
    });
    return HGThemeUtils._themeColors;
  }

  /**
   * 恢复默认主题（主色 #3c83f3 及全部默认/派生 token）。
   * @returns {object} 恢复后的完整色板
   */
  static resetTheme() {
    return HGThemeUtils.applyTheme({ primary: HGThemeUtils.DEFAULT_PRIMARY });
  }
}

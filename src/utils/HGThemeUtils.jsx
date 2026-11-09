/* Web 整体主题色彩工具类：负责状态管理与 CSS 变量下发。 */

import HGThemeColorComponent from "../components/hg_theme/hg_theme_color_component.jsx";

/**
 * 主题色彩工具类（静态 API）。
 * 职责：
 * - 维护主题色板：蓝色主色及派生色（hover/active/浅底/描边/品牌渐变）、中性色与场景化红色；
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
  static DEFAULT_PRIMARY = HGThemeColorComponent.DEFAULT_PRIMARY;

  /** 品牌渐变末端点缀色（与顶栏渐变 #7768ef 保持一致） */
  static GRADIENT_END = HGThemeColorComponent.GRADIENT_END;

  /** token -> :root CSS 变量名映射；全站样式统一从这里取变量名，避免手写不一致 */
  static CSS_VAR_MAP = HGThemeColorComponent.CSS_VAR_MAP;

  /** 当前生效色板；懒初始化，首次取用时由 buildTheme(DEFAULT_PRIMARY) 构建 */
  static _themeColors = null;

  /**
   * 归一化十六进制颜色值。
   * 边界：仅接受 #rgb / #rrggbb（允许省略 #），其余输入抛错。
   * @param {string} hex 原始颜色值
   * @returns {string} 小写 #rrggbb
   */
  static normalizeHex(hex) {
    return HGThemeColorComponent.normalizeHex(hex);
  }

  /**
   * 十六进制颜色转 RGB 通道数组。
   * @param {string} hex 颜色值（#rgb / #rrggbb）
   * @returns {[number, number, number]} [r, g, b]，各通道 0~255
   */
  static hexToRgb(hex) {
    return HGThemeColorComponent.hexToRgb(hex);
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
    return HGThemeColorComponent.rgbToHex(r, g, b);
  }

  /**
   * 颜色混合：把 fromHex 按 ratio 向 toHex 混合，用于派生 hover/active/浅底等关联色。
   * @param {string} fromHex 起始色
   * @param {string} toHex 目标色
   * @param {number} ratio 向目标色混合比例，0 返回起始色，1 返回目标色
   * @returns {string} 混合后的小写 #rrggbb
   */
  static mixHex(fromHex, toHex, ratio) {
    return HGThemeColorComponent.mixHex(fromHex, toHex, ratio);
  }

  /**
   * 带透明度的颜色：输出 rgba() 字符串，供阴影、遮罩等半透明场景使用。
   * @param {string} hex 颜色值（#rgb / #rrggbb）
   * @param {number} alpha 不透明度 0~1
   * @returns {string} rgba(r, g, b, a)
   */
  static withAlpha(hex, alpha) {
    return HGThemeColorComponent.withAlpha(hex, alpha);
  }

  /**
   * 由主色构建完整主题色板。
   * 职责：派生 hover/active/浅底/描边/品牌渐变，并附带中性色与红色语义 token。
   * 边界：仅做固定比例黑白混合与字符串拼装，不校验业务语义。
   * @param {string} primaryHex 主色（#rgb / #rrggbb）
   * @returns {object} token -> 颜色值的色板对象
   */
  static buildTheme(primaryHex) {
    return HGThemeColorComponent.buildTheme(primaryHex);
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
   * 恢复默认主题（主题规范主交互色及全部默认/派生 token）。
   * @returns {object} 恢复后的完整色板
   */
  static resetTheme() {
    return HGThemeUtils.applyTheme({ primary: HGThemeUtils.DEFAULT_PRIMARY });
  }
}

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";

/** 使用现有 JSX 转换方式加载色板类，不引入浏览器或生产 CSS 解析依赖。 */
function hgThemeColorComponent() {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_theme_color_component.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_theme_color_component.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const hgCSS = readFileSync(new URL("./hg_theme_palette.module.css", import.meta.url), "utf8"); // Vite ?raw 在 Node 测试中用同一 CSS 原文替身。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (hgDependency) => {
      assert.equal(hgDependency, "./hg_theme_palette.module.css?raw");
      return { default: hgCSS, __esModule: true };
    },
  });
  return hgModule.exports.default;
}

test("运行时色板与预览 CSS 浅色 token 一致，保留旧 CSS 变量与动态换主色能力", () => {
  const HGColor = hgThemeColorComponent();
  const hgCSS = readFileSync(new URL("./hg_theme_palette.module.css", import.meta.url), "utf8");
  const hgLightCSS = hgCSS.slice(hgCSS.indexOf(".palette {"), hgCSS.indexOf(".darkPalette {"));
  const hgColors = new Set((hgCSS.match(/#[0-9a-f]{6}\b/gi) || []).map((hgHex) => hgHex.toLowerCase()));
  const hgDefault = HGColor.buildTheme(HGColor.DEFAULT_PRIMARY);

  for (const [, hgVar, hgHex] of hgLightCSS.matchAll(/(--(?:brand|color)-[\w-]+):\s*(#[0-9a-f]{6});/gi)) {
    const hgToken = Object.keys(HGColor.CSS_VAR_MAP).find((hgKey) =>
      HGColor.CSS_VAR_MAP[hgKey] === hgVar ||
      HGColor.CSS_VAR_MAP[hgKey] === hgVar.replace(/^--color-/, "--hg-color-")
    ); // 既有消费者的 --hg-color-* 别名不可因预览新增同名变量而失效。
    assert.ok(hgToken, `${hgVar} 必须映射到运行时主题变量`);
    assert.equal(HGColor.COLOR_PALETTE[hgToken], hgHex.toLowerCase(), `${hgVar} 原值要与预览保持一致`);
    assert.equal(hgDefault[hgToken], hgHex.toLowerCase(), `${hgVar} 默认值不能再次派生另一套颜色`);
  }

  Object.values(HGColor.COLOR_PALETTE).forEach((hgHex) => {
    assert.ok(hgColors.has(hgHex), `${hgHex} 必须来自预览 CSS 的现有颜色`);
  });
  Object.keys(HGColor.CSS_VAR_MAP).forEach((hgToken) => {
    assert.ok(hgDefault[hgToken], `${hgToken} 必须能下发已有或新增的 CSS 变量`);
  });
  assert.equal(HGColor.CSS_VAR_MAP.primary, "--hg-color-primary", "既有消费方仍使用旧变量名");
  assert.equal(hgDefault.primary, "#438bfa");
  assert.equal(hgDefault.primaryHover, "#2674e8");
  assert.equal(hgDefault.primaryActive, "#28b4f5");
  assert.equal(hgDefault.warning, hgDefault.kLineRed, "警告使用已有中信红色");
  assert.equal(hgDefault.danger, hgDefault.buttonRedStrong, "危险状态使用已有中信红色");
  const hgCustom = HGColor.buildTheme("#f066aa"); // 非默认主色只能覆盖主题主色及其派生值，不改变十个中信红原值。
  assert.equal(hgCustom.primary, "#f066aa", "自定义主色仍可正常归一化");
  assert.equal(hgCustom.cssPrimary, hgCustom.primary);
  assert.equal(hgCustom.cssPrimaryHover, hgCustom.primaryHover);
  assert.equal(hgCustom.cssPrimaryActive, hgCustom.primaryActive);
  assert.notEqual(hgCustom.primaryHover, hgDefault.primaryHover);
  assert.equal(hgCustom.buttonRedStrong, hgDefault.buttonRedStrong);
});

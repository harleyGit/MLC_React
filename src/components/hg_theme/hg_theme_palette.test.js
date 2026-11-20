import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

/** 转换实际色板 JSX，CSS Module 用同名类替身，避免测试依赖浏览器构建环境。 */
function hgRenderPalette() {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_theme_palette_page.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_theme_palette_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  const hgStyles = new Proxy({}, { get: (_, hgKey) => String(hgKey) }); // 样式替身只保留 class 名，不伪造颜色值。
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (hgDependency) => hgDependency === "react"
      ? React
      : { default: hgStyles, __esModule: true },
  });
  return renderToStaticMarkup(React.createElement(hgModule.exports.default));
}

test("规范色板每个浅深色色块标注与 CSS 一致的 HEX 或渐变色标", () => {
  const hgCSS = readFileSync(new URL("./hg_theme_palette.module.css", import.meta.url), "utf8");
  const hgColors = new Set((hgCSS.match(/#[0-9a-f]{6}\b/gi) || []).map((hgColor) => hgColor.toUpperCase()));
  assert.equal(hgColors.size, 54, "主按钮使用保存色及对应交互状态，色板保留 54 个独立 HEX");
  assert.doesNotMatch(hgCSS, /#CPF0FF/i, "规范中的错误示例不是有效色值");
  assert.match(hgCSS, /\.palette\s*\{[^}]*--color-primary:\s*#1677FF;/);
  assert.doesNotMatch(hgCSS, /#438BFA/i, "旧主色已从色板移除");
  assert.match(hgCSS, /\.darkPalette\s*\{[^}]*--color-primary:\s*#89C8FF;/);
  assert.match(hgCSS, /--color-price-red:\s*#E83E36;/);
  assert.match(hgCSS, /--gradient-brand:\s*linear-gradient\(120deg,/);
  assert.doesNotMatch(hgCSS, /#(?:1A3B66|4294E0|2674C7|195FA8|124B86|176D9B|10577E|2166AE|19518E|20487C|274C80|203F61|24395E|173F57|302D58|0E1D30|162E4C|244A76|26394F|10243C|35577F|4D7199|463920|4A293A)\b/i);

  const hgHTML = hgRenderPalette();
  assert.match(hgHTML, /aria-label="浅色模式色彩预览"/);
  assert.match(hgHTML, /aria-label="深色模式色彩预览"/);
  assert.match(hgHTML, /--brand-glacier/);
  assert.match(hgHTML, /--color-zhongxin-brand-red/);
  assert.match(hgHTML, /--gradient-soft/);
  const hgCards = [...hgHTML.matchAll(/class="sample" style="--preview-color:var\((--[\w-]+)\)"[^>]*>.*?<code class="hex">([^<]+)<\/code>/g)];
  assert.equal(hgCards.length, 117, "浅色 64 个色块与深色 53 个色块均标注色值");
  const hgLightCSS = hgCSS.slice(hgCSS.indexOf(".palette {"), hgCSS.indexOf(".darkPalette {"));
  const hgDarkCSS = hgCSS.slice(hgCSS.indexOf(".darkPalette {"), hgCSS.indexOf(".lead {"));
  hgCards.forEach(([, hgToken, hgHex], hgIndex) => {
    const hgLightValue = hgLightCSS.match(new RegExp(`${hgToken}:\\s*([^;]+);`))?.[1];
    const hgDarkValue = hgDarkCSS.match(new RegExp(`${hgToken}:\\s*([^;]+);`))?.[1];
    const hgValue = hgIndex < 64 ? hgLightValue : hgDarkValue ?? hgLightValue; // 浅色优先，深色只用实际覆写值。
    assert.ok(hgValue, `${hgToken} 必须在 CSS 色板中声明`);
    const hgExpectedLabel = hgValue.startsWith("linear-gradient")
      ? [...hgValue.matchAll(/#[0-9A-F]{6}/g)].map(([hgColor]) => hgColor).join(" → ")
      : hgValue;
    assert.equal(hgHex, hgExpectedLabel, `${hgToken} 的标签必须与当前预览色块一致`);
  });

  const hgMenu = readFileSync(new URL("../../manager_antd/page_modules/test_module/hg_test_module_vm.jsx", import.meta.url), "utf8");
  const hgPage = readFileSync(new URL("../../manager_antd/page_modules/test_module/hg_test_module_page.jsx", import.meta.url), "utf8");
  assert.match(hgMenu, /key:\s*"theme_palette",\s*label:\s*"主题色彩预览"/);
  assert.match(hgPage, /theme_palette:\s*HGThemePalettePage/);
});

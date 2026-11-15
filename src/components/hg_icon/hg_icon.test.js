import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { transformSync } from "@swc/core";
import React from "react";

/** 以本地替身加载图标 JSX，核对 SVG 资源与普通图标互不影响。 */
function hgIcon(hgType) {
  const hgModule = { exports: {} };
  const hgSource = readFileSync(new URL("./hg_icon_page.jsx", import.meta.url), "utf8");
  const hgCode = transformSync(hgSource, {
    filename: "hg_icon_page.jsx",
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  }).code;
  runInNewContext(hgCode, {
    module: hgModule,
    exports: hgModule.exports,
    require: (hgDependency) => hgDependency === "react"
      ? React
      : { default: { icon: "icon", brokenImageIcon: "brokenImageIcon" }, __esModule: true },
  });
  return new hgModule.exports.default({ type: hgType }).render();
}

test("裂纹无图图标加载 svg 文件且铺满 1em，普通图标仍走原路径", () => {
  const hgBrokenIcon = hgIcon("image-broken").props.children;
  assert.equal(hgBrokenIcon.type, "span");
  assert.equal(hgBrokenIcon.props.className, "brokenImageIcon");
  assert.equal(hgBrokenIcon.props["aria-hidden"], "true");

  const hgCSS = readFileSync(new URL("./hg_icon.module.css", import.meta.url), "utf8");
  const hgMaskStyle = hgCSS.match(/\.brokenImageIcon\s*\{([^}]*)\}/)?.[1];
  assert.match(hgMaskStyle, /width:\s*1em;/);
  assert.match(hgMaskStyle, /height:\s*1em;/);
  assert.match(hgMaskStyle, /mask:\s*url\("\.\/svg\/image-broken\.svg"\)/);
  const hgSVG = readFileSync(new URL("./svg/image-broken.svg", import.meta.url), "utf8");
  assert.match(hgSVG, /viewBox="0 0 72 72"/);
  assert.match(hgSVG, /<mask id="crack">/);
  assert.match(hgSVG, /<path[^>]*stroke="black"[^>]*stroke-width="4"/);
  assert.match(hgSVG, /mask="url\(#crack\)"/);

  const hgRegularIcon = hgIcon("image").props.children;
  assert.equal(hgRegularIcon.type, "svg");
  assert.equal(typeof hgRegularIcon.props.children.props.d, "string");
});

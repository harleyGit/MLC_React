import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { transformSync } from "@swc/core";
import { hgTableColumns, hgTableProps } from "../../../../../components/hg_table/hg_table_contract.js";

const hgRequire = createRequire(import.meta.url);
const hgID = "6de54632-12ea-47b4-9bee-5034decf22e8";
const hgReadyImage = { source: "new", id: hgID, status: "ready", kind: "image", mime_type: "image/jpeg", purpose: "user_avatar" };
const hgInventoryEndpoint = "/api/v1/media/admin/assets/list";
const hgOwnerDownloadEndpoint = "/api/v1/media/assets/download";

/** 加载实际页面与 VM，只替换样式、UI 叶子节点和请求传输层。 */
function hgLoadModule(file, dependencies) {
  const { code } = transformSync(readFileSync(new URL(file, import.meta.url), "utf8"), {
    jsc: { parser: { syntax: "ecmascript", jsx: true }, target: "es2022" },
    module: { type: "commonjs" },
  });
  const module = { exports: {} };
  new Function("require", "module", "exports", code)((name) => {
    if (name in dependencies) return dependencies[name];
    if (name === "react") return hgRequire(name);
    if (name.endsWith(".css")) return {};
    if (name.startsWith("../../../../../components/")) return () => null;
    throw new Error(`未知依赖：${name}`);
  }, module, module.exports);
  return module.exports;
}

function hgCreatePage(get) {
  const vm = hgLoadModule("../hg_file_management_vm.jsx", {
    "../../../net_handle/hg_net_manager_vm": { get },
    "../../../api/hg_api_constants": { HGMANAGER_API: { MEDIA_ADMIN_INVENTORY: hgInventoryEndpoint, MEDIA_ASSET_DOWNLOAD: hgOwnerDownloadEndpoint } },
    "../../../net_handle/hg_im_endpoint": hgLoadModule("../../../../net_handle/hg_im_endpoint.jsx", {}),
  });
  const { default: Page } = hgLoadModule("./hg_file_list_page.jsx", {
    "../hg_file_management_vm": vm,
    "../../../../../components/hg_table/hg_table_contract": { hgTableColumns, hgTableProps },
  });
  const page = new Page({});
  page.setState = (next) => { page.state = { ...page.state, ...(typeof next === "function" ? next(page.state) : next) }; };
  page.hgMounted = true;
  return page;
}

test("盘点使用表格游标分页，按服务端游标顺序翻页，换种类丢弃旧游标", async () => {
  const requests = [];
  const page = hgCreatePage(async (url, params) => {
    requests.push({ url, ...params });
    return { items: params.kind === "audio" ? [] : [hgReadyImage], next_cursor: params.cursor || params.kind ? "" : ":0:" + hgID };
  });
  const table = () => page.renderInventory().props.children[1].props;
  await page.loadInventory("", "", 0);
  assert.deepEqual(table().pagination, { mode: "cursor", current: 1, pageSize: 20, hasPreviousPage: false, hasNextPage: true });
  table().onChange({ current: 4 });
  assert.equal(requests.length, 1);

  await table().onChange({ current: 2 });
  assert.deepEqual(table().pagination, { mode: "cursor", current: 2, pageSize: 20, hasPreviousPage: true, hasNextPage: false });
  await table().onChange({ current: 1 });
  await page.loadInventory("audio", "", 0);
  assert.deepEqual(requests, [
    { url: hgInventoryEndpoint, kind: "", cursor: "", limit: 20 },
    { url: hgInventoryEndpoint, kind: "", cursor: ":0:" + hgID, limit: 20 },
    { url: hgInventoryEndpoint, kind: "", cursor: "", limit: 20 },
    { url: hgInventoryEndpoint, kind: "audio", cursor: "", limit: 20 },
  ]);
  assert.deepEqual(table().dataSource, []);
  assert.equal(table().pagination.hasPreviousPage, false);
});

test("本人预览从原下载接口获取签名；旧资源、私有用途及视频不发请求", async () => {
  let requests = 0;
  const page = hgCreatePage(async (url, params) => {
    requests++;
    assert.equal(url, hgOwnerDownloadEndpoint);
    assert.deepEqual(params, { asset_id: hgID });
    return { download_url: "https://store.example.invalid/image", expires_in: 30 };
  });
  await page.handlePreview({ ...hgReadyImage, source: "legacy_im" });
  await page.handlePreview({ ...hgReadyImage, purpose: "user_identity" });
  await page.handlePreview({ ...hgReadyImage, mime_type: "video/mp4" });
  assert.equal(requests, 0);
  await page.handlePreview(hgReadyImage);
  assert.equal(requests, 1);
  assert.equal(page.state.preview.url, "https://store.example.invalid/image");
  page.closePreview();
  page.handlePreviewImageError("https://store.example.invalid/image");
  assert.equal(page.state.preview, null);
});

test("服务端拒绝读取时不生成预览地址，关闭弹窗会取消未完成的签名请求", async () => {
  let finish;
  let signal;
  const page = hgCreatePage(async (_url, _params, options) => {
    signal = options.signal;
    return new Promise((resolve, reject) => { finish = { resolve, reject }; });
  });
  const denied = page.handlePreview(hgReadyImage);
  finish.reject(new Error("无权读取"));
  await denied;
  assert.match(page.state.preview.error, /当前登录人/);
  assert.equal(page.state.preview.url, undefined);

  const canceled = page.handlePreview(hgReadyImage);
  page.closePreview();
  assert.equal(signal.aborted, true);
  finish.resolve({ download_url: "https://store.example.invalid/image", expires_in: 30 });
  await canceled;
  assert.equal(page.state.preview, null);
});

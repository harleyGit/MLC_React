import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { transformSync } from "@swc/core";
import { hgTableColumns, hgTableProps } from "../../../../../components/hg_table/hg_table_contract.js";
import { hgEvaluateAccess } from "../../../../../modules/iam/hg_access_evaluator.js";
import { HG_PERMISSIONS } from "../../../../../modules/iam/hg_permission_codes.js";

const hgRequire = createRequire(import.meta.url);
const hgID = "6de54632-12ea-47b4-9bee-5034decf22e8";
const hgReadyImage = { source: "new", id: hgID, status: "ready", kind: "image", mime_type: "image/jpeg", purpose: "user_avatar" };
const hgInventoryEndpoint = "/api/v1/media/admin/assets/list";
const hgPreviewEndpoint = "/api/v1/media/admin/assets/preview";
const hgDeleteEndpoint = "/api/v1/media/admin/assets/delete";

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

function hgCreatePage(get, post) {
  const vm = hgLoadModule("../hg_file_management_vm.jsx", {
    "../../../net_handle/hg_net_manager_vm": { get, post },
    "../../../api/hg_api_constants": { HGMANAGER_API: { MEDIA_ADMIN_INVENTORY: hgInventoryEndpoint, MEDIA_ADMIN_PREVIEW: hgPreviewEndpoint, MEDIA_ADMIN_DELETE: hgDeleteEndpoint } },
    "../../../net_handle/hg_im_endpoint": hgLoadModule("../../../../net_handle/hg_im_endpoint.jsx", {}),
  });
  const { default: Page } = hgLoadModule("./hg_file_list_page.jsx", {
    "../hg_file_management_vm": vm,
    "../../../../../components/hg_table/hg_table_contract": { hgTableColumns, hgTableProps },
    "../../../../../components/hg_message/hg_message_page": { hgMessage: { success() {} } },
    "../../../../../modules/iam/hg_access_evaluator": { hgEvaluateAccess },
    "../../../../../modules/iam/hg_iam_provider": { HGIAMContext: hgRequire("react").createContext(null) },
    "../../../../../modules/iam/hg_permission_codes": { HG_PERMISSIONS },
  });
  const page = new Page({});
  page.setState = (next) => { page.state = { ...page.state, ...(typeof next === "function" ? next(page.state) : next) }; };
  page.hgMounted = true;
  page.context = { snapshot: {
    expires_at: new Date(Date.now() + 30_000).toISOString(),
    grants: [HG_PERMISSIONS.MEDIA_ASSET_PREVIEW, HG_PERMISSIONS.MEDIA_ASSET_DELETE]
      .map((permission) => ({ permission, scope_type: "global", scope_id: "" })),
  } };
  page.setState({ previewAvailable: true, deleteAvailable: true });
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

test("管理端预览真正获取签名，并使用图片、视频、音频播放器", async () => {
  let requests = 0;
  let media = hgReadyImage;
  const page = hgCreatePage(async (url, params) => {
    requests++;
    assert.equal(url, hgPreviewEndpoint);
    assert.deepEqual(params, { asset_id: hgID });
    return { preview_url: "https://store.example.invalid/media", mime_type: media.mime_type, expires_in: media.kind === "image" ? 30 : 300 };
  });
  await page.handlePreview({ ...hgReadyImage, source: "legacy_im" });
  await page.handlePreview({ ...hgReadyImage, purpose: "user_identity" });
  assert.equal(requests, 0);
  for (const [kind, mime, purpose, tag] of [
    ["image", "image/jpeg", "user_avatar", "img"],
    ["video", "video/mp4", "video_source", "video"],
    ["audio", "audio/mpeg", "chat_audio", "audio"],
  ]) {
    media = { ...hgReadyImage, kind, mime_type: mime, purpose, owned_by_me: true };
    await page.handlePreview(media);
    assert.equal(page.renderPreview().props.children.type, tag);
  }
  assert.equal(requests, 3);
  await page.handlePreview({ ...media, owned_by_me: false });
  assert.equal(requests, 3);
  assert.equal(page.state.preview.url, "https://store.example.invalid/media");
  page.closePreview();
  page.handleMediaError("https://store.example.invalid/media");
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
  assert.match(page.state.preview.error, /无权读取/);
  assert.equal(page.state.preview.url, undefined);

  const canceled = page.handlePreview(hgReadyImage);
  page.closePreview();
  assert.equal(signal.aborted, true);
  finish.resolve({ preview_url: "https://store.example.invalid/image", mime_type: "image/jpeg", expires_in: 30 });
  await canceled;
  assert.equal(page.state.preview, null);
});

test("所有行可看详情；有权限的新资源二次确认后才发出删除请求", async () => {
  const legacy = { ...hgReadyImage, source: "legacy_mall" };
  const calls = [];
  let finish;
  const page = hgCreatePage(undefined, (url, params) => {
    calls.push({ url, params });
    return new Promise((resolve) => { finish = resolve; });
  });
  page.setState({ items: [legacy, hgReadyImage] });
  const [detail, legacyPreview, legacyDelete] = page.renderActions(legacy).props.children;
  assert.equal(legacyPreview, false);
  assert.equal(legacyDelete, false);
  detail.props.onClick();
  assert.equal(page.renderDetail().props.title, "资源详情");
  page.renderDetail().props.onClose();
  assert.equal(page.renderDetail(), null);

  const deleteButton = page.renderActions(hgReadyImage).props.children[2];
  deleteButton.props.onClick();
  assert.equal(calls.length, 0);
  const confirmButton = page.renderDelete().props.footer.props.children[1];
  const deletion = confirmButton.props.onClick();
  await confirmButton.props.onClick();
  assert.deepEqual(calls, [{ url: hgDeleteEndpoint, params: { asset_id: hgID } }]);
  finish({ asset_id: hgID, status: "deleting" });
  await deletion;
  assert.equal(page.state.items[0].status, "ready");
  assert.equal(page.state.items[1].status, "deleting");
  assert.equal(page.renderDelete(), null);

  page.context.snapshot.grants = [];
  assert.deepEqual(page.renderActions(hgReadyImage).props.children.slice(1), [false, false]);
});

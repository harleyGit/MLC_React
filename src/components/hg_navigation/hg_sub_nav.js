/*
 * 子页栈式导航辅助：把「局部菜单」类页面（运维管理、采集平台等）的子页切换编码到 URL query，
 * 复用 react-router 的历史栈，实现 iOS 导航控制器式的 push/pop 语义。
 *
 * 背景：这类页面原先用局部 selectedKey 切换内容区、不写 URL，导致：
 *   - 无历史栈，子页跳转后无法「后退一步」（a→b→c→d，d 返回应到 c）；
 *   - 浏览器返回按钮与页面内返回按钮行为不一致；
 *   - 隐藏子页（不在左侧菜单、仅由列表页跳入）无法让父菜单保持高亮。
 *
 * 约定：query 键固定为 menu，值为子页 key；pathname 不变时 react-router 不会重挂载页面，仅 location.search 变化。
 */

/** 子页 key 在 URL query 中的键名。 */
export const HG_SUB_MENU_QUERY_KEY = "menu";

/**
 * 由基础路径与子页 key 构造完整 URL（含 query）。
 * @param {string} basePath 基础路径，如 "/operation"。
 * @param {string} key 子页 key；为空时返回纯净基础路径。
 * @returns {string} 编码后的 URL。
 */
export function hgBuildSubMenuUrl(basePath, key) {
  if (!key) return basePath;
  return `${basePath}?${HG_SUB_MENU_QUERY_KEY}=${encodeURIComponent(key)}`;
}

/**
 * 从 location.search 读取当前子页 key。
 * @param {string} search location.search（含前导 ?）。
 * @param {string} fallbackKey 无参数时的默认 key。
 * @returns {string} 子页 key。
 */
export function hgReadSubMenuKey(search, fallbackKey = "") {
  const params = new URLSearchParams(search || "");
  return params.get(HG_SUB_MENU_QUERY_KEY) || fallbackKey;
}

/**
 * 将当前子页 key 映射为「应高亮的左侧菜单 key」。
 * 隐藏子页（由列表页跳入、不在菜单树中）应回落到其父菜单 key，使父菜单保持高亮。
 * @param {string} key 当前子页 key。
 * @param {Object<string, string>} hiddenParentMap 隐藏子页 -> 父菜单 key 的映射。
 * @returns {string} 用于菜单高亮的 key。
 */
export function hgResolveHighlightKey(key, hiddenParentMap = {}) {
  return hiddenParentMap[key] || key;
}

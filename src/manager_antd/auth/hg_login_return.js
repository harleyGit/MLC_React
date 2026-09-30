/** 仅允许站内绝对路径，兼容守卫 state 和请求层整页登录跳转。 */
export function getHGLoginReturn(hgStateFrom, hgSearch, hgFallback = "/home") {
  const hgTarget = hgStateFrom ?? new URLSearchParams(hgSearch).get("redirect");
  if (typeof hgTarget !== "string" || !hgTarget.startsWith("/") || hgTarget.startsWith("//") || /[\\\s]/.test(hgTarget)) return hgFallback;
  return hgTarget;
}

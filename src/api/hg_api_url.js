/**
 * 拼接部署 API 基地址和接口路径，并消除基地址末尾 /api 与接口开头 /api 的重复段。
 * 约束：保留域名后的其他部署前缀，不假设固定部署域名。
 */
export function joinApiURL(baseURL = "", path = "") {
  const normalizedBase = String(baseURL || "").replace(/\/+$/, "");
  const normalizedPath = `/${String(path || "").replace(/^\/+/, "")}`;

  if (!normalizedBase) return normalizedPath;
  if (/\/api$/i.test(normalizedBase) && /^\/api(?:\/|$)/i.test(normalizedPath)) {
    return `${normalizedBase}${normalizedPath.slice(4) || "/"}`;
  }
  return `${normalizedBase}${normalizedPath}`;
}

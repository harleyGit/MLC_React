const HG_SIGN_STRIP_PREFIXES = [
  "/api/v1/auth",
  "/api/v1/user",
  "/api/v1/profile",
  "/api/v1/video_upload",
  "/api/v1/video_interactions",
  "/api/v1/video_comments",
  "/api/v1/ops",
  "/api/v1/test",
  "/auth",
  "/user",
  "/profile",
  "/video_upload",
  "/ops",
  "/test",
];

/**
 * 对齐 Go 根路由的 StripPrefix 行为，返回参与请求签名的模块内路径。
 * @param {string} path 完整 API 路径。
 * @returns {string} 去除已注册模块前缀后的签名路径。
 */
export function normalizeSignPath(path = "") {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;

  for (const prefix of HG_SIGN_STRIP_PREFIXES) {
    if (cleanPath === prefix) return "/";
    if (cleanPath.startsWith(`${prefix}/`)) return cleanPath.slice(prefix.length);
  }

  return cleanPath;
}

/**
 * 提取可直接展示的请求错误信息，优先保留后端稳定业务消息。
 * 约束：浏览器 fetch 网络失败使用明确提示，其余未知结构回退到调用方文案。
 */
export function getRequestErrorMessage(error, fallbackMessage) {
  const message = String(error?.message || "").trim();
  if (error instanceof TypeError || /failed to fetch|networkerror/i.test(message)) {
    return "网络连接失败，请检查网络或服务地址";
  }
  return message || fallbackMessage;
}

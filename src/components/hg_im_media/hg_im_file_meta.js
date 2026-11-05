/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-11-05 15:20:21
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-05 15:20:41
 * @FilePath: /MLC_React/src/components/hg_im_media/hg_im_file_meta.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * hg_im_file_meta.js
 * 文件卡片的纯函数助手：大小格式化与类型视觉映射。
 * 职责边界：不含 React 组件，供 hg_im_file_card.jsx 与业务侧复用；
 * 仅影响展示，不参与任何安全判断。
 */

/** 人类可读文件大小；未知或非法值返回占位文案，不冒充 0 字节。 */
export function hgIMFormatSize(hgBytes) {
  if (!Number.isFinite(hgBytes) || hgBytes < 0) return "大小未知";
  if (hgBytes < 1024) return `${hgBytes}B`;
  const hgUnits = ["KB", "MB", "GB"];
  let hgValue = hgBytes;
  let hgAt = -1;
  do {
    hgValue /= 1024;
    hgAt++;
  } while (hgValue >= 1024 && hgAt < hgUnits.length - 1);
  return `${hgValue >= 100 ? Math.round(hgValue) : hgValue.toFixed(1)}${
    hgUnits[hgAt]
  }`;
}

/** 按扩展名或 MIME 决定图标配色与文字；仅影响展示，不参与任何安全判断。 */
export function hgIMFileVisual(hgName = "", hgMIME = "") {
  const hgExt = hgName.includes(".")
    ? hgName.split(".").pop().toLowerCase()
    : "";
  if (hgMIME === "application/pdf" || hgExt === "pdf")
    return { label: "PDF", color: "#fa5151" };
  if (hgMIME.includes("wordprocessingml") || ["doc", "docx"].includes(hgExt))
    return { label: "DOC", color: "#1485ee" };
  if (hgMIME === "application/zip" || hgExt === "zip")
    return { label: "ZIP", color: "#f59b22" };
  if (
    hgMIME.startsWith("video/") ||
    ["mp4", "mov", "quicktime"].includes(hgExt)
  )
    return { label: "视频", color: "#07c160" };
  if (
    hgMIME.startsWith("audio/") ||
    ["mp3", "ogg", "m4a", "aac"].includes(hgExt)
  )
    return { label: "音频", color: "#10aeff" };
  if (
    hgMIME.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp"].includes(hgExt)
  )
    return { label: "图片", color: "#07c160" };
  return { label: "文件", color: "#8a919f" };
}

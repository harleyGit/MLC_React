/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-11-05 15:16:30
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-05 15:20:09
 * @FilePath: /MLC_React/src/components/hg_im_media/hg_im_file_card.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
/**
 * hg_im_file_card.jsx
 * 微信样式文件卡片：彩色类型图标 + 名称 + 大小。
 * 职责边界：纯展示组件，不发起请求；类型/大小助手见 hg_im_file_meta.js。
 */

import React from "react";
import { hgIMFileVisual, hgIMFormatSize } from "./hg_im_file_meta.js";
import styles from "./hg_im_media.module.css";

/**
 * 微信样式文件卡片；三个属性均来自已鉴权文件元数据，无业务安全的虚构默认值。
 * @param {object} props 文件展示属性。
 * @param {string} props.name 必传，无默认值；真实文件名，同时作为 title。
 * @param {number|undefined} props.size 必传，无默认值；字节数，undefined 表示尚未获取并展示占位。
 * @param {string|undefined} props.mime 必传，无默认值；MIME 用于选择文件类型图标。
 */
export default function HGIMFileCard({ name, size, mime }) {
  const hgVisual = hgIMFileVisual(name, mime);
  return (
    <div className={styles.fileCard}>
      <span
        className={styles.fileIcon}
        style={{ background: hgVisual.color }}
        aria-hidden="true"
      >
        {hgVisual.label}
      </span>
      <span className={styles.fileInfo}>
        <span className={styles.fileName} title={name}>
          {name}
        </span>
        <span className={styles.fileSize}>{hgIMFormatSize(size)}</span>
      </span>
    </div>
  );
}

import React, { Component } from "react";
import HGFileListPage from "../file_list/hg_file_list_page";
import styles from "../file_list/hg_file_list.module.css";

/** 独立入口只展示已登记资源；不在上传或本人点查时请求全站盘点接口。 */
class HGMediaInventoryPage extends Component {
  render() {
    return (
      <section className={styles.fileListContainer}>
        <h2 className={styles.pageTitle}>全部媒体资源</h2>
        <p className={styles.pageDesc}>
          所有记录均可查看详情。预览和删除须单独授权，仅适用于符合条件的新媒体；
          音视频仅限本人上传且未绑定业务的草稿，旧资源仅提供详情。
        </p>
        <HGFileListPage />
      </section>
    );
  }
}

export default HGMediaInventoryPage;

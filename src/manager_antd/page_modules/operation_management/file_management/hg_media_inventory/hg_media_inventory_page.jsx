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
          盘点新媒体与已登记的旧商城图片、视频、头像和 IM 附件。图片预览仅限本人上传且已通过审核的可预览资源；其余记录仅供查询。
        </p>
        <HGFileListPage />
      </section>
    );
  }
}

export default HGMediaInventoryPage;

/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 22:54:01
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-07 17:52:15
 * @FilePath: /MLC_React/src/manager_antd/page_modules/product/hg_ products_page.jsx
 * @Description: 商品列表页面外壳（PC 端）；人民币与 M币商品在类目下分开展示。
 */
import React, { Component } from "react";
import HGCommerceCatalogPage from "../../../pages/mall/hg_commerce_catalog_page.jsx";
import styles from "./hg_ products.module.css";

/**
 * HGProducts 商品列表页面外壳。
 * 职责：PC 商品入口使用平台类目；M币虚拟子类目进入独立的 M币商品与详情接口。
 * 人民币商品与 M币商品不共享筛选 ID、货币单位或购买链路。
 */
class HGProducts extends Component {
  /** 页头条：标题 + 说明，提示当前为公开商品目录。 */
  renderHeader() {
    return (
      <header className={styles.shopHeader}>
        <div className={styles.shopHeaderMain}>
          <h1 className={styles.shopTitle}>商品</h1>
          <p className={styles.shopSubtitle}>
            浏览已审核商品；人民币与 M币按类目分开展示。
          </p>
        </div>
      </header>
    );
  }

  render() {
    return (
      <div className={styles.shopPage}>
        {this.renderHeader()}
        <div className={styles.shopContent}>
          <HGCommerceCatalogPage />
        </div>
      </div>
    );
  }
}

export default HGProducts;

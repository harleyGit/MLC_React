/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 22:54:01
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-07 17:52:15
 * @FilePath: /MLC_React/src/manager_antd/page_modules/product/hg_ products_page.jsx
 * @Description: 商品列表页面外壳（PC 端），目录由 HGMallCatalog 渲染；详情走独立路由页。
 */
import React, { Component } from "react";
import HGCommerceCatalogPage from "../../../pages/mall/hg_commerce_catalog_page.jsx";
import styles from "./hg_ products.module.css";

/**
 * HGProducts 商品列表页面外壳。
 * 职责：PC 商品入口使用人民币商品目录与平台类目，不将 M币目录和人民币类目交叉筛选。
 * 点击卡片进入人民币商品详情，M币商品及商家工作台保持独立。
 */
class HGProducts extends Component {
  /** 页头条：标题 + 说明，提示当前为公开商品目录。 */
  renderHeader() {
    return (
      <header className={styles.shopHeader}>
        <div className={styles.shopHeaderMain}>
          <h1 className={styles.shopTitle}>商品</h1>
          <p className={styles.shopSubtitle}>
            浏览已审核上架的人民币商品，点击卡片进入商品详情页。
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

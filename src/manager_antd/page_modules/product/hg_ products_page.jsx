/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 22:54:01
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-07 17:52:15
 * @FilePath: /MLC_React/src/manager_antd/page_modules/product/hg_ products_page.jsx
 * @Description: 商品列表页面外壳（PC 端），目录由 HGMallCatalog 渲染；详情走独立路由页。
 */
import React, { Component } from "react";
import HGMallCatalog from "../../../pages/mall/hg_mall_catalog.jsx";
import styles from "./hg_ products.module.css";

/**
 * HGProducts 商品列表页面外壳。
 * 职责：仅提供 PC 端页面容器、标题条与说明；商品目录交互委托给 HGMallCatalog，
 * 点击卡片跳转独立商品详情路由页（/products/:productId），不在此处内联渲染详情。
 */
class HGProducts extends Component {
  /** 页头条：标题 + 说明，提示当前为公开商品目录。 */
  renderHeader() {
    return (
      <header className={styles.shopHeader}>
        <div className={styles.shopHeaderMain}>
          <h1 className={styles.shopTitle}>商品</h1>
          <p className={styles.shopSubtitle}>
            浏览全部已审核商品，点击卡片进入商品详情页。
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
          <HGMallCatalog hgInitialView="catalog" />
        </div>
      </div>
    );
  }
}

export default HGProducts;

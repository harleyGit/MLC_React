/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 22:54:01
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-30 20:44:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/product/hg_ products_page.jsx
 * @Description: 商品页面外壳（PC 端），目录与详情由 HGMallCatalog 渲染。
 */
import React, { Component } from "react";
import HGMallCatalog from "../../../pages/mall/hg_mall_catalog.jsx";
import styles from "./hg_ products.module.css";

/**
 * HGProducts 商品页面外壳。
 * 职责：仅提供 PC 端页面容器、标题条与说明；商品目录与详情交互全部委托给 HGMallCatalog，
 * 不在此处复制请求链或商品状态，保持与商家工作台同一数据源。
 */
class HGProducts extends Component {
  /** 页头条：标题 + 说明，提示当前为公开商品目录。 */
  renderHeader() {
    return (
      <header className={styles.shopHeader}>
        <div className={styles.shopHeaderMain}>
          <h1 className={styles.shopTitle}>商品</h1>
          <p className={styles.shopSubtitle}>
            浏览全部已审核商品，点击卡片查看详情并下单。
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

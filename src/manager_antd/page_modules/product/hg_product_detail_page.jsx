/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-11-07 18:00:00
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-07 18:00:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/product/hg_product_detail_page.jsx
 * @Description: 商品详情独立路由页（PC 端），对标拼多多商品详情布局；数据与购买链路复用 HGMallCatalog。
 */
import React, { Component } from "react";
import HGMallCatalog from "../../../pages/mall/hg_mall_catalog.jsx";
import styles from "./hg_ products.module.css";

/**
 * HGProductDetailPage 商品详情路由页外壳。
 * 职责：读取路由参数 productId 并交给 HGMallCatalog 的路由详情模式渲染；
 * 不在此处复制请求链或商品状态，商品不存在/下架等异常由目录组件统一提示。
 * 边界：本页仅服务买家视角；商家工作台的详情交互仍在个人中心内联展示。
 */
class HGProductDetailPage extends Component {
  /** 路由参数是唯一数据入口；缺少参数时不再发起请求，直接给出可返回目录的空态。 */
  renderDetail() {
    const hgProductId = (this.props.params?.productId || "").trim();
    if (!hgProductId) {
      return (
        <div className={styles.shopContent}>
          <p className={styles.shopSubtitle}>
            缺少商品编号，请从商品列表重新进入详情页。
          </p>
        </div>
      );
    }
    // 路由详情模式：目录组件按 productId 加载详情，返回列表走路由导航。
    return (
      <HGMallCatalog hgInitialView="catalog" hgProductId={hgProductId} />
    );
  }

  render() {
    return <div className={styles.shopPage}>{this.renderDetail()}</div>;
  }
}

export default HGProductDetailPage;

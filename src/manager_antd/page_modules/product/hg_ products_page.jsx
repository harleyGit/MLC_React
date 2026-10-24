/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 22:54:01
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:54:27
 * @FilePath: /MLC_React/src/manager_antd/page_modules/product/hg_ products_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component } from "react";
import HGMallCatalog from "../../../pages/mall/hg_mall_catalog.jsx";

class HGProducts extends Component {
  render() {
    return <main><h1>商品目录</h1><HGMallCatalog hgCatalogOnly /></main>;
  }
}

export default HGProducts;

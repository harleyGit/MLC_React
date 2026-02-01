/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 22:54:01
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:54:27
 * @FilePath: /MLC_React/src/manager_antd/page_modules/product/hg_ products_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component } from "react";
import styles from "./hg_ products.module.css";

class Products extends Component {
  render() {
    return (
      <div className={styles.container}>
        <h1>我们的产品</h1>
        <ul className={styles.productList}>
          <li>智能管理系统</li>
          <li>数据分析平台</li>
          <li>企业级安全网关</li>
        </ul>
      </div>
    );
  }
}

export default Products;

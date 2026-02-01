/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 22:55:26
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:56:01
 * @FilePath: /MLC_React/src/manager_antd/page_modules/about/hg_about_page.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { Component } from "react";
import styles from "./hg_about.module.css";

class About extends Component {
  render() {
    return (
      <div className={styles.container}>
        <h1>关于我们</h1>
        <p>我们是一家致力于提供高质量企业解决方案的科技公司，成立于2010年。</p>
        <p>团队由50+名工程师、设计师和产品经理组成，服务全球客户。</p>
      </div>
    );
  }
}

export default About;

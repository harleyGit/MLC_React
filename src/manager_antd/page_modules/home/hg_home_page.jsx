/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:43:08
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:33:27
 * @FilePath: /MLC_React/src/manager_antd/home/hg_home_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Button } from "antd";
import React from "react";
import { logout } from "../../auth/hg_auth";
import CSStyles from "./hg_home.module.css";

class HGHomePage extends React.Component {
  handleLogout = () => {
    logout();
    window.location.href = "/login"; // 强制浏览器跳转到登录页
  };

  render() {
    return (
      <div className={CSStyles.container}>
        <h2>首页（已登录）</h2>
        <Button type="primary" danger onClick={this.handleLogout}>
          退出登录
        </Button>
      </div>
    );
  }
}

export default HGHomePage;

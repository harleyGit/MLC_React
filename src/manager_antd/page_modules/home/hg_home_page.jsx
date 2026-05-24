/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:43:08
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-30 21:24:06
 * @FilePath: /MLC_React/src/manager_antd/home/hg_home_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGButtonPage from "../../components/hg_button/hg_button_page";
import React from "react";
import { logout } from "../../auth/hg_auth";
import CSStyles from "./hg_home.module.css";

class HGHomePage extends React.Component {
  handleLogout = () => {
    logout();
    window.location.href = "/login"; // 强制浏览器跳转到登录页
  };

  viewPersonalProfile = () => {
    this.props.navigate("/profile");
  };

  render() {
    return (
      <div className={CSStyles.container}>
        <h2>首页（已登录）</h2>
        <HGButtonPage type="primary" danger onClick={this.handleLogout}>
          退出登录
        </HGButtonPage>
        <button onClick={this.viewPersonalProfile}>查看我的资料</button>
      </div>
    );
  }
}

export default HGHomePage;

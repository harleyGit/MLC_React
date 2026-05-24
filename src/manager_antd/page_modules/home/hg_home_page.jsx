/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:43:08
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-30 21:24:06
 * @FilePath: /MLC_React/src/manager_antd/home/hg_home_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import React from "react";
import { logout } from "../../auth/hg_auth";
import CSStyles from "./hg_home.module.css";

/**
 * 首页（已登录态）
 * 职责：展示已登录用户的首页，提供退出登录和查看个人资料入口。
 * 输入：props - 包含 navigate 方法（由 WithNavigation 注入），用于页面跳转。
 * 约束：依赖 logout 清除登录态，跳转使用原生 window.location。
 */
class HGHomePage extends React.Component {
  /**
   * 退出登录，清除本地登录态并强制跳转到登录页。
   * @returns {void}
   */
  handleLogout = () => {
    logout();
    window.location.href = "/login"; // 强制浏览器跳转到登录页
  };

  /**
   * 跳转到个人资料页面。
   * @returns {void}
   */
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

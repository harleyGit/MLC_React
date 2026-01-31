/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 21:08:37
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 11:44:45
 * @FilePath: /MLC_React/src/manager_antd/user/hg_user_profile_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE

 *   HGUserProfilePage → HGUpdateUserProfilePage 页面传参（class 组件）
*/
import React from "react";
import { WithNavigation } from "../router/hg_naviagion_hook";
import { ROUTE_PATH } from "../router/hg_router_path";
import CSStyles from "./hg_user_profile.module.css";

class HGUserProfilePage extends React.Component {
  state = {
    count: 0,
    refreshed: false,
  };

  componentDidUpdate(prevProps) {
    const prevState = prevProps.location.state;
    const currentState = this.props.location.state;
    console.log(
      "🍎 用户信息页 fromB:",
      currentState?.fromB,
      "preState:",
      prevState
    );
    // 👇 监听 HGUpdateUserProfilePage 回传的数据
    if (currentState?.fromB && prevState !== currentState) {
      this.setState({
        refreshed: true,
        count: currentState.newCount,
      });
    }
  }

  goToUpdateUserProfilePage = () => {
    this.props.navigate(ROUTE_PATH.HOME, {
      state: {
        from: "HGUserProfilePage",
        count: this.state.count,
      },
    });
  };

  render() {
    return (
      <div className={CSStyles.page}>
        <h2>Page HGUserProfilePage</h2>
        <p>count: {this.state.count}</p>
        <p>refreshed: {String(this.state.refreshed)}</p>
        <button onClick={this.goToUpdateUserProfilePage}>
          去 Page HGUpdateUserProfilePage
        </button>
      </div>
    );
  }
}

export default WithNavigation(HGUserProfilePage);

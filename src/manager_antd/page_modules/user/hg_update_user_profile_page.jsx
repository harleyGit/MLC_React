/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 21:12:31
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:42:30
 * @FilePath: /MLC_React/src/manager_antd/user/hg_update_user_profile_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 
* HGUpdateUserProfilePage → A 回传参数（class 组件）:该页面是PageB.jsx
*/
// HGUserProfilePage → HGUpdateUserProfilePage 页面传参（class 组件）,该页面是A组件
import React from "react";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import { PAGE } from "../../../components/hg_navigation/hg_page_registry";
import CSStyles from "./hg_update_user_profile.module.css";

class HGUpdateUserProfilePage extends React.Component {
  state = {
    localCount: 0,
  };

  componentDidMount() {
    const count = this.props.location.state?.count || 0;
    console.log("🍎 来自用户信息count：", count);
    this.setState({ localCount: count });
  }

  /** 返回用户资料页，通过 state 回传更新后的计数。 */
  goBackToUserProfilePage = () => {
    this.props.pageNavigator.open({
      page: PAGE.USER_PROFILE,
      // replace: true, // 👈 不新增历史
      state: {
        fromB: true,
        newCount: this.state.localCount + 1,
      },
    });
  };

  render() {
    return (
      <div className={CSStyles.page}>
        <h2>Page HGUpdateUserProfilePage</h2>
        <p>localCount: {this.state.localCount}</p>
        <button onClick={this.goBackToUserProfilePage}>
          返回 HGUserProfilePage（并回传参数）
        </button>
      </div>
    );
  }
}

export default WithNavigation(HGUpdateUserProfilePage);

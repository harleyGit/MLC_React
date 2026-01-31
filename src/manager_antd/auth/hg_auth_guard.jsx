/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:40:58
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 11:04:52
 * @FilePath: /MLC_React/src/manager_antd/auth/hg_auth_guard.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React from "react";
import { Navigate } from "react-router-dom";
import { ROUTE_PATH } from "../router/hg_router_path";
import { isAuthenticated } from "./hg_auth";

/* 登录拦截+自动跳转 */
class HGAuthGuard extends React.Component {
  render() {
    const { children } = this.props;
    // const location = useLocation(); state={{ from: location.pathname }}

    if (!isAuthenticated()) {
      return <Navigate t={ROUTE_PATH.LOGIN} replace />;
    }

    return children;
  }
}

export default HGAuthGuard;

/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:40:58
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-03-01 17:28:06
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
      console.log("🍎未登录");
      // 手机打开本人充值链接时，登录后保留订单号；不接受外部重定向地址。
      const hgRechargeReturn = window.location.pathname === ROUTE_PATH.WALLET_RECHARGE
        ? { from: `${ROUTE_PATH.WALLET_RECHARGE}${window.location.search}` }
        : undefined;
      return <Navigate to={ROUTE_PATH.LOGIN} state={hgRechargeReturn} replace />;
    }

    return children;
  }
}

export default HGAuthGuard;

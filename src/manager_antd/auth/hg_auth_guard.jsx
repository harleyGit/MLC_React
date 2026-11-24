/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:40:58
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-03-01 17:28:06
 * @FilePath: /MLC_React/src/manager_antd/auth/hg_auth_guard.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React from "react";
import { Link, Navigate } from "react-router-dom";
import NetManager from "../../api/HttpManagerV1";
import { hgCurrentIAMExpiry } from "../../modules/iam/hg_iam_session";
import { ROUTE_PATH } from "../router/hg_router_path";
import { REFRESH_TOKEN_KEY, isAuthenticated } from "./hg_auth";

/* 登录拦截+自动跳转 */
class HGAuthGuard extends React.Component {
  state = {
    hgRefreshError: false, // 续签网络失败且 access 已过期时显示重试，不误判为服务端撤销。
  };
  hgTimer = null; // 当前 access 到期前 30 秒的单次续签定时器；卸载时清除。
  hgMounted = false; // 路由卸载后不更新登录提示或继续安排续签。
  hgPending = null; // 当前续签任务；重复事件与手动重试共享结果。

  componentDidMount() {
    this.hgMounted = true;
    window.addEventListener("hg:token-refreshed", this.hgScheduleSession);
    window.addEventListener("storage", this.hgOnStorage);
    this.hgScheduleSession();
  }

  componentWillUnmount() {
    this.hgMounted = false;
    clearTimeout(this.hgTimer);
    window.removeEventListener("hg:token-refreshed", this.hgScheduleSession);
    window.removeEventListener("storage", this.hgOnStorage);
  }

  /** 另一标签页登录、退出或续签时立即重新检查，不能继续展示旧账号页面。 */
  hgOnStorage = (event) => {
    if (event.key === "manager_token" || event.key === REFRESH_TOKEN_KEY || event.key === null) {
      this.hgScheduleSession();
      this.setState({ hgRefreshError: false });
    }
  };

  /** Access Token 即将到期或已过期时复用同一续签链；不凭 refresh token 直接放行。 */
  hgScheduleSession = () => {
    clearTimeout(this.hgTimer);
    if (!this.hgMounted) return;
    const expiry = hgCurrentIAMExpiry(); // 毫秒；0 表示 access 已无效。
    if (!expiry || expiry - Date.now() <= 30_000) {
      void this.hgRenewSession();
      return;
    }
    this.hgTimer = setTimeout(() => void this.hgRenewSession(), expiry - Date.now() - 30_000);
    this.setState({ hgRefreshError: false });
  };

  /** 续签失败后不渲染过期会话的受保护内容；保留重试和主动重新登录入口。 */
  hgRenewSession = () => {
    if (this.hgPending) return this.hgPending;
    if (!(localStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem("refreshToken"))) {
      if (this.hgMounted) this.setState({ hgRefreshError: false });
      return Promise.resolve();
    }
    const pending = NetManager.ensureFreshToken()
      .then(() => {
        if (this.hgMounted) {
          if (!isAuthenticated()) {
            this.setState({ hgRefreshError: true });
            return;
          }
          this.hgScheduleSession();
          this.setState({ hgRefreshError: false });
        }
      })
      .catch(() => {
        if (!this.hgMounted) return;
        if (isAuthenticated()) {
          clearTimeout(this.hgTimer);
          this.hgTimer = setTimeout(() => void this.hgRenewSession(), Math.max(1, hgCurrentIAMExpiry() - Date.now()));
        } else {
          this.setState({ hgRefreshError: true });
        }
      })
      .finally(() => {
        if (this.hgPending === pending) this.hgPending = null;
      });
    this.hgPending = pending;
    return pending;
  };

  render() {
    const { children } = this.props;

    if (!isAuthenticated()) {
      if (localStorage.getItem(REFRESH_TOKEN_KEY) || localStorage.getItem("refreshToken")) {
        if (this.state.hgRefreshError) return <div role="alert">登录续签失败。<button type="button" onClick={this.hgRenewSession}>重试</button><Link to={ROUTE_PATH.LOGIN}>重新登录</Link></div>;
        return <p role="status">正在恢复登录...</p>;
      }
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

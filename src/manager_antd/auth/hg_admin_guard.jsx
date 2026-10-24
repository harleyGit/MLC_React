import React from "react";
import { Navigate } from "react-router-dom";
import { ROUTE_PATH } from "../router/hg_router_path";
import { hgGetAdminStatus } from "./hg_admin_status";

/** 运维与采集页面的直达路由守卫；真正的资源授权仍由服务端各 API 校验。 */
export default class HGAdminGuard extends React.Component {
  state = { hgAllowed: null }; // null 为等待服务端身份核验，false 表示拒绝访问。
  hgMounted = false; // 路由卸载后忽略延迟的核验响应。

  componentDidMount() {
    this.hgMounted = true;
    hgGetAdminStatus().then((hgAllowed) => {
      if (this.hgMounted) this.setState({ hgAllowed });
    }).catch(() => { if (this.hgMounted) this.setState({ hgAllowed: false }); });
  }

  componentWillUnmount() { this.hgMounted = false; }

  render() {
    if (this.state.hgAllowed === null) return <p role="status">正在核验管理员身份...</p>;
    return this.state.hgAllowed ? this.props.children : <Navigate to={ROUTE_PATH.HOME} replace />;
  }
}

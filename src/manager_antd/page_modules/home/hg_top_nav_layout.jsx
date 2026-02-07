/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-03 10:29:22
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-07 16:33:29
 * @FilePath: /MLC_React/src/manager_antd/page_modules/home/hg_top_nav_layout.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// src/components/HGTopNavLayout.jsx
import { Layout, Menu } from "antd";
import React, { Component } from "react";
import { Link, Outlet } from "react-router-dom";
import { ROUTE_PATH } from "../../router/hg_router_path";
import styles from "./hg_top_nav_layout.module.css";

const { Header, Content, Footer } = Layout;

class HGTopNavLayout extends Component {
  constructor(props) {
    super(props);
    this.state = {
      current: this.getCurrentPage(),
    };
  }

  componentDidMount() {
    // 监听路由变化（通过 props.location 由 HOC 提供）
    this.updateCurrentPage();
  }

  componentDidUpdate(prevProps) {
    if (prevProps.location?.pathname !== this.props.location?.pathname) {
      this.updateCurrentPage();
    }
  }

  getCurrentPage = () => {
    const path = this.props.location?.pathname || "/";
    if (path === ROUTE_PATH.DEFAULT || path === ROUTE_PATH.HOME)
      return "home";
    if (path === ROUTE_PATH.PRODUCTS) return "products";
    if (path === ROUTE_PATH.ABOUT) return "about";
    if (path === ROUTE_PATH.USER_PROFILE) return "profile";
    return "home";
  };

  updateCurrentPage = () => {
    this.setState({ current: this.getCurrentPage() });
  };

  handleClick = (e) => {
    this.setState({ current: e.key });
  };

  render() {
    const { current } = this.state;

    return (
      <Layout className={styles.layout}>
        <Header>
          <div className={styles.logo} />
          <Menu
            theme="dark"
            mode="horizontal"
            selectedKeys={[current]}
            onClick={this.handleClick}
          >
            <Menu.Item key="home">
              <Link to={ROUTE_PATH.HOME} className={styles.menuLink}>
                首页
              </Link>
            </Menu.Item>
            <Menu.Item key="products">
              <Link to={ROUTE_PATH.PRODUCTS} className={styles.menuLink}>
                产品
              </Link>
            </Menu.Item>
            <Menu.Item key="about">
              <Link to={ROUTE_PATH.ABOUT} className={styles.menuLink}>
                我们
              </Link>
            </Menu.Item>
            <Menu.Item key="profile">
              <Link to={ROUTE_PATH.USER_PROFILE} className={styles.menuLink}>
                我的信息
              </Link>
            </Menu.Item>
          </Menu>
        </Header>

        <Content style={{ padding: "50px 0" }}>
          <div className={styles.contentWrapper}>
            <Outlet /> {/* 渲染子路由 */}
          </div>
        </Content>

        <Footer style={{ textAlign: "center", padding: "24px 0" }}>
          Ant Design ©2026
        </Footer>
      </Layout>
    );
  }
}

export default HGTopNavLayout;

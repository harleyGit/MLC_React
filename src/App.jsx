/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 09:31:27
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 23:06:46
 * @FilePath: /MLC_React/src/App.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Layout, Menu, Switch } from "antd";
import React, { Component } from "react";
import { RouterProvider } from "react-router";
import {
  Link,
  Navigate,
  Route,
  BrowserRouter as Router,
} from "react-router-dom";
import "./App.css";
import styles from "./App.module.css";
import About from "./manager_antd/page_modules/about/hg_about_page";
import HGHomePage from "./manager_antd/page_modules/home/hg_home_page";
import Products from "./manager_antd/page_modules/product/hg_ products_page";
import Profile from "./manager_antd/page_modules/profile/hg_profile_page";
import HGRouter from "./manager_antd/router/hg_router";

const { Header, Content, Footer } = Layout;

class App extends Component {
  constructor(props) {
    super(props);
    this.state = {
      current: "home",
    };
  }

  componentDidMount() {
    this.updateCurrentFromPath();
  }

  componentDidUpdate(prevProps) {
    if (
      this.props.location &&
      prevProps.location &&
      prevProps.location.pathname !== this.props.location.pathname
    ) {
      this.updateCurrentFromPath();
    }
  }

  updateCurrentFromPath = () => {
    if (!this.props.location) return;

    const path = this.props.location.pathname;
    switch (path) {
      case "/":
        this.setState({ current: "home" });
        break;
      case "/products":
        this.setState({ current: "products" });
        break;
      case "/about":
        this.setState({ current: "about" });
        break;
      case "/profile":
        this.setState({ current: "profile" });
        break;
      default:
        this.setState({ current: "home" });
    }
  };

  handleClick = (e) => {
    this.setState({ current: e.key });
  };

  render0() {
    return (
      <div
        className="App"
        style={{ backgroundColor: "#f0f2f5", minHeight: "100vh" }}
      >
        {/* 直接用 RouterProvider，不需要包裹 div */}
        <RouterProvider router={HGRouter} />
      </div>
    );
  }
  render() {
    const { current } = this.state;

    return (
      <Router>
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
                <Link to="/" className={styles.menuLink}>
                  首页
                </Link>
              </Menu.Item>
              <Menu.Item key="products">
                <Link to="/products" className={styles.menuLink}>
                  产品
                </Link>
              </Menu.Item>
              <Menu.Item key="about">
                <Link to="/about" className={styles.menuLink}>
                  我们
                </Link>
              </Menu.Item>
              <Menu.Item key="profile">
                <Link to="/profile" className={styles.menuLink}>
                  我的信息
                </Link>
              </Menu.Item>
            </Menu>
          </Header>

          <Content style={{ padding: "50px 0" }}>
            <div className={styles.contentWrapper}>
              <Switch>
                <Route exact path="/" component={HGHomePage} />
                <Route path="/products" component={Products} />
                <Route path="/about" component={About} />
                <Route path="/profile" component={Profile} />
                <Navigate to="/" />
              </Switch>
            </div>
          </Content>

          <Footer style={{ textAlign: "center", padding: "24px 0" }}>
            Ant Design ©2026
          </Footer>
        </Layout>
      </Router>
    );
  }
}
export default App;

/*
function App() {
  const [count, setCount] = useState(0)

  return (
    <Routes>
      <Route path="/home" element={<HomePage />} />
      <Route path="/domain-detection" element={<DomainDetectView />} />
      <Route path="/app/guide_video" element={<GuideVideoView />} />
      <Route path="/" element={<Navigate to="/home" />}></Route>
    </Routes>
  )

  return (
    <>
    <div>
      <h1>Hello React</h1>
      <p>当前环境: {import.meta.env.VITE_APP_ENV}</p>
      <p>API 地址: {import.meta.env.VITE_API_URL}</p>
    </div>import About from './manager_antd/page_modules/about/hg_about_page';
import { Redirect } from 'react-router-dom';
import { Switch } from 'react-router-dom';

      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  )
}

export default App
*/

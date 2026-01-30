/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 09:31:27
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-30 10:07:18
 * @FilePath: /MLC_React/src/App.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { Component } from "react";
import { RouterProvider } from "react-router";
import "./App.css";
import HGRouter from "./manager_antd/router/hg_router";

class App extends Component {
  render() {
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
    </div>
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

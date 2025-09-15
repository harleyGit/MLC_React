/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 09:31:27
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-15 13:42:37
 * @FilePath: /MLC_React/src/App.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { useState } from 'react'
import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/home_module/HomePage';
import DomainDetectView from './pages/domain_detect/domain_detect_view';
import GuideVideoView from './pages/app/guide_video/GuideVideoView';


function App() {
  const [count, setCount] = useState(0)

  return (
    <>
     <Routes>
        <Route path="/home" element={<HomePage />} />
        <Route path="/domain-detection" element={<DomainDetectView />} />
        <Route path="/app/guide_video" element={<GuideVideoView />} />
        <Route path="/" element={<Navigate to="/home" />}></Route>
      </Routes>
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

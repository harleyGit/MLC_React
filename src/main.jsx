/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 09:31:27
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-12 09:38:50
 * @FilePath: /MLC_React/src/main.jsx
//  * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { HashRouter } from "react-router-dom";
import reportWebVitals from './optimize/reportWebVitals.js';
import { StrictMode } from 'react';
import { React } from 'react';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <HashRouter>
  <App />
</HashRouter>
  </StrictMode>,
)

reportWebVitals();

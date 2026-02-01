/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 09:31:27
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 23:02:53
 * @FilePath: /MLC_React/src/main.jsx
//  * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React, { StrictMode } from "react"; // ✅ 默认导出
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import reportWebVitals from "./optimize/reportWebVitals.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
  // <RouterProvider router={HGRouter} />
);

reportWebVitals();

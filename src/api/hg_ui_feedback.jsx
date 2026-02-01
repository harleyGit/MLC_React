/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-01 18:06:06
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 18:11:32
 * @FilePath: /MLC_React/src/api/hg_ui_feedback.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { message } from 'antd';

/**
 * 错误提示（红）
 */
export function showError(msg) {
  message.error({
    content: msg,
    duration: 3,
  });
}

/**
 * 警告提示（黄）
 */
export function showWarning(msg) {
  message.warning({
    content: msg,
    duration: 3,
  });
}

/**
 * 成功提示（绿，可选）
 */
export function showSuccess(msg) {
  message.success({
    content: msg,
    duration: 2,
  });
}


// 注意：不要用 react-router 的 hook，因为这是 非 React 组件环境（Net / util 层）
export function redirectToLogin() {
    // 清理本地登录态
    localStorage.removeItem("manager_token");
  
    // 带回跳地址
    const redirect = encodeURIComponent(window.location.pathname);
    window.location.href = `/login?redirect=${redirect}`;
  }
  

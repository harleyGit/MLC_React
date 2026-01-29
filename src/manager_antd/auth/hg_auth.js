/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:38:26
 * @LastEditors: Harley harelysoa@qq.com
 * @LastEditTime: 2026-01-29 23:18:46
 * @FilePath: /MLC_React/src/manager_antd/auth/hg_auth.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

export const TOKEN_KEY = "manager_token";
// 判断是否登录
export function getToken() {
  console.log("auth token 🍎：", localStorage.getItem(TOKEN_KEY));
  //token 存在localStorage
  // token是jwt有过期时间
  return localStorage.getItem(TOKEN_KEY);
}

// 判断 token 是否过期（JWT）
export function isTokenExpired(token) {
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const exp = payload.exp * 1000;
    return Date.now() > exp;
  } catch (e) {
    return true;
  }
}

// 综合判断
export function isAuthenticated() {
  const token = getToken();
  if (!token) return false;
  return !isTokenExpired(token);
}

// 退出登录
export function logout() {
  localStorage.removeItem(TOKEN_KEY);
}

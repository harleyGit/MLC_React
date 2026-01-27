/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:38:26
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-26 11:39:31
 * @FilePath: /MLC_React/src/manager_antd/auth/hg_auth.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
// 判断是否登录
export function getToken() {
    //token 存在localStorage
    // token是jwt有过期时间
  return localStorage.getItem("token");
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
  localStorage.removeItem("token");
}

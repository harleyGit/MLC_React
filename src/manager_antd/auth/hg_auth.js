/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-26 11:38:26
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 11:35:26
 * @FilePath: /MLC_React/src/manager_antd/auth/hg_auth.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGUserProfileStorage from "../storage/hg_user_profile_storage";

/* DEBUG环境默认值设置 */
const env = import.meta.env;
const isDebug = env.VITE_APP_ENV === "debug";
export const DEBUG_MAP = isDebug
  ? {
      userName: env.VITE_DEFAULT_USERNAME,
      password: env.VIETE_DEFAULT_PASSWORD,
    }
  : {};

export const TOKEN_KEY = "manager_token";
export const REFRESH_TOKEN_KEY = "refresh_token";

// 判断是否登录
export function getToken() {
  // console.log("auth token 🍎：", localStorage.getItem(TOKEN_KEY));
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
  } catch {
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
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem("refreshToken");
  HGUserProfileStorage.clearUserProfile();
}

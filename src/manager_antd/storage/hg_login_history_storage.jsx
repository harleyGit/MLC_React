import HGStorage from "./hg_storage";
import {
  LOGIN_HISTORY_STORAGE_KEY,
  LOGIN_HISTORY_STORAGE_VERSION,
  normalizeLoginHistory,
  updateLoginHistory,
} from "./hg_login_history";

/**
 * 登录账号历史存储。
 * 约束：仅保存账号和成功登录时间，密码等凭据必须交由浏览器密码管理器保存。
 */
export default class HGLoginHistoryStorage {
  /**
   * 读取并规范化最近登录账号。
   * @returns {Array<{userName: string, lastLoginAt: number}>} 最近登录账号列表。
   */
  static getRecentAccounts() {
    const history = HGStorage.getItem(LOGIN_HISTORY_STORAGE_KEY, {
      version: LOGIN_HISTORY_STORAGE_VERSION,
    });
    return normalizeLoginHistory(history);
  }

  /**
   * 记录一次成功登录，并把该账号提升到列表首位。
   * @param {string} userName - 成功登录的账号。
   * @param {number} [lastLoginAt=Date.now()] - 成功登录时间。
   * @returns {Array<{userName: string, lastLoginAt: number}>} 更新后的账号列表。
   */
  static recordSuccessfulLogin(userName, lastLoginAt = Date.now()) {
    const history = updateLoginHistory(this.getRecentAccounts(), userName, lastLoginAt);
    HGStorage.setItem(LOGIN_HISTORY_STORAGE_KEY, history, {
      version: LOGIN_HISTORY_STORAGE_VERSION,
    });
    return history;
  }
}

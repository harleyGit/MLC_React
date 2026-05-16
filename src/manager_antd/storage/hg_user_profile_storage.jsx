import HGStorage from "./hg_storage";

const USER_PROFILE_STORAGE_KEY = "manager_user_profile";
const USER_PROFILE_STORAGE_VERSION = 1;
const USER_PROFILE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

/**
 * 用户资料本地存储封装：只负责用户资料字段过滤，底层读写交给通用 HGStorage。
 * 约束：只缓存页面展示必要字段，不保存 token、密码等敏感信息。
 */
export default class HGUserProfileStorage {
  /**
   * 保存当前用户资料快照。
   * @param {Object} userProfile 后端返回的用户资料对象。
   * @returns {Object|null} 实际缓存的安全用户资料；存储失败时返回 null。
   */
  static saveUserProfile(userProfile) {
    if (!userProfile || typeof userProfile !== "object") {
      return null;
    }

    const safeProfile = this.buildSafeUserProfile(userProfile);
    return HGStorage.setItem(USER_PROFILE_STORAGE_KEY, safeProfile, {
      version: USER_PROFILE_STORAGE_VERSION,
      maxAge: USER_PROFILE_MAX_AGE,
    });
  }

  /**
   * 获取本地缓存的当前用户资料。
   * @returns {Object|null} 未登录、过期、格式异常或不可读取时返回 null。
   */
  static getUserProfile() {
    return HGStorage.getItem(USER_PROFILE_STORAGE_KEY, {
      version: USER_PROFILE_STORAGE_VERSION,
    });
  }

  /**
   * 清除本地用户资料缓存。
   * 约束：退出登录、登录态失效或缓存格式异常时调用。
   */
  static clearUserProfile() {
    HGStorage.removeItem(USER_PROFILE_STORAGE_KEY);
  }

  /**
   * 按白名单构造可落本地的用户资料，避免误存密码、token 等敏感字段。
   * @param {Object} userProfile 后端返回的用户资料对象。
   * @returns {Object} 过滤后的用户资料对象。
   */
  static buildSafeUserProfile(userProfile) {
    const safeKeys = [
      "id",
      "user_id",
      "username",
      "userName",
      "phone",
      "email",
      "nickname",
      "signature",
      "gender",
      "birth_month",
      "avatar_url",
      "avatarUrl",
      "created_at",
      "updated_at",
    ];

    return safeKeys.reduce((result, key) => {
      if (userProfile[key] !== undefined && userProfile[key] !== null) {
        result[key] = userProfile[key];
      }
      return result;
    }, {});
  }

}

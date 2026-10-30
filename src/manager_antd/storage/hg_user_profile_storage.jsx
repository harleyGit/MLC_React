import HGStorage from "./hg_storage";
import HGUserProfileSession from "./hg_user_profile_session";

/** 用户资料本地入口：只在当前标签页短期保存最小展示资料；联系方式仅留在运行时内存。 */
export default class HGUserProfileStorage {
  /** 清理旧版 localStorage 明文资料；不从旧缓存迁移敏感信息。 */
  static hgRemoveLegacyProfile() {
    HGStorage.removeItem("manager_user_profile");
  }

  /** 保存当前登录用户的服务端资料快照；其他账号的数据不缓存。 */
  static saveUserProfile(profile) {
    this.hgRemoveLegacyProfile();
    return HGUserProfileSession.save(profile);
  }

  /** 其他页面可读取当前用户资料；刷新后只恢复非敏感展示字段。 */
  static getUserProfile() {
    this.hgRemoveLegacyProfile();
    return HGUserProfileSession.get();
  }

  /** 服务端局部更新成功后同步已缓存的资料字段，不允许任意字段覆盖。 */
  static patchUserProfile(fields) {
    this.hgRemoveLegacyProfile();
    return HGUserProfileSession.patch(fields);
  }

  /** 登出或登录过期时清除新旧缓存。 */
  static clearUserProfile() {
    HGUserProfileSession.clear();
    this.hgRemoveLegacyProfile();
  }
}

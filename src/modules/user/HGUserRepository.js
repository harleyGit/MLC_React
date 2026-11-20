/**
 * 用户信息仓库
 * 职责：user_profiles 表的读写，负责个人资料的本地缓存与账号隔离。
 * 关键约束：写入前强制补 cached_at；读取方可结合 HGCachePolicy 判断是否需要后台刷新。
 */

import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../../infrastructure/storage/HGLocalDataService";

class HGUserRepository extends HGBaseRepository {
  constructor() {
    super(HG_STORES.USERS);
  }

  // 保存用户资料（覆盖式更新），写入后广播变更通知
  async saveProfile(profile) {
    if (!profile?.user_id) {
      throw new Error("user_id 不能为空");
    }

    const record = await this.put({
      ...profile,
      cached_at: Date.now()
    });

    hgLocalDataService.notifyChange(HG_STORES.USERS);
    return record;
  }

  // 读取指定用户资料；不存在时返回 undefined
  async getProfile(userId) {
    return this.get(userId);
  }

  // 删除指定用户资料
  async removeProfile(userId) {
    const result = await this.delete(userId);
    hgLocalDataService.notifyChange(HG_STORES.USERS, { broadcast: false });
    return result;
  }
}

export const hgUserRepository = new HGUserRepository();

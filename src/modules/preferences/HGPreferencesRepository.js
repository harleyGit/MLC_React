/**
 * 个人偏好仓库
 * 职责：user_preferences 表的读写，采用 user_id + key 复合主键的 KV 模型。
 * 关键约束：新增偏好项只增加记录、不改表结构；
 *          需要频繁单独查询或同步的设置建议用独立 Key，不要塞进一个大 JSON。
 */

import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../../infrastructure/storage/HGLocalDataService";

class HGPreferencesRepository extends HGBaseRepository {
  constructor() {
    super(HG_STORES.PREFERENCES);
  }

  // 写入偏好项；sync_status 标记尚未同步到服务端的本地修改
  async setPreference(userId, key, value) {
    const record = await this.put({
      user_id: userId,
      key,
      value,
      updated_at: Date.now(),
      sync_status: "local"
    });

    hgLocalDataService.notifyChange(HG_STORES.PREFERENCES);
    return record;
  }

  // 读取单个偏好项的值；不存在时返回 undefined
  async getPreference(userId, key) {
    const record = await this.get([userId, key]);
    return record?.value;
  }

  // 读取指定用户全部偏好，返回 { key: value } 字典
  async getPreferences(userId) {
    const records = await this.getAllByIndex("user_id", userId);
    return Object.fromEntries(records.map((item) => [item.key, item.value]));
  }

  // 读取尚未同步到服务端的偏好记录，供同步任务上传
  async getPendingSync(userId) {
    const records = await this.getAllByIndex("user_id", userId);
    return records.filter((item) => item.sync_status === "pending" || item.sync_status === "local");
  }

  // 标记偏好项已同步到服务端
  async markSynced(userId, key) {
    const record = await this.get([userId, key]);
    if (!record) return null;

    return this.put({ ...record, sync_status: "synced" });
  }
}

export const hgPreferencesRepository = new HGPreferencesRepository();

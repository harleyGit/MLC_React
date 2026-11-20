/**
 * 运维管理仓库
 * 职责：ops_task_cache 表的读写，缓存允许离线展示的运维任务摘要。
 * 关键约束：只缓存非敏感摘要；管理员权限、MFA 状态、审批结果等必须以
 *          Go 后端实时校验为准，禁止依据本地数据决定是否允许执行运维操作。
 */

import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../../infrastructure/storage/HGLocalDataService";
import { hgIsRecordFresh } from "../../infrastructure/storage/HGCachePolicy";

class HGOpsRepository extends HGBaseRepository {
  constructor() {
    super(HG_STORES.OPS);
  }

  // 批量保存运维任务摘要（单事务写入），按 [user_id, task_id] 覆盖更新
  async saveTasks(userId, tasks) {
    if (!userId || !Array.isArray(tasks) || tasks.length === 0) {
      return;
    }

    const cachedAt = Date.now();

    await this.execute("readwrite", (store) => {
      for (const task of tasks) {
        if (!task?.task_id) {
          continue;
        }
        store.put({
          ...task,
          user_id: userId,
          updated_at: task.updated_at || cachedAt,
          cached_at: cachedAt
        });
      }
      return null;
    });

    hgLocalDataService.notifyChange(HG_STORES.OPS);
  }

  // 按更新时间正序读取用户全部运维任务缓存
  async listTasks(userId) {
    return this.getAllByIndex(
      "user_updated",
      IDBKeyRange.bound([userId, 0], [userId, Number.MAX_SAFE_INTEGER])
    );
  }

  // 读取单个任务缓存；是否展示以缓存策略 TTL 为准
  async getTask(userId, taskId) {
    const record = await this.get([userId, taskId]);
    return record;
  }

  // 判断任务缓存是否仍在 TTL 有效期内
  isTaskFresh(record) {
    return hgIsRecordFresh(record, HG_STORES.OPS);
  }

  // 清空运维任务缓存（登出场景由 hgClearUserData 统一处理）
  async clearAll() {
    const result = await this.clear();
    hgLocalDataService.notifyChange(HG_STORES.OPS, { broadcast: false });
    return result;
  }
}

export const hgOpsRepository = new HGOpsRepository();

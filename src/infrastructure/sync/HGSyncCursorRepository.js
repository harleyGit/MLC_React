/**
 * 同步游标仓库
 * 职责：读写 sync_cursors 表，记录各业务域（im / mall / notification / ops）的增量同步位置。
 * 关键约束：游标推进与数据写入必须在同步引擎的同一事务中完成，禁止单独推进游标。
 */

import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";

class HGSyncCursorRepository extends HGBaseRepository {
  constructor() {
    super(HG_STORES.CURSORS);
  }

  // 读取指定用户指定业务域的同步游标；从未同步时返回 null
  async getCursor(userId, domain) {
    if (!userId || !domain) {
      throw new Error("读取同步游标需要 userId 与 domain");
    }

    const record = await this.get([userId, domain]);
    return record?.cursor ?? null;
  }

  // 写入同步游标（覆盖式），并记录最近同步时间
  async setCursor(userId, domain, cursor) {
    if (!userId || !domain) {
      throw new Error("写入同步游标需要 userId 与 domain");
    }

    return this.put({
      user_id: userId,
      domain,
      cursor,
      updated_at: Date.now()
    });
  }

  // 清空指定用户全部游标（登出清理场景配合 hgClearUserData）
  async clearUserCursors(userId) {
    const records = await this.getAll();
    const doomed = records.filter((item) => item.user_id === userId);

    for (const record of doomed) {
      await this.delete([record.user_id, record.domain]);
    }
  }
}

export const hgSyncCursorRepository = new HGSyncCursorRepository();

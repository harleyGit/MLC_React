/**
 * 个人偏好 Hook
 * 职责：读取指定用户全部偏好并订阅变更；提供 setPreference 写入本地库。
 * 边界：偏好写入默认 Local First（sync_status = local），同步到服务端由偏好同步任务处理。
 */

import { useCallback, useEffect, useState } from "react";
import { hgPreferencesRepository } from "../modules/preferences/HGPreferencesRepository";
import { HG_STORES } from "../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../infrastructure/storage/HGLocalDataService";

export function useHGPreferences(userId) {
  const [preferences, setPreferences] = useState({});
  const [loading, setLoading] = useState(false);

  // 读取全部偏好为 { key: value } 字典
  const reload = useCallback(async () => {
    if (!userId) {
      setPreferences({});
      return;
    }

    setLoading(true);
    try {
      const dict = await hgPreferencesRepository.getPreferences(userId);
      setPreferences(dict);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    reload();

    // 本页或其它标签页修改偏好后自动重读，保证 UI 与本地库一致
    const unsubscribe = hgLocalDataService.subscribe(HG_STORES.PREFERENCES, reload);
    return unsubscribe;
  }, [reload]);

  // 写入偏好项；仓库内部会广播变更并触发本 Hook 的 reload
  const setPreference = useCallback(async (key, value) => {
    if (!userId) {
      throw new Error("写入偏好前必须绑定 userId");
    }

    await hgPreferencesRepository.setPreference(userId, key, value);
  }, [userId]);

  return { preferences, loading, setPreference, reload };
}

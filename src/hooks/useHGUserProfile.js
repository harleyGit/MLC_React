/**
 * 用户资料 Hook
 * 职责：从本地库读取指定用户资料并订阅变更；提供 refreshFromServer 触发后台刷新。
 * 边界：Hook 只负责本地读写与订阅，远端拉取函数由调用方注入，保持页面与网络层解耦。
 */

import { useCallback, useEffect, useState } from "react";
import { hgUserRepository } from "../modules/user/HGUserRepository";
import { HG_STORES } from "../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../infrastructure/storage/HGLocalDataService";

export function useHGUserProfile(userId, { fetchProfile } = {}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);

  // 从本地库读取资料；账号变化或收到变更通知时重新加载
  const reload = useCallback(async () => {
    if (!userId) {
      setProfile(null);
      return;
    }

    const record = await hgUserRepository.getProfile(userId);
    setProfile(record || null);
  }, [userId]);

  useEffect(() => {
    reload();

    // 订阅本地数据服务：本页写入、其他标签页广播均会触发重读
    const unsubscribe = hgLocalDataService.subscribe(HG_STORES.USERS, reload);
    return unsubscribe;
  }, [reload]);

  // 后台刷新：调用注入的远端接口，成功后写回本地库（Cache First 策略）
  const refreshFromServer = useCallback(async () => {
    if (!fetchProfile || !userId) {
      return;
    }

    setLoading(true);
    try {
      const remote = await fetchProfile(userId);
      if (remote) {
        await hgUserRepository.saveProfile(remote);
      }
    } finally {
      setLoading(false);
    }
  }, [fetchProfile, userId]);

  return { profile, loading, reload, refreshFromServer };
}

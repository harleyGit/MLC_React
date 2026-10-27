export const LOGIN_HISTORY_MAX_COUNT = 6;
export const LOGIN_HISTORY_STORAGE_KEY = "hg_recent_login_accounts";
export const LOGIN_HISTORY_STORAGE_VERSION = 1;

/**
 * 规范化登录历史，仅保留合法账号，并按最近登录时间倒序去重。
 * @param {*} history - 待规范化的历史数据。
 * @param {number} [maxCount=LOGIN_HISTORY_MAX_COUNT] - 最大保留数量。
 * @returns {Array<{userName: string, lastLoginAt: number}>} 规范化后的登录历史。
 */
export function normalizeLoginHistory(history, maxCount = LOGIN_HISTORY_MAX_COUNT) {
  if (!Array.isArray(history) || maxCount <= 0) {
    return [];
  }

  const recentAccountMap = new Map();

  history.forEach((item, index) => {
    const userName = typeof item?.userName === "string" ? item.userName.trim() : "";
    const lastLoginAt = Number(item?.lastLoginAt);
    if (!userName || !Number.isFinite(lastLoginAt)) {
      return;
    }

    const previous = recentAccountMap.get(userName);
    if (!previous || lastLoginAt > previous.lastLoginAt) {
      recentAccountMap.set(userName, { userName, lastLoginAt, sourceIndex: index });
    }
  });

  return [...recentAccountMap.values()]
    .sort((left, right) => {
      return right.lastLoginAt - left.lastLoginAt || left.sourceIndex - right.sourceIndex;
    })
    .slice(0, maxCount)
    .map(({ userName, lastLoginAt }) => ({ userName, lastLoginAt }));
}

/**
 * 把本次成功登录账号提升到历史首位，并保持最多六条记录。
 * @param {*} history - 现有登录历史。
 * @param {string} userName - 本次成功登录的账号。
 * @param {number} [lastLoginAt=Date.now()] - 本次成功登录时间。
 * @returns {Array<{userName: string, lastLoginAt: number}>} 更新后的登录历史。
 */
export function updateLoginHistory(history, userName, lastLoginAt = Date.now()) {
  const normalizedUserName = typeof userName === "string" ? userName.trim() : "";
  if (!normalizedUserName || !Number.isFinite(lastLoginAt)) {
    return normalizeLoginHistory(history);
  }

  return normalizeLoginHistory([
    { userName: normalizedUserName, lastLoginAt },
    ...(Array.isArray(history) ? history : []),
  ]);
}

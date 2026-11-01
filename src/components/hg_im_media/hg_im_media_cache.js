/** 仅当前会话缓存已鉴权媒体；403 在短时间内不重复自动读取，不把撤销状态当作可恢复的成功响应。 */
export class HGIMMediaCache {
  hgEntries = new Map(); // mediaId -> {blob, expires}；不写磁盘、不跨账号共享。
  hgDenied = new Map(); // mediaId -> 403 的过期时间；最多12条，离开会话即清空。
  hgBytes = 0; // 当前缓存的 Blob 字节总数，不包含正在显示或下载的额外临时内存。
  hgLimit = 320 * 1024 * 1024; // 允许保留一段 300MiB 视频；超过上限不缓存。

  hgGet(hgID) {
    const hgEntry = this.hgEntries.get(hgID); // 过期或撤销后必须重新向 Go 鉴权。
    if (!hgEntry) return null;
    if (hgEntry.expires <= Date.now()) { this.hgDelete(hgID); return null; }
    this.hgEntries.delete(hgID);
    this.hgEntries.set(hgID, hgEntry);
    return hgEntry.blob;
  }

  hgSet(hgID, hgBlob) {
    this.hgDelete(hgID);
    this.hgDenied.delete(hgID);
    if (hgBlob.size > this.hgLimit) return;
    this.hgEntries.set(hgID, { blob: hgBlob, expires: Date.now() + 5 * 60 * 1000 });
    this.hgBytes += hgBlob.size;
    while (this.hgBytes > this.hgLimit || this.hgEntries.size > 12) this.hgDelete(this.hgEntries.keys().next().value);
  }

  hgIsDenied(hgID) {
    const hgExpires = this.hgDenied.get(hgID); // 过期后允许用户重试，以便权限恢复后重新鉴权。
    if (!hgExpires) return false;
    if (hgExpires <= Date.now()) { this.hgDenied.delete(hgID); return false; }
    return true;
  }

  hgDeny(hgID) {
    this.hgDelete(hgID);
    this.hgDenied.delete(hgID);
    this.hgDenied.set(hgID, Date.now() + 60 * 1000); // 403 一分钟内不因虚拟列表反复挂载而重复请求。
    if (this.hgDenied.size > 12) this.hgDenied.delete(this.hgDenied.keys().next().value);
  }

  hgDelete(hgID) {
    const hgEntry = this.hgEntries.get(hgID); // 仅移除缓存；已打开的 Blob URL 由查看器卸载/撤销释放。
    if (hgEntry) this.hgBytes -= hgEntry.blob.size;
    this.hgEntries.delete(hgID);
  }

  hgClear() { this.hgEntries.clear(); this.hgDenied.clear(); this.hgBytes = 0; }
}

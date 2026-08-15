/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-08-14 21:28:46
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-08-15 19:10:10
 * @FilePath: /MLC_React/src/pages/bilibili/auth_info/hg_bili_author_space_page_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { getBiliAuthorHomepage, getBiliAuthorVideos } from "../hg_bili_api";

/** 作者空间 VM，统一后端字段与页面视频卡片字段。 */
class HGBiliAuthorSpacePageVM {
  static async getHomepage(userId) {
    const response = await getBiliAuthorHomepage(userId, 20);
    return {
      profile: this.normalizeProfile(response?.profile, userId),
      stats: this.normalizeStats(response?.stats),
      videos: this.normalizeVideoPage(response?.videos),
    };
  }

  static async getVideos(userId, cursor) {
    return this.normalizeVideoPage(
      await getBiliAuthorVideos(userId, cursor, 20)
    );
  }

  static normalizeProfile(profile, userId) {
    const id = String(profile?.userId || userId || "").trim();
    return {
      userId: id,
      name: profile?.displayName || profile?.userName || id,
      avatar: profile?.avatarUrl || "",
      signature: profile?.signature || "这个人很神秘，什么都没有写。",
      gender: Number(profile?.gender) || 0,
      createdAt: profile?.createdAt || "",
    };
  }

  static normalizeStats(stats) {
    return {
      followers: Number(stats?.followerCount) || 0,
      following: Number(stats?.followingCount) || 0,
      videos: Number(stats?.videoCount) || 0,
    };
  }

  static normalizeVideoPage(page) {
    const sourceVideos = Array.isArray(page?.videos)
      ? page.videos
      : Array.isArray(page?.list)
      ? page.list
      : [];
    return {
      pageSize: Number(page?.pageSize) || 20,
      hasMore: Boolean(page?.hasMore),
      nextCursor: page?.nextCursor || "",
      pageLoaded: Boolean(page),
      videos: sourceVideos.map((video) => ({
        id: video.videoId || video.submissionId,
        submissionId: video.submissionId || video.videoId,
        userId: video.userId,
        title: video.title || "未命名视频",
        cover: video.coverUrl || "",
        url: video.filePath || "",
        category: video.category || "",
        description: video.description || "",
        duration: Number(video.duration) || 0,
        publishTime:
          video.publishTime || video.submitTime || video.createdAt || "",
        play: Number(video.likeCount) || 0,
        likeCount: Number(video.likeCount) || 0,
        coinCount: Number(video.coinCount) || 0,
        favoriteCount: Number(video.favoriteCount) || 0,
        shareCount: Number(video.shareCount) || 0,
      })),
    };
  }

  static formatCount(value) {
    const count = Number(value) || 0;
    if (count >= 100000000) return `${(count / 100000000).toFixed(1)}亿`;
    if (count >= 10000) return `${(count / 10000).toFixed(1)}万`;
    return String(count);
  }

  static formatDate(value) {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
      2,
      "0"
    )}-${String(date.getDate()).padStart(2, "0")}`;
  }
}

export default HGBiliAuthorSpacePageVM;

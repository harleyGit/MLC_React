import HGNetManager from "../../api/hg_net_manager";

const HGNet = new HGNetManager();

/**
 * 获取视频列表（游标分页）
 * @param {string} cursor - 翻页游标，首次调用传空，后续使用响应中的 nextCursor
 * @param {number} pageSize - 每页数量，默认 20
 * @returns {Promise} 视频列表响应
 */
export const getVideoList = async (cursor = "", pageSize = 20) => {
  try {
    const response = await HGNet.get("/api/v1/video_upload/list", {
      cursor,
      pageSize,
    });
    return response;
  } catch (error) {
    console.error("获取视频列表失败:", error);
    throw error;
  }
};

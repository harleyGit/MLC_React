import HGNetManager from "../../api/hg_net_manager";

const HGNet = new HGNetManager();

/**
 * 获取视频列表（游标分页）
 * @param {string} cursor - 翻页游标，首次调用传空，后续使用响应中的 nextCursor
 * @param {number} pageSize - 每页数量，默认 20
 * @param {string} tagName - 视频标签名称；空字符串表示“推荐”无过滤列表
 * @returns {Promise} 视频列表响应
 */
export const getVideoList = async (cursor = "", pageSize = 20, tagName = "") => {
  try {
    const response = await HGNet.get("/api/v1/video_upload/list", {
      cursor,
      pageSize,
      tagName,
    });
    return response;
  } catch (error) {
    console.error("获取视频列表失败:", error);
    throw error;
  }
};

/**
 * 获取动画页启用标签。
 * activeOnly=true 只返回可展示标签；pageSize=100 与后端标签配置上限保持一致。
 * @returns {Promise<Object>} 已解包的标签列表响应。
 */
export const getDougaTags = async () => {
  try {
    return await HGNet.get("/api/v1/ops/bilibili/tags/list", {
      activeOnly: true,
      pageSize: 100,
    });
  } catch (error) {
    console.error("获取动画标签失败:", error);
    throw error;
  }
};

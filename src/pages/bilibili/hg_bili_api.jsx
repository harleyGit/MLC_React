import HGNetManager from "../../api/hg_net_manager";

const HGNet = new HGNetManager();

/**
 * 获取视频列表
 * @param {number} page - 页码，从 1 开始
 * @param {number} pageSize - 每页数量，默认 20
 * @returns {Promise} 视频列表响应
 */
export const getVideoList = async (page = 1, pageSize = 20) => {
  try {
    const response = await HGNet.get("/api/v1/video_upload/list", {
      page,
      pageSize,
    });
    return response;
  } catch (error) {
    console.error("获取视频列表失败:", error);
    throw error;
  }
};

export default class HGVideoUploadPageVM {
  /**
   * 创建投稿入口页初始状态。
   * @returns {{tips: string, dragging: boolean}} 投稿入口页面状态。
   */
  static createInitialState() {
    return {
      tips: "",
      dragging: false,
    };
  }

  /**
   * 校验用户选择的视频文件。
   * @param {File} file 待校验的视频文件。
   * @returns {{valid: boolean, message: string}} 校验结果和提示文案。
   */
  static validateVideoFile(file) {
    if (!file) {
      return {
        valid: false,
        message: "请选择需要投稿的视频文件。",
      };
    }

    if (!file.type.startsWith("video/")) {
      return {
        valid: false,
        message: "当前仅支持上传视频文件。",
      };
    }

    // 前端边界限制 4GB，避免误选超大文件导致浏览器页面卡顿。
    const maxVideoSize = 4 * 1024 * 1024 * 1024;
    if (file.size > maxVideoSize) {
      return {
        valid: false,
        message: "视频大小不能超过 4GB。",
      };
    }

    return {
      valid: true,
      message: "",
    };
  }

  /**
   * 生成唯一视频 ID。
   * @returns {string} 唯一标识。
   */
  static generateVideoId() {
    return `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  }

  /**
   * 创建单个视频数据对象。
   * @param {File} file 视频文件。
   * @returns {Object} 视频数据对象。
   */
  static createVideoData(file) {
    return {
      id: HGVideoUploadPageVM.generateVideoId(),
      file,
      name: file.name,
      size: file.size,
      progress: 0,
      status: "uploading",
      previewUrl: "",
    };
  }
}

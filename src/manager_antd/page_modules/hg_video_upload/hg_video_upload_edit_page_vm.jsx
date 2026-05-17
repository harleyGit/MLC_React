export default class HGVideoUploadEditPageVM {
  /**
   * 创建上传后稿件编辑页初始状态。
   * @param {Array} videos 路由 state 传入的视频列表。
   * @returns {Object} 页面初始状态。
   */
  static createInitialState(videos) {
    const videoList = videos || [];
    const activeVideoId = videoList.length > 0 ? videoList[0].id : "";
    const configs = {};
    videoList.forEach((v) => {
      configs[v.id] = HGVideoUploadEditPageVM.createDefaultConfig(v);
    });

    return {
      videos: videoList,
      activeVideoId,
      configs,
      scheduleEnabled: false,
      publishTime: "",
      allowSecondaryCreation: false,
      hasCommercial: false,
      commercialInfo: { type: "", name: "", form: "" },
      moreSettings: {
        watermark: false,
        visibility: "public",
        declaration: "",
        dolbyAudio: false,
        hiResAudio: false,
        disableDanmaku: false,
        disableComment: false,
        featuredComment: false,
      },
      tips: "",
    };
  }

  /**
   * 创建单个视频的默认配置。
   * @param {Object} video 视频数据对象。
   * @returns {Object} 视频默认配置。
   */
  static createDefaultConfig(video) {
    return {
      title: video?.name
        ? HGVideoUploadEditPageVM.getFileNameWithoutExt(video.name)
        : "",
      coverUrl: "",
      videoType: "自制",
      sourceUrl: "",
      category: "生活",
      tags: [],
      description: "",
    };
  }

  /**
   * 获取不含扩展名的文件名，用作稿件标题默认值。
   * @param {string} fileName 原始文件名。
   * @returns {string} 去掉最后一段扩展名后的文件名。
   */
  static getFileNameWithoutExt(fileName) {
    const dotIndex = fileName.lastIndexOf(".");
    if (dotIndex <= 0) {
      return fileName;
    }
    return fileName.slice(0, dotIndex);
  }

  /**
   * 格式化文件体积。
   * @param {number} size 文件字节数。
   * @returns {string} 可读文件体积文案。
   */
  static formatFileSize(size = 0) {
    if (size >= 1024 * 1024 * 1024) {
      return `${(size / 1024 / 1024 / 1024).toFixed(2)} GB`;
    }
    if (size >= 1024 * 1024) {
      return `${(size / 1024 / 1024).toFixed(2)} MB`;
    }
    if (size >= 1024) {
      return `${(size / 1024).toFixed(2)} KB`;
    }
    return `${size} B`;
  }

  /**
   * 校验单个视频的稿件配置。
   * @param {Object} config 稿件配置。
   * @returns {{valid: boolean, message: string}} 校验结果。
   */
  static validateVideoConfig(config) {
    if (!config.title || !config.title.trim()) {
      return { valid: false, message: "请填写稿件标题。" };
    }
    if (config.title.trim().length > 80) {
      return { valid: false, message: "稿件标题不能超过 80 个字符。" };
    }
    if (!config.category) {
      return { valid: false, message: "请选择稿件分区。" };
    }
    if (!config.tags || config.tags.length === 0) {
      return { valid: false, message: "请至少选择一个标签。" };
    }
    if (config.tags.length > 7) {
      return { valid: false, message: "标签最多选择 7 个。" };
    }
    if (config.videoType === "转载" && !config.sourceUrl?.trim()) {
      return { valid: false, message: "转载稿件请填写来源 URL。" };
    }
    return { valid: true, message: "" };
  }

  /**
   * 校验全部视频配置。
   * @param {Array} videos 视频列表。
   * @param {Object} configs 配置映射。
   * @returns {{valid: boolean, message: string}} 校验结果。
   */
  static validateAllConfigs(videos, configs) {
    for (let i = 0; i < videos.length; i++) {
      const video = videos[i];
      const config = configs[video.id];
      if (!config) continue;
      const result = HGVideoUploadEditPageVM.validateVideoConfig(config);
      if (!result.valid) {
        return {
          valid: false,
          message: `视频「${video.name}」：${result.message}`,
        };
      }
    }
    return { valid: true, message: "" };
  }
}

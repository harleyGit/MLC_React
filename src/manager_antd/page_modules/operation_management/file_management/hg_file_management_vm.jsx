/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/file_management/hg_file_management_vm.jsx
 * @Description: 文件管理页面 ViewModel，负责业务逻辑、数据处理和API调用
 */

/**
 * 业务场景选项配置
 * 用于下拉选择器展示
 */
export const SCENE_OPTIONS = [
  { value: "user_avatar", label: "用户头像" },
  { value: "product_image", label: "产品图片" },
  { value: "banner", label: "轮播图" },
  { value: "document", label: "文档资料" },
  { value: "video", label: "视频资源" },
  { value: "other", label: "其他" },
];

/**
 * 文件类型分类
 * 用于文件类型识别和展示
 */
export const FILE_TYPE_CATEGORY = {
  image: ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"],
  video: ["mp4", "avi", "mov", "wmv", "flv", "mkv"],
  document: ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt"],
};

/**
 * 文件上传限制配置
 * 约束：单文件最大 50MB，图片最大 10MB
 */
const UPLOAD_LIMITS = {
  image: { maxSize: 10 * 1024 * 1024, label: "图片" },
  video: { maxSize: 50 * 1024 * 1024, label: "视频" },
  document: { maxSize: 20 * 1024 * 1024, label: "文档" },
  other: { maxSize: 50 * 1024 * 1024, label: "文件" },
};

/**
 * 文件信息模拟数据源
 * 职责：在未接入真实 API 前，保存文件管理提交后形成的列表数据，供上传页与文件列表页共享
 */
let mockFileList = [
  {
    id: 1,
    scene: "user_avatar",
    file_key: "user_avatar_1716633600000_abc123.jpg",
    user_id: "1001",
    user_type: "admin",
    file_type: "image",
    file_size: 102400,
    file_name: "头像.jpg",
    file_url: "https://picsum.photos/400/300",
    upload_time: "2026-05-24 10:00:00",
    ip: "192.168.1.100",
  },
  {
    id: 2,
    scene: "product_image",
    file_key: "product_image_1716633700000_def456.png",
    user_id: "1002",
    user_type: "user",
    file_type: "image",
    file_size: 204800,
    file_name: "产品图.png",
    file_url: "https://picsum.photos/400/300?random=1",
    upload_time: "2026-05-24 11:00:00",
    ip: "192.168.1.101",
  },
  {
    id: 3,
    scene: "document",
    file_key: "document_1716633800000_ghi789.pdf",
    user_id: "1003",
    user_type: "admin",
    file_type: "document",
    file_size: 1048576,
    file_name: "需求文档.pdf",
    file_url: "",
    upload_time: "2026-05-24 12:00:00",
    ip: "192.168.1.102",
  },
  {
    id: 4,
    scene: "video",
    file_key: "video_1716633900000_jkl012.mp4",
    user_id: "1001",
    user_type: "admin",
    file_type: "video",
    file_size: 52428800,
    file_name: "产品演示.mp4",
    file_url: "",
    upload_time: "2026-05-25 09:00:00",
    ip: "192.168.1.100",
  },
  {
    id: 5,
    scene: "banner",
    file_key: "banner_1716634000000_mno345.jpg",
    user_id: "1004",
    user_type: "user",
    file_type: "image",
    file_size: 512000,
    file_name: "首页轮播图.jpg",
    file_url: "https://picsum.photos/800/400?random=2",
    upload_time: "2026-05-25 10:30:00",
    ip: "192.168.1.103",
  },
];

/**
 * 文件管理 ViewModel 类
 * 职责：管理文件数据、处理上传逻辑、提供表单校验规则
 */
export default class HGFileManagementVM {
  /**
   * 获取表单校验规则
   * @returns {Object} 表单校验规则对象
   */
  static getFormRules = () => ({
    scene: [{ required: true, message: "请选择业务场景" }],
    user_id: [{ required: true, message: "请输入上传人ID" }],
    user_type: [{ required: true, message: "请输入上传人类型" }],
  });

  /**
   * 根据文件扩展名获取文件类型分类
   * @param {string} fileName 文件名
   * @returns {string} 文件类型分类（image/video/document/other）
   */
  static getFileTypeCategory = (fileName) => {
    if (!fileName) return "other";
    const extension = fileName.split(".").pop().toLowerCase();
    for (const [category, extensions] of Object.entries(FILE_TYPE_CATEGORY)) {
      if (extensions.includes(extension)) {
        return category;
      }
    }
    return "other";
  };

  /**
   * 格式化文件大小
   * @param {number} bytes 文件大小（字节）
   * @returns {string} 格式化后的文件大小
   */
  static formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  /**
   * 校验单个文件大小与格式
   * @param {File} file 文件对象
   * @returns {{ valid: boolean, message: string }} 校验结果
   */
  static validateFile = (file) => {
    const category = HGFileManagementVM.getFileTypeCategory(file.name);
    const limit = UPLOAD_LIMITS[category];
    if (file.size > limit.maxSize) {
      return {
        valid: false,
        message: `${limit.label}文件「${file.name}」超过大小限制（最大 ${HGFileManagementVM.formatFileSize(limit.maxSize)}）`,
      };
    }
    return { valid: true, message: "" };
  };

  /**
   * 批量校验文件列表
   * @param {Array<File>} files 文件数组
   * @returns {{ valid: boolean, message: string }} 校验结果
   */
  static validateFiles = (files) => {
    for (const file of files) {
      const result = HGFileManagementVM.validateFile(file);
      if (!result.valid) return result;
    }
    return { valid: true, message: "" };
  };

  /**
   * 生成文件存储标识
   * @param {string} scene 业务场景
   * @param {string} fileName 文件名
   * @returns {string} 文件存储标识
   */
  static generateFileKey = (scene, fileName) => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const extension = fileName.split(".").pop();
    return `${scene}_${timestamp}_${random}.${extension}`;
  };

  /**
   * 转换上传数据为提交格式
   * @param {Object} values 表单值
   * @param {Array} fileList 文件列表
   * @returns {Array} 提交数据数组
   */
  static transformSubmitData = (values, fileList) => {
    return fileList.map((file) => ({
      scene: values.scene,
      file_key: HGFileManagementVM.generateFileKey(values.scene, file.name),
      user_id: values.user_id,
      user_type: values.user_type,
      file_type: HGFileManagementVM.getFileTypeCategory(file.name),
      file_size: file.size,
      file_name: file.name,
      file_url: URL.createObjectURL(file),
      upload_time: new Date().toISOString(),
      ip: "127.0.0.1",
    }));
  };

  /**
   * 对文件列表数据做前端分页、搜索、筛选
   * @param {Array} list 全量文件列表
   * @param {Object} params { keyword, scene, fileType, page, pageSize }
   * @returns {{ data: Array, total: number }}
   */
  static filterAndPaginate = (list, params = {}) => {
    let filtered = [...list];
    if (params.keyword) {
      const kw = params.keyword.toLowerCase();
      filtered = filtered.filter(
        (f) =>
          f.file_name.toLowerCase().includes(kw) ||
          f.file_key.toLowerCase().includes(kw) ||
          f.user_id.toLowerCase().includes(kw)
      );
    }
    if (params.scene) {
      filtered = filtered.filter((f) => f.scene === params.scene);
    }
    if (params.fileType) {
      filtered = filtered.filter((f) => f.file_type === params.fileType);
    }
    const total = filtered.length;
    const page = params.page || 1;
    const pageSize = params.pageSize || 10;
    const start = (page - 1) * pageSize;
    const data = filtered.slice(start, start + pageSize);
    return { data, total };
  };

  /**
   * 提交文件信息到后端
   * 约束：对接真实 API 时替换本方法实现
   * @param {Array} fileList 文件列表数据
   * @returns {Promise} 提交结果
   */
  static submitFileList = (fileList) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        const normalizedList = fileList.map((file, index) => ({
          ...file,
          id: Date.now() + index,
        }));
        mockFileList = [...normalizedList, ...mockFileList];
        resolve({ code: 0, message: "提交成功", data: normalizedList });
      }, 500);
    });
  };

  /**
   * 获取文件列表
   * 约束：对接真实 API 时替换本方法实现
   * @returns {Promise} 文件列表数据
   */
  static getFileList = () => {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 0,
          message: "获取成功",
          data: [...mockFileList],
        });
      }, 300);
    });
  };

  /**
   * 删除文件信息
   * 约束：对接真实 API 时替换本方法实现
   * @param {number} fileId 文件ID
   * @returns {Promise} 删除结果
   */
  static deleteFile = (fileId) => {
    return new Promise((resolve) => {
      setTimeout(() => {
        mockFileList = mockFileList.filter((file) => file.id !== fileId);
        resolve({ code: 0, message: "删除成功" });
      }, 300);
    });
  };
}

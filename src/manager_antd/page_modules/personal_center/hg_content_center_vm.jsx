/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25 02:00:33
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/hg_content_center_vm.jsx
 * @Description: 内容中心视图模型，处理内容中心相关的业务逻辑
 * 
 * 页面结构
┌─────────────┬───────────────────────────────┐
│   左侧菜单   │           右侧内容区           │
│  (HGMenuPage)│                               │
│             │  面包屑: 首页 > 内容中心 > 投稿  │
│  - 投稿功能  │  ┌─────────────────────────┐  │
│  - 课程管理  │  │                         │  │
│  - 课程提交  │  │       内容区域           │  │
│             │  │                         │  │
│             │  └─────────────────────────┘  │
 */

/**
 * 模拟投稿数据。
 */
const MOCK_UPLOADS = [
  { id: 1, name: "崩坏星穹铁道角色介绍.mp4", size: "128MB", status: "success", date: "2026-05-20" },
  { id: 2, name: "原神4.0版本前瞻.mp4", size: "256MB", status: "success", date: "2026-05-18" },
  { id: 3, name: "绝区零实机演示.mp4", size: "512MB", status: "pending", date: "2026-05-25" },
];

/**
 * 模拟课程数据。
 */
const MOCK_COURSES = [
  { id: 1, title: "React 入门到精通", cover: "", lessons: 24, students: 1280, status: "published" },
  { id: 2, title: "JavaScript 高级编程", cover: "", lessons: 18, students: 890, status: "published" },
  { id: 3, title: "CSS 动画实战", cover: "", lessons: 12, students: 456, status: "draft" },
];

/**
 * 菜单项 key 枚举。
 */
export const MENU_KEY = {
  UPLOAD: "upload",
  COURSE: "course",
  COURSE_LIST: "course_list",
  COURSE_SUBMIT: "course_submit",
  COURSE_DIRECTORY: "course_directory",
  COURSE_LESSON: "course_lesson",
};

/**
 * 菜单项标题映射。
 */
export const MENU_TITLE_MAP = {
  [MENU_KEY.UPLOAD]: "投稿功能",
  [MENU_KEY.COURSE]: "课程管理",
  [MENU_KEY.COURSE_LIST]: "课程列表",
  [MENU_KEY.COURSE_SUBMIT]: "课程提交",
  [MENU_KEY.COURSE_DIRECTORY]: "课程目录",
  [MENU_KEY.COURSE_LESSON]: "课时管理",
};

/**
 * 菜单层级配置（用于面包屑路径查找）。
 * 格式：{ childKey: parentKey }
 */
export const MENU_PARENT_MAP = {
  [MENU_KEY.UPLOAD]: null,
  [MENU_KEY.COURSE]: null,
  [MENU_KEY.COURSE_LIST]: MENU_KEY.COURSE,
  [MENU_KEY.COURSE_SUBMIT]: MENU_KEY.COURSE,
  [MENU_KEY.COURSE_DIRECTORY]: MENU_KEY.COURSE,
  [MENU_KEY.COURSE_LESSON]: MENU_KEY.COURSE,
};

/**
 * 内容中心视图模型类。
 * 职责：处理内容中心的数据获取和业务逻辑。
 */
class HGContentCenterVM {
  /**
   * 获取投稿列表。
   * @returns {Promise<Array>} 投稿列表数据。
   */
  static async fetchUploadList() {
    // 模拟 API 调用
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: MOCK_UPLOADS,
        });
      }, 500);
    });
  }

  /**
   * 获取课程列表。
   * @returns {Promise<Array>} 课程列表数据。
   */
  static async fetchCourseList() {
    // 模拟 API 调用
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          data: MOCK_COURSES,
        });
      }, 500);
    });
  }

  /**
   * 上传文件（模拟）。
   * @param {File} file 文件对象。
   * @returns {Promise<Object>} 上传结果。
   */
  static async uploadFile(file) {
    // 模拟上传
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          success: true,
          message: "上传成功",
          data: {
            id: Date.now(),
            name: file.name,
            size: `${(file.size / (1024 * 1024)).toFixed(1)}MB`,
            status: "pending",
            date: new Date().toISOString().split("T")[0],
          },
        });
      }, 1000);
    });
  }

  /**
   * 获取面包屑配置。
   * @param {string} activeMenu 当前菜单 key。
   * @returns {Array} 面包屑项数组。
   */
  static getBreadcrumbItems(activeMenu) {
    const items = [
      { label: "首页", href: "/home" },
      { label: "内容中心" },
    ];

    // 构建面包屑路径（从子菜单向上查找父菜单）
    const path = [];
    let currentKey = activeMenu;
    while (currentKey) {
      const title = MENU_TITLE_MAP[currentKey];
      if (title) {
        path.unshift({ label: title });
      }
      currentKey = MENU_PARENT_MAP[currentKey];
    }

    return [...items, ...path];
  }
}

export default HGContentCenterVM;

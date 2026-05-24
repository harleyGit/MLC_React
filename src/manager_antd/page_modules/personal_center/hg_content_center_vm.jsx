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
  COURSE_SUBMIT: "course_submit",
};

/**
 * 菜单项标题映射。
 */
export const MENU_TITLE_MAP = {
  [MENU_KEY.UPLOAD]: "投稿功能",
  [MENU_KEY.COURSE]: "课程管理",
  [MENU_KEY.COURSE_SUBMIT]: "课程提交",
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

    const menuTitle = MENU_TITLE_MAP[activeMenu];
    if (menuTitle) {
      items.push({ label: menuTitle });
    }

    return items;
  }
}

export default HGContentCenterVM;

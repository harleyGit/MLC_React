/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/course_lesson/hg_course_lesson_vm.jsx
 * @Description: 课时管理视图模型，处理课时相关的业务逻辑
 */

/**
 * 模拟课程数据。
 */
const MOCK_COURSES = [
  { id: 1, name: "React 入门到精通" },
  { id: 2, name: "JavaScript 高级编程" },
  { id: 3, name: "CSS 动画实战" },
  { id: 4, name: "Vue3 从零到一" },
  { id: 5, name: "Node.js 后端开发" },
];

/**
 * 模拟目录数据。
 */
const MOCK_CATALOGS = [
  { id: 1, name: "基础入门", course_id: 1 },
  { id: 2, name: "环境搭建", course_id: 1 },
  { id: 3, name: "JSX 语法", course_id: 1 },
  { id: 4, name: "组件基础", course_id: 1 },
  { id: 5, name: "进阶提升", course_id: 1 },
  { id: 6, name: "Hooks 详解", course_id: 1 },
  { id: 7, name: "变量与类型", course_id: 2 },
  { id: 8, name: "函数式编程", course_id: 2 },
  { id: 9, name: "选择器", course_id: 3 },
  { id: 10, name: "过渡动画", course_id: 3 },
];

/**
 * 模拟课时数据。
 */
const MOCK_LESSONS = [
  { id: 1, goods_id: 1, catalog_id: 1, name: "React 简介", enable_trial: true, status: true, video_key: "video_001", sort: 1 },
  { id: 2, goods_id: 1, catalog_id: 2, name: "安装 Node.js", enable_trial: true, status: true, video_key: "video_002", sort: 1 },
  { id: 3, goods_id: 1, catalog_id: 2, name: "创建第一个项目", enable_trial: false, status: true, video_key: "video_003", sort: 2 },
  { id: 4, goods_id: 1, catalog_id: 3, name: "JSX 基础语法", enable_trial: false, status: true, video_key: "video_004", sort: 1 },
  { id: 5, goods_id: 1, catalog_id: 3, name: "JSX 表达式", enable_trial: false, status: false, video_key: "video_005", sort: 2 },
];

/**
 * 课时表单初始值。
 */
export const INITIAL_FORM_DATA = {
  goods_id: "",
  catalog_id: "",
  name: "",
  enable_trial: false,
  status: true,
  video_key: "",
  detail: "",
  homework: "",
  sort: 0,
};

/**
 * 课时管理视图模型类。
 * 职责：处理课时的增删改查、表单验证等业务逻辑。
 */
class HGCourseLessonVM {
  /**
   * 获取课程列表。
   * @returns {Promise<Array>} 课程列表。
   */
  static async fetchCourses() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: MOCK_COURSES });
      }, 300);
    });
  }

  /**
   * 获取目录列表（根据课程 ID 筛选）。
   * @param {number} courseId 课程 ID。
   * @returns {Promise<Array>} 目录列表。
   */
  static async fetchCatalogs(courseId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const catalogs = courseId
          ? MOCK_CATALOGS.filter((c) => c.course_id === courseId)
          : MOCK_CATALOGS;
        resolve({ success: true, data: catalogs });
      }, 300);
    });
  }

  /**
   * 获取课时列表。
   * @returns {Promise<Array>} 课时列表。
   */
  static async fetchLessonList() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: MOCK_LESSONS });
      }, 500);
    });
  }

  /**
   * 验证表单数据。
   * @param {Object} formData 表单数据。
   * @returns {Object} 验证结果 { valid: boolean, errors: Object }。
   */
  static validateForm(formData) {
    const errors = {};

    if (!formData.goods_id) {
      errors.goods_id = "请选择所属课程";
    }

    if (!formData.catalog_id) {
      errors.catalog_id = "请选择所属目录";
    }

    if (!formData.name || formData.name.trim() === "") {
      errors.name = "请输入课时名称";
    }

    if (!formData.video_key) {
      errors.video_key = "请上传视频文件";
    }

    if (formData.sort === undefined || formData.sort === null || formData.sort < 0) {
      errors.sort = "请输入有效的排序值";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 提交课时数据。
   * @param {Object} formData 表单数据。
   * @returns {Promise<Object>} 提交结果。
   */
  static async submitLesson(formData) {
    const validation = this.validateForm(formData);
    if (!validation.valid) {
      throw { type: "validation", errors: validation.errors };
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("提交课时数据:", formData);
        resolve({
          success: true,
          message: "课时创建成功",
          data: { id: Date.now(), ...formData },
        });
      }, 1000);
    });
  }

  /**
   * 上传视频（模拟）。
   * @param {File} file 视频文件。
   * @returns {Promise<Object>} 上传结果。
   */
  static async uploadVideo(file) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const key = `video_${Date.now()}_${file.name}`;
        resolve({
          success: true,
          key,
          url: URL.createObjectURL(file),
        });
      }, 1500);
    });
  }

  /**
   * 删除课时。
   * @param {number} id 课时 ID。
   * @returns {Promise<Object>} 删除结果。
   */
  static async deleteLesson(id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("删除课时:", id);
        resolve({ success: true, message: "课时删除成功" });
      }, 500);
    });
  }
}

export default HGCourseLessonVM;

/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/course_directory/hg_course_directory_vm.jsx
 * @Description: 课程目录管理视图模型，处理目录相关的业务逻辑
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
 * 模拟目录树数据。
 */
const MOCK_DIRECTORY_TREE = [
  {
    id: 1,
    parent_id: 0,
    level: 1,
    name: "基础入门",
    good_id: 1,
    sort: 1,
    children: [
      {
        id: 2,
        parent_id: 1,
        level: 2,
        name: "环境搭建",
        good_id: 1,
        sort: 1,
        children: [
          { id: 5, parent_id: 2, level: 3, name: "Node.js 安装", good_id: 1, sort: 1 },
          { id: 6, parent_id: 2, level: 3, name: "创建项目", good_id: 1, sort: 2 },
        ],
      },
      { id: 3, parent_id: 1, level: 2, name: "JSX 语法", good_id: 1, sort: 2 },
      { id: 4, parent_id: 1, level: 2, name: "组件基础", good_id: 1, sort: 3 },
    ],
  },
  {
    id: 7,
    parent_id: 0,
    level: 1,
    name: "进阶提升",
    good_id: 1,
    sort: 2,
    children: [
      { id: 8, parent_id: 7, level: 2, name: "Hooks 详解", good_id: 1, sort: 1 },
      { id: 9, parent_id: 7, level: 2, name: "状态管理", good_id: 1, sort: 2 },
    ],
  },
];

/**
 * 目录表单初始值。
 */
export const INITIAL_FORM_DATA = {
  parent_id: 0,
  level: 1,
  name: "",
  good_id: "",
  sort: 0,
};

/**
 * 课程目录管理视图模型类。
 * 职责：处理目录的增删改查、表单验证等业务逻辑。
 */
class HGCourseDirectoryVM {
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
   * 获取目录树数据。
   * @returns {Promise<Array>} 目录树。
   */
  static async fetchDirectoryTree() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: MOCK_DIRECTORY_TREE });
      }, 500);
    });
  }

  /**
   * 获取目录列表（扁平结构）。
   * @returns {Promise<Array>} 目录列表。
   */
  static async fetchDirectoryList() {
    return new Promise((resolve) => {
      setTimeout(() => {
        const flatList = this.flattenTree(MOCK_DIRECTORY_TREE);
        resolve({ success: true, data: flatList });
      }, 500);
    });
  }

  /**
   * 将树形结构扁平化。
   * @param {Array} tree 树形数据。
   * @param {number} depth 当前深度。
   * @returns {Array} 扁平化后的数组。
   */
  static flattenTree(tree, depth = 0) {
    const result = [];
    for (const node of tree) {
      result.push({ ...node, depth });
      if (node.children && node.children.length > 0) {
        result.push(...this.flattenTree(node.children, depth + 1));
      }
    }
    return result;
  }

  /**
   * 验证表单数据。
   * @param {Object} formData 表单数据。
   * @returns {Object} 验证结果 { valid: boolean, errors: Object }。
   */
  static validateForm(formData) {
    const errors = {};

    if (!formData.name || formData.name.trim() === "") {
      errors.name = "请输入目录名称";
    }

    if (!formData.good_id) {
      errors.good_id = "请选择所属课程";
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
   * 提交目录数据。
   * @param {Object} formData 表单数据。
   * @returns {Promise<Object>} 提交结果。
   */
  static async submitDirectory(formData) {
    const validation = this.validateForm(formData);
    if (!validation.valid) {
      throw { type: "validation", errors: validation.errors };
    }

    // 计算层级
    const level = formData.parent_id === 0 ? 1 : (formData.level || 1);

    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("提交目录数据:", { ...formData, level });
        resolve({
          success: true,
          message: "目录创建成功",
          data: { id: Date.now(), ...formData, level },
        });
      }, 1000);
    });
  }

  /**
   * 删除目录。
   * @param {number} id 目录 ID。
   * @returns {Promise<Object>} 删除结果。
   */
  static async deleteDirectory(id) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("删除目录:", id);
        resolve({ success: true, message: "目录删除成功" });
      }, 500);
    });
  }

  /**
   * 获取父级目录选项（用于树形选择器）。
   * @param {Array} tree 目录树。
   * @param {number} excludeId 排除的 ID（编辑时排除自身）。
   * @returns {Array} 父级目录选项。
   */
  static getParentOptions(tree, excludeId = null) {
    const options = [{ id: 0, name: "顶级目录", level: 0 }];
    const collect = (nodes, depth = 0) => {
      for (const node of nodes) {
        if (node.id !== excludeId) {
          options.push({ id: node.id, name: node.name, level: depth });
        }
        if (node.children && node.children.length > 0) {
          collect(node.children, depth + 1);
        }
      }
    };
    collect(tree);
    return options;
  }
}

export default HGCourseDirectoryVM;

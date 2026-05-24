/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/personal_center/course_management/hg_course_management_vm.jsx
 * @Description: 课程管理视图模型，处理课程提交相关的业务逻辑
 */

/**
 * 售卖类型枚举。
 */
export const SALE_TYPE = {
  /** 单独售卖 */
  SINGLE: 1,
  /** 会员专享 */
  VIP: 2,
  /** 免费 */
  FREE: 3,
};

/**
 * 售卖类型选项列表。
 */
export const SALE_TYPE_OPTIONS = [
  { label: "单独售卖", value: SALE_TYPE.SINGLE },
  { label: "会员专享", value: SALE_TYPE.VIP },
  { label: "免费", value: SALE_TYPE.FREE },
];

/**
 * 服务时长类型枚举。
 */
export const SERVICE_TIME_TYPE = {
  /** 永久有效 */
  PERMANENT: 0,
  /** 7天 */
  SEVEN_DAYS: 7,
  /** 30天 */
  THIRTY_DAYS: 30,
  /** 365天 */
  ONE_YEAR: 365,
};

/**
 * 服务时长类型选项列表。
 */
export const SERVICE_TIME_OPTIONS = [
  { label: "永久有效", value: SERVICE_TIME_TYPE.PERMANENT },
  { label: "7天", value: SERVICE_TIME_TYPE.SEVEN_DAYS },
  { label: "30天", value: SERVICE_TIME_TYPE.THIRTY_DAYS },
  { label: "365天", value: SERVICE_TIME_TYPE.ONE_YEAR },
];

/**
 * 课程表单初始值。
 */
export const INITIAL_FORM_DATA = {
  name: "",
  cover_key: "",
  intro_key: "",
  desc: "",
  goods_price: 0,
  service_time: SERVICE_TIME_TYPE.PERMANENT,
  sale_type: SALE_TYPE.SINGLE,
  status: true,
};

/**
 * 课程管理视图模型类。
 * 职责：处理课程提交、表单验证等业务逻辑。
 */
class HGCourseManagementVM {
  /**
   * 验证表单数据。
   * @param {Object} formData 表单数据。
   * @returns {Object} 验证结果 { valid: boolean, errors: Object }。
   */
  static validateForm(formData) {
    const errors = {};

    if (!formData.name || formData.name.trim() === "") {
      errors.name = "请输入课程名称";
    }

    if (!formData.cover_key) {
      errors.cover_key = "请上传封面图";
    }

    if (!formData.intro_key) {
      errors.intro_key = "请上传介绍图";
    }

    if (formData.goods_price === undefined || formData.goods_price === null || formData.goods_price < 0) {
      errors.goods_price = "请输入有效的课程价格";
    }

    if (formData.service_time === undefined || formData.service_time === null) {
      errors.service_time = "请选择服务时长";
    }

    if (formData.sale_type === undefined || formData.sale_type === null) {
      errors.sale_type = "请选择售卖类型";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 提交课程数据。
   * @param {Object} formData 表单数据。
   * @returns {Promise<Object>} 提交结果。
   */
  static async submitCourse(formData) {
    const validation = this.validateForm(formData);
    if (!validation.valid) {
      throw { type: "validation", errors: validation.errors };
    }

    // 模拟 API 调用
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("提交课程数据:", formData);
        resolve({
          success: true,
          message: "课程提交成功",
          data: { id: Date.now(), ...formData },
        });
      }, 1500);
    });
  }

  /**
   * 上传图片（模拟）。
   * @param {File} file 图片文件。
   * @returns {Promise<Object>} 上传结果，包含资源键。
   */
  static async uploadImage(file) {
    // 模拟上传
    return new Promise((resolve) => {
      setTimeout(() => {
        const key = `img_${Date.now()}_${file.name}`;
        resolve({
          success: true,
          key,
          url: URL.createObjectURL(file),
        });
      }, 1000);
    });
  }
}

export default HGCourseManagementVM;

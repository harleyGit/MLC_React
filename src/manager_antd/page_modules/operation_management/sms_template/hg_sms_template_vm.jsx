/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-25
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/sms_template/hg_sms_template_vm.jsx
 * @Description: 短信模板管理视图模型，处理短信模板相关的业务逻辑
 */

/**
 * 短信服务商枚举。
 */
export const SMS_PLATFORM = {
  ALIYUN: "aliyun",
  TENCENT: "tencent",
  HUAWEI: "huawei",
};

/**
 * 短信服务商配置。
 */
export const SMS_PLATFORM_CONFIG = {
  [SMS_PLATFORM.ALIYUN]: { label: "阿里云" },
  [SMS_PLATFORM.TENCENT]: { label: "腾讯云" },
  [SMS_PLATFORM.HUAWEI]: { label: "华为云" },
};

/**
 * 模拟短信模板数据。
 */
const MOCK_TEMPLATES = [
  {
    id: 1,
    scene_code: "LOGIN_VERIFY",
    sign_name: "MLC平台",
    platform_tmpl_id: "SMS_001",
    tmpl_str: "【MLC平台】您的验证码是{code}，5分钟内有效，请勿泄露。",
    status: true,
    platform: SMS_PLATFORM.ALIYUN,
    created_at: "2026-05-01 10:00:00",
    updated_at: "2026-05-01 10:00:00",
  },
  {
    id: 2,
    scene_code: "ORDER_NOTIFY",
    sign_name: "MLC教育",
    platform_tmpl_id: "SMS_002",
    tmpl_str: "【MLC教育】您的订单{order_no}已支付成功，金额{amount}元。",
    status: true,
    platform: SMS_PLATFORM.ALIYUN,
    created_at: "2026-05-02 14:30:00",
    updated_at: "2026-05-02 14:30:00",
  },
  {
    id: 3,
    scene_code: "COURSE_REMIND",
    sign_name: "MLC平台",
    platform_tmpl_id: "SMS_003",
    tmpl_str: "【MLC平台】您报名的课程{course_name}即将开课，请准时参加。",
    status: false,
    platform: SMS_PLATFORM.TENCENT,
    created_at: "2026-05-03 09:15:00",
    updated_at: "2026-05-03 09:15:00",
  },
  {
    id: 4,
    scene_code: "REFUND_NOTIFY",
    sign_name: "MLC教育",
    platform_tmpl_id: "SMS_004",
    tmpl_str: "【MLC教育】您的退款申请已通过，退款金额{amount}元将原路返回。",
    status: true,
    platform: SMS_PLATFORM.HUAWEI,
    created_at: "2026-05-04 16:45:00",
    updated_at: "2026-05-04 16:45:00",
  },
];

/**
 * 短信模板表单初始值。
 */
export const INITIAL_FORM_DATA = {
  scene_code: "",
  sign_name: "",
  platform_tmpl_id: "",
  tmpl_str: "",
  status: true,
  platform: SMS_PLATFORM.ALIYUN,
};

/**
 * 短信模板管理视图模型类。
 * 职责：处理短信模板的增删改查、表单验证等业务逻辑。
 */
class HGSmsTemplateVM {
  /**
   * 获取短信模板列表。
   * @returns {Promise<Array>} 模板列表。
   */
  static async fetchTemplateList() {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ success: true, data: MOCK_TEMPLATES });
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

    if (!formData.scene_code || formData.scene_code.trim() === "") {
      errors.scene_code = "请输入业务场景编码";
    }

    if (!formData.sign_name || formData.sign_name.trim() === "") {
      errors.sign_name = "请输入短信签名";
    }

    if (!formData.platform_tmpl_id || formData.platform_tmpl_id.trim() === "") {
      errors.platform_tmpl_id = "请输入平台模板ID";
    }

    if (!formData.tmpl_str || formData.tmpl_str.trim() === "") {
      errors.tmpl_str = "请输入短信文案内容";
    }

    if (!formData.platform) {
      errors.platform = "请选择短信服务商";
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * 提交短信模板。
   * @param {Object} formData 表单数据。
   * @param {number|null} templateId 模板ID（编辑时传入）。
   * @returns {Promise<Object>} 提交结果。
   */
  static async submitTemplate(formData, templateId = null) {
    const validation = this.validateForm(formData);
    if (!validation.valid) {
      throw { type: "validation", errors: validation.errors };
    }

    return new Promise((resolve) => {
      setTimeout(() => {
        const action = templateId ? "更新" : "创建";
        console.log(`${action}短信模板:`, formData);
        resolve({
          success: true,
          message: `短信模板${action}成功`,
          data: { id: templateId || Date.now(), ...formData },
        });
      }, 1000);
    });
  }

  /**
   * 删除短信模板。
   * @param {number} templateId 模板 ID。
   * @returns {Promise<Object>} 删除结果。
   */
  static async deleteTemplate(templateId) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("删除短信模板:", templateId);
        resolve({ success: true, message: "短信模板删除成功" });
      }, 500);
    });
  }

  /**
   * 切换模板状态。
   * @param {number} templateId 模板 ID。
   * @param {boolean} status 新状态。
   * @returns {Promise<Object>} 操作结果。
   */
  static async toggleStatus(templateId, status) {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log("切换模板状态:", templateId, status);
        resolve({
          success: true,
          message: status ? "模板已启用" : "模板已禁用",
        });
      }, 300);
    });
  }

  /**
   * 格式化日期。
   * @param {string} dateStr 日期字符串。
   * @returns {string} 格式化后的日期。
   */
  static formatDate(dateStr) {
    if (!dateStr) return "-";
    return dateStr.substring(0, 16);
  }
}

export default HGSmsTemplateVM;

import HGNet from "../../../../manager_antd/net_handle/hg_net_manager_vm";
import { HGMANAGER_API } from "../../../api/hg_api_constants";

const SECURITY_ITEM_MAP = {
  qq: {
    title: "绑定QQ号",
    detailTitle: "设置QQ号",
    valueLabel: "QQ号",
    placeholder: "请输入QQ号",
    desc: "绑定后可使用 QQ 快速登录。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
  password: {
    title: "设定密码",
    detailTitle: "设置登录密码",
    valueLabel: "新密码",
    placeholder: "请输入新密码",
    desc: "用于账号登录与高风险操作验证。",
    boundText: "已设置",
    unboundText: "未设置",
  },
  phone: {
    title: "绑定手机",
    detailTitle: "设置手机号",
    valueLabel: "手机号",
    placeholder: "请输入手机号",
    desc: "用于登录保护与找回账号。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
  email: {
    title: "绑定邮箱",
    detailTitle: "设置邮箱",
    valueLabel: "邮箱",
    placeholder: "请输入邮箱地址",
    desc: "用于接收安全通知和找回密码。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
  wechat: {
    title: "绑定微信号",
    detailTitle: "设置微信号",
    valueLabel: "微信号",
    placeholder: "请输入微信号",
    desc: "绑定后可使用微信扫码登录。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
};

// 手机号格式约束：仅做前端基础格式阻断，最终以后端校验为准。
const PHONE_PATTERN = /^1[3-9]\d{9}$/;

// 邮箱格式约束：基础邮箱格式校验，避免明显错误请求。
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// QQ 号格式约束：5-12 位且不能以 0 开头。
const QQ_PATTERN = /^[1-9]\d{4,11}$/;

// 微信号格式约束：6-20 位，以字母开头，可包含数字、下划线和减号。
const WECHAT_PATTERN = /^[A-Za-z][-_A-Za-z0-9]{5,19}$/;

// 后端账号安全接口字段映射，必须与 HGUpdateUserSecurityReqDTO 的 JSON 字段保持一致。
const SECURITY_REQUEST_FIELD_MAP = {
  qq: "qq",
  phone: "phone",
  email: "email",
  wechat: "wechat",
};

/**
 * 账号安全页 VM：集中处理安全项展示映射、输入校验和接口封装。
 */
export default class HGAccountSecurityPageVM {
  /**
   * 创建账号安全模块初始状态。
   * @param {Object} userProfile 当前用户资料快照。
   * @returns {{userProfile: Object, securityItems: Array, activeSecurityKey: string, securityForm: Object, codeLoading: boolean, saving: boolean, countdown: number, tips: string}}
   * 约束：状态只服务账号安全子模块，不反向修改父页面其他状态。
   */
  static createInitialState(userProfile = {}) {
    return {
      userProfile,
      securityItems:
        HGAccountSecurityPageVM.buildSecurityItemsFromProfile(userProfile),
      activeSecurityKey: "",
      securityForm: HGAccountSecurityPageVM.createSecurityForm(),
      codeLoading: false,
      saving: false,
      countdown: 0,
      tips: "",
    };
  }

  /**
   * 创建安全项详情表单初始值。
   * @param {string} [itemKey] 当前安全项 key。
   * @param {Object} [userProfile] 当前用户资料快照。
   * @returns {{targetValue: string, oldPassword: string, passwordValue: string, confirmPassword: string, verificationCode: string, currentValueText: string}}
   * 约束：详情页每次进入都重置输入态，避免旧验证码和旧密码残留。
   */
  static createSecurityForm(itemKey = "", userProfile = {}) {
    return {
      targetValue: "",
      oldPassword: "",
      passwordValue: "",
      confirmPassword: "",
      verificationCode: "",
      currentValueText: HGAccountSecurityPageVM.maskSecurityValue(
        itemKey,
        HGAccountSecurityPageVM.getBoundSecurityValue(userProfile, itemKey)
      ),
    };
  }

  /**
   * 获取安全项展示元信息。
   * @param {string} itemKey 安全项 key。
   * @returns {Object} 安全项元信息；未知 key 返回空对象。
   */
  static getSecurityMeta(itemKey) {
    return SECURITY_ITEM_MAP[itemKey] ?? {};
  }

  /**
   * 生成账号安全列表展示数据。
   * @param {Array<{key: string, bound: boolean}>} securityItems 安全项绑定状态。
   * @param {Object} userProfile 当前用户资料快照。
   * @returns {Array<{key: string, bound: boolean, title: string, desc: string, statusText: string, actionText: string}>} 列表渲染数据。
   */
  static buildSecurityViewItems(securityItems, userProfile = {}) {
    return (securityItems ?? []).map((item) => {
      const securityMeta = SECURITY_ITEM_MAP[item.key];
      const currentValue = HGAccountSecurityPageVM.getBoundSecurityValue(
        userProfile,
        item.key
      );
      return {
        ...item,
        title: securityMeta?.title ?? item.key,
        desc: currentValue
          ? `${
              securityMeta?.desc ?? ""
            } 当前：${HGAccountSecurityPageVM.maskSecurityValue(
              item.key,
              currentValue
            )}`
          : securityMeta?.desc ?? "",
        statusText: item.bound
          ? securityMeta?.boundText ?? "已完成"
          : securityMeta?.unboundText ?? "未完成",
        actionText: item.bound
          ? "修改"
          : item.key === "password"
          ? "去设置"
          : "立即绑定",
      };
    });
  }

  /**
   * 根据用户资料生成安全项绑定状态。
   * @param {Object} userProfile 当前用户资料快照。
   * @returns {Array<{key: string, bound: boolean}>} 安全项绑定状态列表。
   * 约束：兼容后端可能返回的驼峰与下划线字段，避免展示误判。
   */
  static buildSecurityItemsFromProfile(userProfile = {}) {
    return Object.keys(SECURITY_ITEM_MAP).map((securityKey) => {
      return {
        key: securityKey,
        bound: HGAccountSecurityPageVM.isSecurityItemBound(
          userProfile,
          securityKey
        ),
      };
    });
  }

  /**
   * 创建指定安全项设置成功后的绑定状态。
   * @param {Array<{key: string, bound: boolean}>} securityItems 当前安全项列表。
   * @param {string} targetKey 需要标记成功的安全项 key。
   * @returns {Array<{key: string, bound: boolean}>} 更新目标项后的新数组。
   */
  static buildNextSecurityItems(securityItems, targetKey) {
    return (securityItems ?? []).map((item) => {
      if (item.key !== targetKey) {
        return item;
      }
      return {
        ...item,
        bound: true,
      };
    });
  }

  /**
   * 判断安全项是否需要验证码。
   * @param {string} itemKey 安全项 key。
   * @returns {boolean} 手机和邮箱返回 true，其余安全项直接设置。
   */
  static shouldUseVerificationCode(itemKey) {
    return itemKey === "phone" || itemKey === "email";
  }

  /**
   * 获取用户资料中的安全项原始值。
   * @param {Object} userProfile 当前用户资料快照。
   * @param {string} itemKey 安全项 key。
   * @returns {string} 已绑定的原始值，不存在时返回空字符串。
   */
  static getBoundSecurityValue(userProfile = {}, itemKey) {
    const valueMap = {
      qq:
        userProfile.qq ??
        userProfile.qq_no ??
        userProfile.qqNumber ??
        userProfile.qq_number,
      phone: userProfile.phone,
      email: userProfile.email,
      wechat:
        userProfile.wechat ??
        userProfile.wechat_id ??
        userProfile.wechatNo ??
        userProfile.wechat_no,
    };
    return valueMap[itemKey] ?? "";
  }

  /**
   * 判断指定安全项是否已绑定。
   * @param {Object} userProfile 当前用户资料快照。
   * @param {string} itemKey 安全项 key。
   * @returns {boolean} 当前安全项绑定状态。
   */
  static isSecurityItemBound(userProfile = {}, itemKey) {
    if (itemKey === "password") {
      return Boolean(
        userProfile.hasPassword ??
          userProfile.has_password ??
          userProfile.passwordHash ??
          userProfile.password_hash
      );
    }
    return Boolean(
      HGAccountSecurityPageVM.getBoundSecurityValue(userProfile, itemKey)
    );
  }

  /**
   * 隐私脱敏安全项当前值。
   * @param {string} itemKey 安全项 key。
   * @param {string} rawValue 原始值。
   * @returns {string} 脱敏后的展示文本。
   */
  static maskSecurityValue(itemKey, rawValue) {
    const valueText = `${rawValue ?? ""}`;
    if (!valueText) {
      return "";
    }
    if (itemKey === "phone") {
      return valueText.replace(/^(\d{3})\d{4}(\d{4})$/, "$1****$2");
    }
    if (itemKey === "email") {
      const [nameText, domainText] = valueText.split("@");
      if (!nameText || !domainText) {
        return valueText;
      }
      return `${nameText.slice(0, 2)}***@${domainText}`;
    }
    if (valueText.length <= 4) {
      return `${valueText.slice(0, 1)}***`;
    }
    return `${valueText.slice(0, 2)}***${valueText.slice(-2)}`;
  }

  /**
   * 校验安全项目标输入。
   * @param {string} itemKey 安全项 key。
   * @param {Object} securityForm 安全项详情表单。
   * @returns {{valid: boolean, message: string}} 校验结果。
   */
  static validateSecurityTarget(itemKey, securityForm) {
    const targetValue = `${securityForm.targetValue ?? ""}`.trim();
    if (itemKey === "phone" && !PHONE_PATTERN.test(targetValue)) {
      return { valid: false, message: "请输入正确的手机号。" };
    }
    if (itemKey === "email" && !EMAIL_PATTERN.test(targetValue)) {
      return { valid: false, message: "请输入正确的邮箱地址。" };
    }
    if (itemKey === "qq" && !QQ_PATTERN.test(targetValue)) {
      return { valid: false, message: "请输入正确的QQ号。" };
    }
    if (itemKey === "wechat" && !WECHAT_PATTERN.test(targetValue)) {
      return { valid: false, message: "微信号需为6-20位，且以字母开头。" };
    }
    return { valid: true, message: "" };
  }

  /**
   * 校验账号安全提交表单。
   * @param {string} itemKey 安全项 key。
   * @param {Object} securityForm 安全项详情表单。
   * @param {boolean} itemBound 当前安全项是否已绑定。
   * @returns {{valid: boolean, message: string}} 校验结果。
   */
  static validateSecuritySubmit(itemKey, securityForm, itemBound) {
    if (itemKey === "password") {
      if (itemBound && !securityForm.oldPassword) {
        return { valid: false, message: "请输入当前密码。" };
      }
      if (
        !securityForm.passwordValue ||
        securityForm.passwordValue.length < 6
      ) {
        return { valid: false, message: "新密码至少需要6位。" };
      }
      if (securityForm.passwordValue !== securityForm.confirmPassword) {
        return { valid: false, message: "两次输入的新密码不一致。" };
      }
      return { valid: true, message: "" };
    }

    const targetCheckResult = HGAccountSecurityPageVM.validateSecurityTarget(
      itemKey,
      securityForm
    );
    if (!targetCheckResult.valid) {
      return targetCheckResult;
    }

    if (
      HGAccountSecurityPageVM.shouldUseVerificationCode(itemKey) &&
      !/^\d{6}$/.test(securityForm.verificationCode)
    ) {
      return { valid: false, message: "请输入6位数字验证码。" };
    }

    return { valid: true, message: "" };
  }

  /**
   * 请求账号安全验证码接口。
   * @param {Object} params 请求参数。
   * @param {string} params.itemKey 安全项 key。
   * @param {string} params.targetValue 手机号或邮箱。
   * @returns {Promise<Object>} 接口响应结果。
   */
  static requestSecurityVerifyCode({ itemKey, targetValue }) {
    if (itemKey === "phone") {
      return HGNet.sendCode({ phone: targetValue });
    }
    return HGNet.post(HGMANAGER_API.SECURITY_CODE_API_PATH, {
      security_type: itemKey,
      target: targetValue,
    });
  }

  /**
   * 调用账号安全信息接口。
   * @returns {Promise<Object>} 当前用户账号安全信息。
   * 约束：只用 GET 读取数据，不在 VM 中改写组件状态。
   */
  static getAccountSecurity() {
    return HGNet.get(HGMANAGER_API.SECURITY_ACCOUNT_API_PATH);
  }

  /**
   * 调用账号安全设置接口。
   * @param {Object} params 提交参数。
   * @param {string} params.itemKey 安全项 key。
   * @param {Object} params.securityForm 安全项详情表单。
   * @returns {Promise<Object>} 接口响应结果。
   */
  static updateAccountSecurity({ itemKey, securityForm }) {
    const requestBody = {};

    if (itemKey === "password") {
      requestBody.password = securityForm.passwordValue;
      return HGNet.put(HGMANAGER_API.SECURITY_UPDATE_API_PATH, requestBody);
    }

    const requestField = SECURITY_REQUEST_FIELD_MAP[itemKey];
    if (requestField) {
      requestBody[requestField] = `${securityForm.targetValue ?? ""}`.trim();
    }

    return HGNet.put(HGMANAGER_API.SECURITY_UPDATE_API_PATH, requestBody);
  }

  /**
   * 根据安全项设置结果同步用户资料。
   * @param {Object} userProfile 当前用户资料快照。
   * @param {string} itemKey 安全项 key。
   * @param {Object} securityForm 安全项详情表单。
   * @returns {Object} 更新后的用户资料快照。
   */
  static buildNextUserProfile(userProfile = {}, itemKey, securityForm = {}) {
    if (itemKey === "password") {
      return {
        ...userProfile,
        hasPassword: true,
        has_password: true,
      };
    }

    const targetValue = `${securityForm.targetValue ?? ""}`.trim();
    const fieldMap = {
      qq: "qq",
      phone: "phone",
      email: "email",
      wechat: "wechat",
    };
    return {
      ...userProfile,
      [fieldMap[itemKey]]: targetValue,
    };
  }

  /**
   * 生成安全项提交成功提示。
   * @param {string} targetKey 安全项 key。
   * @returns {string} 成功提示文案。
   */
  static buildSecuritySuccessTip(targetKey) {
    const actionItem = SECURITY_ITEM_MAP[targetKey];
    return actionItem
      ? `${actionItem.detailTitle}成功。`
      : "账号安全设置成功。";
  }
}

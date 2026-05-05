import { LogOut } from "../../../../logger/hg_logger";
import HGNet from "../../../../manager_antd/net_handle/hg_net_manager_vm";

export const MENU_KEYS = {
  INFO: "info",
  AVATAR: "avatar",
  SECURITY: "security",
};

export const MENU_LIST = [
  {
    key: MENU_KEYS.INFO,
    label: "我的信息",
  },
  {
    key: MENU_KEYS.AVATAR,
    label: "我的头像",
  },
  {
    key: MENU_KEYS.SECURITY,
    label: "账号安全",
  },
];

const SECURITY_ITEM_MAP = {
  qq: {
    title: "绑定QQ号",
    desc: "绑定后可使用 QQ 快速登录。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
  password: {
    title: "设定密码",
    desc: "用于账号登录与高风险操作验证。",
    boundText: "已设置",
    unboundText: "未设置",
  },
  phone: {
    title: "绑定手机",
    desc: "用于登录保护与找回账号。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
  email: {
    title: "绑定邮箱",
    desc: "用于接收安全通知和找回密码。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
  wechat: {
    title: "绑定微信号",
    desc: "绑定后可使用微信扫码登录。",
    boundText: "已绑定",
    unboundText: "未绑定",
  },
};

/**
 * 编辑用户信息页的 VM 工具类，约束：仅处理本地状态和展示映射，不直接请求后端。
 */
export default class HGEditUserPageVM {
  /**
   * 调用后端获取当前登录用户信息接口。
   * @returns {Promise<Object>} 返回用户信息
   * @throws {Error} 请求失败时抛出错误
   */
  static getUserProfile = () => {
    return HGNet.getUserProfile()
      .then((response) => {
        LogOut("获取用户信息响应：", response);
        return response;
      })
      .catch((error) => {
        console.error("获取用户信息失败:", error);
        throw error;
      });
  };

  /**
   * 调用后端更新用户资料接口。
   * @param {Object} profileData - 需要更新的资料字段
   * @param {string} [profileData.nickname] - 昵称
   * @param {string} [profileData.signature] - 签名
   * @param {number} [profileData.gender] - 性别 (0: 保密, 1: 男, 2: 女)
   * @param {string} [profileData.birth_month] - 出生日期 (YYYY-MM-DD)
   * @param {string} [profileData.avatar_url] - 头像URL
   * @returns {Promise<Object>} 返回更新后的用户资料
   * @throws {Error} 请求失败时抛出错误
   */
  static updateUserProfile = ({ nickname, signature, gender, birth_month, avatar_url }) => {
    return HGNet.updateUserProfile({
      nickname,
      signature,
      gender,
      birth_month,
      avatar_url,
    })
      .then((response) => {
        LogOut("更新用户资料响应：", response);
        return response;
      })
      .catch((error) => {
        console.error("更新用户资料失败:", error);
        throw error;
      });
  };

/**
 * 上传头像文件（二进制流方式）。
 * @param {File} file - 头像文件对象
 * @returns {Promise<Object>} 返回上传结果，包含 avatarUrl 和 isNew
 * @throws {Error} 请求失败时抛出错误
 */
static uploadAvatar = (file) => {
  if (!file) {
    return Promise.reject(new Error("请选择头像文件"));
  }

  if (!file.type.startsWith("image/")) {
    return Promise.reject(new Error("请选择图片文件"));
  }

  // 限制文件大小 10MB
  const MAX_SIZE = 10 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return Promise.reject(new Error("图片大小不能超过 10MB"));
  }

  // 从文件名或 MIME 类型推断扩展名
  const ext = file.name.split(".").pop().toLowerCase() || "png";

  // 读取文件为二进制数据
  return file.arrayBuffer().then((buffer) => {
    const imageData = new Uint8Array(buffer);
    return HGNet.uploadAvatar(imageData, ext)
      .then((response) => {
        LogOut("上传头像响应：", response);
        return response;
      })
      .catch((error) => {
        console.error("上传头像失败:", error);
        throw error;
      });
  });
};

  /**
   * 将前端性别文案转换为后端 gender 数值。
   * @param {string} genderText - 前端显示的性别文案 ("保密"/"男"/"女")
   * @returns {number} 后端对应的 gender 数值 (0: 保密, 1: 男, 2: 女)
   */
  static genderTextToValue(genderText) {
    const genderMap = {
      "保密": 0,
      "男": 1,
      "女": 2,
    };
    return genderMap[genderText] ?? 0;
  }

  /**
   * 将后端 gender 数值转换为前端性别文案。
   * @param {number} genderValue - 后端 gender 数值 (0: 保密, 1: 男, 2: 女)
   * @returns {string} 前端显示的性别文案 ("保密"/"男"/"女")
   */
  static genderValueToText(genderValue) {
    const genderMap = {
      0: "保密",
      1: "男",
      2: "女",
    };
    return genderMap[genderValue] ?? "保密";
  }

  /**
   * 创建页面初始状态。
   * @returns {{
   *   activeMenuKey: string,
   *   profileForm: {nickName: string, signature: string, gender: string, birthMonth: string},
   *   avatarPreviewUrl: string,
   *   securityItems: Array<{key: string, bound: boolean}>,
   *   operationTips: string
   * }} 页面可直接用于 class state 的初始对象。
   */
  static createInitialState() {
    return {
      activeMenuKey: MENU_KEYS.INFO,
      profileForm: {
        nickName: "",
        signature: "",
        gender: "保密",
        birthMonth: "",
      },
      avatarPreviewUrl: "",
      securityItems: [
        { key: "qq", bound: false },
        { key: "password", bound: false },
        { key: "phone", bound: true },
        { key: "email", bound: false },
        { key: "wechat", bound: false },
      ],
      operationTips: "",
    };
  }

  /**
   * 生成账号安全展示数据。
   * @param {Array<{key: string, bound: boolean}>} securityItems 安全项基础状态。
   * @returns {Array<{key: string, bound: boolean, title: string, desc: string, statusText: string, actionText: string}>}
   * 用于视图渲染的完整安全项数据。
   */
  static buildSecurityViewItems(securityItems) {
    return (securityItems ?? []).map((item) => {
      const securityMeta = SECURITY_ITEM_MAP[item.key];
      return {
        ...item,
        title: securityMeta?.title ?? item.key,
        desc: securityMeta?.desc ?? "",
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
   * 创建指定安全项的下一状态（绑定）。
   * @param {Array<{key: string, bound: boolean}>} securityItems 当前安全项列表。
   * @param {string} targetKey 需要变更的安全项 key。
   * @returns {Array<{key: string, bound: boolean}>} 只更新目标项 bound=true 的新数组。
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
   * 生成安全项操作提示文案。
   * @param {string} targetKey 安全项 key。
   * @returns {string} 对应提示文案；key 无效时返回空字符串。
   */
  static buildSecurityActionTip(targetKey) {
    const actionItem = SECURITY_ITEM_MAP[targetKey];
    if (!actionItem) {
      return "";
    }
    return `${actionItem.title}操作已提交（示例页面，暂未对接后端接口）。`;
  }
}

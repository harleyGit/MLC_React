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

/**
 * 编辑用户信息页 VM：负责用户资料、头像接口和基础展示状态映射。
 */
export default class HGEditUserPageVM {
  /**
   * 调用后端获取当前登录用户信息接口。
   * @returns {Promise<Object>} 返回用户信息。
   * @throws {Error} 请求失败时抛出错误。
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
   * @param {Object} profileData 需要更新的资料字段。
   * @param {string} [profileData.nickname] 昵称。
   * @param {string} [profileData.signature] 签名。
   * @param {number} [profileData.gender] 性别，0 保密、1 男、2 女。
   * @param {string} [profileData.birth_month] 出生日期，格式 YYYY-MM-DD。
   * @param {string} [profileData.avatar_url] 头像 URL。
   * @returns {Promise<Object>} 返回更新后的用户资料。
   * @throws {Error} 请求失败时抛出错误。
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
   * @param {File} file 头像文件对象。
   * @returns {Promise<Object>} 返回上传结果，包含 avatarUrl 和 isNew。
   * @throws {Error} 文件无效或请求失败时抛出错误。
   */
  static uploadAvatar = (file) => {
    if (!file) {
      return Promise.reject(new Error("请选择头像文件"));
    }

    if (!file.type.startsWith("image/")) {
      return Promise.reject(new Error("请选择图片文件"));
    }

    // 头像大小边界：限制 10MB，避免前端读取和上传超大文件。
    const maxAvatarSize = 10 * 1024 * 1024;
    if (file.size > maxAvatarSize) {
      return Promise.reject(new Error("图片大小不能超过 10MB"));
    }

    // 文件扩展名用于后端识别图片格式；无扩展名时按 png 兜底。
    const ext = file.name.split(".").pop().toLowerCase() || "png";

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
   * 获取用户头像。
   * @returns {Promise<Object>} 返回头像信息，包含 avatarUrl。
   * @throws {Error} 请求失败时抛出错误。
   */
  static getAvatar = () => {
    return HGNet.getAvatar()
      .then((response) => {
        LogOut("获取头像响应：", response);
        return response;
      })
      .catch((error) => {
        console.error("获取头像失败:", error);
        throw error;
      });
  };

  /**
   * 将前端性别文案转换为后端 gender 数值。
   * @param {string} genderText 前端显示的性别文案。
   * @returns {number} 后端 gender 数值，0 保密、1 男、2 女。
   */
  static genderTextToValue(genderText) {
    const genderMap = {
      保密: 0,
      男: 1,
      女: 2,
    };
    return genderMap[genderText] ?? 0;
  }

  /**
   * 将后端 gender 数值转换为前端性别文案。
   * @param {number} genderValue 后端 gender 数值。
   * @returns {string} 前端性别文案。
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
   * @returns {{activeMenuKey: string, userProfile: Object, profileForm: Object, avatarPreviewUrl: string, operationTips: string}} 页面 class state 初始对象。
   */
  static createInitialState() {
    return {
      activeMenuKey: MENU_KEYS.INFO,
      userProfile: {},
      profileForm: {
        nickName: "",
        signature: "",
        gender: "保密",
        birthMonth: "",
      },
      avatarPreviewUrl: "",
      operationTips: "",
    };
  }
}

/*
 * @Description: 添加联系人 ViewModel：精确检索系统 ID / 自定义 ID，并按后端协议发起好友申请。
 * 约束：不缓存搜索结果、不在本地伪造好友关系；演示资料仅由页面在 debug 模式显式创建并标注，绝不写服务端。
 */
import HGNetManager from "../../api/hg_net_manager";
import HGImContactsVM from "./hg_im_contacts_vm";

const hgNet = new HGNetManager(); // 共享签名 / JWT 请求封装，超时与鉴权错误由请求链统一处理。
const hgBase = "/api/v1/im/contacts"; // 与 Go IM 联系人路由目录一致。

/** 输入方式：手机号 / 邮箱只用于显式演示，serverType 为空表示后端不提供真实检索。 */
export const HG_SEARCH_TYPES = Object.freeze([
  { key: "public_id", label: "系统 ID", icon: "card", serverType: "public_id" },
  { key: "username", label: "自定义 ID", icon: "user", serverType: "username" },
  { key: "phone", label: "手机号", icon: "mobile", serverType: null },
  { key: "email", label: "邮箱", icon: "mail", serverType: null },
]);

/** 演示资料仅用于 debug 预览 UI 流程，带 demo 标记且 userId 非真实账号，不参与任何写接口。 */
const hgDemoProfile = Object.freeze({
  userId: "demo-contact-0001",
  nickname: "林晓（演示资料）",
  publicId: "wxid_demo0001",
  username: "xiaolin_demo",
  region: "广东 深圳",
  signature: "慢慢来，比较快。",
  friendStatus: "none",
});

/** 添加联系人视图模型：静态方法只在页面主动触发时访问网络，不持有页面状态。 */
export default class HGAddContactVM {
  /** 按输入自动识别查找方式；手机号和邮箱仅识别用于提示，不向后端发起隐私身份搜索。 */
  static detectSearchType(keyword) {
    const value = String(keyword || "").trim();
    if (/^U\d{20}$/.test(value)) return "public_id";
    if (/^1[3-9]\d{9}$/.test(value)) return "phone";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
    return "username";
  }

  /** 返回输入对应的方式配置，供搜索框展示动态图标；未知输入回退自定义 ID。 */
  static getSearchConfig(keyword) {
    const key = HGAddContactVM.detectSearchType(keyword);
    return HG_SEARCH_TYPES.find((item) => item.key === key) || HG_SEARCH_TYPES[1];
  }

  /** 对齐后端公开 ID / 自定义 ID 格式；不把手机号、邮箱降级为账号搜索。 */
  static validateKeyword(keyword) {
    const value = String(keyword || "").trim();
    if (!value) return "请输入要查找的内容";
    if (value.length > 128) return "内容过长，最多 128 个字符";
    const type = HGAddContactVM.detectSearchType(value);
    if (type === "phone" || type === "email") return "暂不支持手机号或邮箱真实查找，请使用系统 ID 或自定义 ID";
    if (type === "username" && !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(value)) {
      return "请输入 U 开头的 21 位系统 ID，或 4–32 位、字母开头的自定义 ID";
    }
    return "";
  }

  /** 单输入框精确检索：仅向服务端提交其支持的公开 ID / 自定义 ID。 */
  static async searchContact(keyword) {
    const error = HGAddContactVM.validateKeyword(keyword);
    if (error) throw new Error(error);
    const config = HGAddContactVM.getSearchConfig(keyword);
    return hgNet.post(`${hgBase}/search`, { type: config.serverType, keyword: String(keyword || "").trim() });
  }

  /** 按后端请求体只提交目标用户与附言；备注/朋友权限仅是页面演示草稿，不冒充已保存。 */
  static async sendFriendRequest(targetUserId, message) {
    return hgNet.post(`${hgBase}/requests`, { targetUserId, message });
  }

  /** 归一化服务端资料：兼容下划线命名，缺失字段留空由页面展示「未设置」，不猜测用户隐私信息。 */
  static normalizeProfile(raw, keyword) {
    const profile = raw || {};
    const config = HGAddContactVM.getSearchConfig(keyword);
    return {
      userId: profile.userId || profile.user_id || "",
      nickname: profile.nickname || profile.name || "",
      publicId: profile.publicId || profile.public_id || "",
      username: profile.username || "",
      region: profile.region || "",
      signature: profile.signature || "",
      source: `通过${config.label}查找`,
      friendStatus: profile.friendStatus || profile.friend_status || "unknown",
      demo: false,
    };
  }

  /** 构造明确标注的演示资料；keyword 只用于回显，不冒充服务端返回的真实账号。 */
  static createDemoProfile(keyword) {
    const config = HGAddContactVM.getSearchConfig(keyword);
    return {
      ...hgDemoProfile,
      source: `通过${config.label}查找（演示）`,
      demo: true,
    };
  }

  /** 复用通讯录模块的稳定头像色板与展示名规则，避免出现两套不一致的头像逻辑。 */
  static getAvatarColor(seed) { return HGImContactsVM.getAvatarColor(seed); }
  static getAvatarText(profile) { return HGImContactsVM.getAvatarText(profile); }
  static getDisplayName(profile) { return HGImContactsVM.getDisplayName(profile); }
}

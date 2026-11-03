/*
 * @Description: 添加联系人 ViewModel：按系统 ID、用户 ID、手机号、邮箱或自定义 ID 精确检索，并发起好友申请。
 * 约束：只显示服务端真实返回的公开资料，不缓存搜索结果、不在本地伪造好友关系。
 */
import HGNetManager from "../../api/hg_net_manager";
import HGImContactsVM from "./hg_im_contacts_vm";

const hgNet = new HGNetManager(); // 共享签名 / JWT 请求封装，超时与鉴权错误由请求链统一处理。
const hgBase = "/api/v1/im/contacts"; // 与 Go IM 联系人路由目录一致。

/** 搜索类型与 Go /contacts/search 的 type 一一对应；保留 username 兼容旧页面。 */
export const HG_SEARCH_TYPES = Object.freeze([
  { key: "public_id", label: "系统 ID", icon: "card", serverType: "public_id" },
  { key: "targetUserId", label: "用户 ID", icon: "user", serverType: "targetUserId" },
  { key: "username", label: "自定义 ID", icon: "user", serverType: "username" },
  { key: "phone", label: "手机号", icon: "mobile", serverType: "phone" },
  { key: "email", label: "邮箱", icon: "mail", serverType: "email" },
]);

/** 添加联系人视图模型：静态方法只在页面主动触发时访问网络，不持有页面状态。 */
export default class HGAddContactVM {
  /** 自动识别完整公开 ID、JWT 用户 ID、手机号、邮箱，其余按自定义 ID 精确搜索。 */
  static detectSearchType(keyword) {
    const value = String(keyword || "").trim();
    if (/^U\d{20}$/.test(value)) return "public_id";
    if (/^(HGUSR_|hgid_)/.test(value)) return "targetUserId";
    if (/^1[3-9]\d{9}$/.test(value)) return "phone";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
    return "username";
  }

  /** 返回输入对应的方式配置，供搜索框展示动态图标；未知输入回退自定义 ID。 */
  static getSearchConfig(keyword) {
    const key = HGAddContactVM.detectSearchType(keyword);
    return HG_SEARCH_TYPES.find((item) => item.key === key) || HG_SEARCH_TYPES[2];
  }

  /** 对齐后端类型校验，不把格式可疑的手机号或邮箱降级为自定义 ID。 */
  static validateKeyword(keyword) {
    const value = String(keyword || "").trim();
    if (!value) return "请输入要查找的内容";
    const type = HGAddContactVM.detectSearchType(value);
    if (value.length > (type === "email" ? 254 : 128)) return "查找内容过长";
    if (type === "targetUserId" && /\s/.test(value)) return "用户 ID 不能包含空白字符";
    if (type === "username" && (/^1\d{10}$/.test(value) || value.includes("@"))) {
      return "请输入完整的手机号或邮箱";
    }
    if (type === "username" && !/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(value)) {
      return "请输入系统 ID、用户 ID、手机号、邮箱或 4–32 位自定义 ID";
    }
    return "";
  }

  /** 单输入框精确检索；手机号/邮箱只用作请求参数，不保存在本地资料中。 */
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
    };
  }

  /** 复用通讯录模块的稳定头像色板与展示名规则，避免出现两套不一致的头像逻辑。 */
  static getAvatarColor(seed) { return HGImContactsVM.getAvatarColor(seed); }
  static getAvatarText(profile) { return HGImContactsVM.getAvatarText(profile); }
  static getDisplayName(profile) { return HGImContactsVM.getDisplayName(profile); }
}

/*
 * @Description: 添加联系人 ViewModel：单输入框自动识别账号 / 手机号 / 邮箱并精确检索、发起好友申请。
 * 约束：不缓存搜索结果、不在本地伪造好友关系；演示资料仅由页面在 debug 模式显式创建并标注，绝不写服务端。
 */
import HGNetManager from "../../api/hg_net_manager";
import HGImContactsVM from "./hg_im_contacts_vm";

const hgNet = new HGNetManager(); // 共享签名 / JWT 请求封装，超时与鉴权错误由请求链统一处理。
const hgBase = "/api/v1/im/contacts"; // 与 Go IM 联系人路由目录一致。

/** 支持的查找方式：icon 为 HGIconPage 的 type，serverType 为后端 /search 的 type；页面只做图标提示，不提供切换按钮。 */
export const HG_SEARCH_TYPES = Object.freeze([
  { key: "account", label: "账号", icon: "user", serverType: "username" },
  { key: "phone", label: "手机号", icon: "mobile", serverType: "phone" },
  { key: "email", label: "邮箱", icon: "mail", serverType: "email" },
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
  /** 按输入内容自动识别查找方式：完整手机号、合法邮箱走对应通道，其余按账号精确查找。 */
  static detectSearchType(keyword) {
    const value = String(keyword || "").trim();
    if (/^1[3-9]\d{9}$/.test(value)) return "phone";
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "email";
    return "account";
  }

  /** 返回输入对应的方式配置，供搜索框展示动态图标；未知输入回退账号。 */
  static getSearchConfig(keyword) {
    const key = HGAddContactVM.detectSearchType(keyword);
    return HG_SEARCH_TYPES.find((item) => item.key === key) || HG_SEARCH_TYPES[0];
  }

  /** 输入校验：自动识别下不再按方式分别校验格式，只约束非空与长度。 */
  static validateKeyword(keyword) {
    const value = String(keyword || "").trim();
    if (!value) return "请输入要查找的内容";
    if (value.length > 128) return "内容过长，最多 128 个字符";
    return "";
  }

  /** 单输入框精确检索：由 detectSearchType 决定后端 type，前端不做枚举或模糊匹配。 */
  static async searchContact(keyword) {
    const config = HGAddContactVM.getSearchConfig(keyword);
    return hgNet.post(`${hgBase}/search`, { type: config.serverType, keyword: String(keyword || "").trim() });
  }

  /** 发送好友申请：message 为验证附言；remark / permission 随申请提交，后端按已实现字段解析，不伪装为已保存。 */
  static async sendFriendRequest(targetUserId, payload) {
    return hgNet.post(`${hgBase}/requests`, { targetUserId, ...payload });
  }

  /** 归一化服务端资料：兼容下划线命名，缺失字段留空由页面展示「未设置」，不猜测用户隐私信息。 */
  static normalizeProfile(raw, keyword) {
    const profile = raw || {};
    const config = HGAddContactVM.getSearchConfig(keyword);
    return {
      userId: profile.userId || profile.user_id || profile.publicId || profile.public_id || "",
      nickname: profile.nickname || profile.name || "",
      publicId: profile.publicId || profile.public_id || "",
      username: profile.username || "",
      region: profile.region || "",
      signature: profile.signature || "",
      source: `通过${config.label}查找`,
      friendStatus: profile.friendStatus || profile.friend_status || "none",
      demo: false,
    };
  }

  /** 构造明确标注的演示资料；keyword 只用于回显，不冒充服务端返回的真实账号。 */
  static createDemoProfile(keyword) {
    const config = HGAddContactVM.getSearchConfig(keyword);
    return {
      ...hgDemoProfile,
      username: String(keyword || "").trim() || hgDemoProfile.username,
      source: `通过${config.label}查找（演示）`,
      demo: true,
    };
  }

  /** 复用通讯录模块的稳定头像色板与展示名规则，避免出现两套不一致的头像逻辑。 */
  static getAvatarColor(seed) { return HGImContactsVM.getAvatarColor(seed); }
  static getAvatarText(profile) { return HGImContactsVM.getAvatarText(profile); }
  static getDisplayName(profile) { return HGImContactsVM.getDisplayName(profile); }
}

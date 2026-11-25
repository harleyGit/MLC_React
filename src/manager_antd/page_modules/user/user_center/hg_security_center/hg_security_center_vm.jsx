/*
 * @Description: 安全中心 ViewModel，封装本人 TOTP 和恢复邮箱请求。
 */
import HGNet from "../../../../net_handle/hg_net_manager_vm";
import { HGMANAGER_API } from "../../../../api/hg_api_constants";

/**
 * 安全中心 ViewModel。
 * 职责：转发 MFA 绑定与激活请求；页面不直接拼接接口地址。
 * 约束：绑定密钥只在 enroll 响应中出现一次，本层不做任何持久化。
 */
export default class HGSecurityCenterVM {
  /** /mfa/enroll 已启用因子的专用业务码；普通 IAM 状态冲突仍为 100009。 */
  static hgMfaAlreadyEnabledCode = 404008;
  /** 首次绑定需要当前登录密码；密钥只在该响应中返回一次。 */
  static enrollMFA = (password, options) => HGNet.post(HGMANAGER_API.OWN_MFA_ENROLL, { password }, options);
  /** 激活 TOTP 因子，并消费首次验证码。 */
  static confirmMFA = (code, options) => HGNet.post(HGMANAGER_API.OWN_MFA_CONFIRM, { code }, options);
  /** 权威状态仅返回邮箱掩码和恢复生效时间。 */
  static recoveryStatus = (options) => HGNet.get(HGMANAGER_API.OWN_MFA_RECOVERY, {}, { ...options, headers: { "Cache-Control": "no-store" } });
  /** 发送至新邮箱；邮件码不会返回给浏览器。 */
  static sendBindCode = (email, options) => HGNet.post(HGMANAGER_API.OWN_MFA_RECOVERY_SEND_BIND, { email }, { ...options, timeout: 10_000 });
  /** 邮件码与当前 TOTP 同时通过后才标记邮箱已验证。 */
  static bindRecovery = (email, emailCode, mfaCode, options) => HGNet.post(HGMANAGER_API.OWN_MFA_RECOVERY_BIND, { email, emailCode, mfaCode }, options);
  /** 只发给服务端已绑定邮箱，调用方不得指定收件人。 */
  static sendResetCode = (options) => HGNet.post(HGMANAGER_API.OWN_MFA_RECOVERY_SEND_RESET, {}, { ...options, timeout: 10_000 });
  /** 登录密码加邮箱码重置因子；成功后必须结束当前登录态。 */
  static resetMFA = (password, emailCode, options) => HGNet.post(HGMANAGER_API.OWN_MFA_RECOVERY_RESET, { password, emailCode }, { ...options, timeout: 8_000 });
}

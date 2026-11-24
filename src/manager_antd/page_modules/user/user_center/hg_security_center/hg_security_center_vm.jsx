/*
 * @Description: 安全中心 ViewModel，封装管理员 TOTP MFA 绑定与激活请求。
 */
import { HGMANAGER_API } from "../../../../api/hg_api_constants";
import HGNet from "../../../../net_handle/hg_net_manager_vm";

/**
 * 安全中心 ViewModel。
 * 职责：转发 MFA 绑定与激活请求；页面不直接拼接接口地址。
 * 约束：绑定密钥只在 enroll 响应中出现一次，本层不做任何持久化。
 */
export default class HGSecurityCenterVM {
  /** 首次绑定需要当前登录密码；密钥只在该响应中返回一次。 */
  static enrollMFA = (password) => HGNet.post(HGMANAGER_API.IAM_MFA_ENROLL, { password });
  /** 激活 TOTP 因子，并消费首次验证码。 */
  static confirmMFA = (code) => HGNet.post(HGMANAGER_API.IAM_MFA_CONFIRM, { code });
}

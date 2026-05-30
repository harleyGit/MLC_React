/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:20:25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-10 11:38:53
 * @FilePath: /MLC_React/src/manager_antd/api/hg_api_constants.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE

 * antd 图标：https://ant.design/components/icon?spm=5176.28103460.0.0.51986308ocBoJk
*/
export const HGMANAGER_API = {
  // 验证码接口：邮箱等非手机号安全项使用当前资料安全接口。
  SECURITY_CODE_API_PATH: "/api/v1/profile/security/send_code",
  // 安全项更新接口：提交 QQ、密码、手机、邮箱、微信号设置。
  SECURITY_UPDATE_API_PATH: "/api/v1/profile/security",
  // 账号安全信息接口：进入账号安全页时读取 user_security 当前字段。
  SECURITY_ACCOUNT_API_PATH: "/api/v1/profile/account",
  LOGIN: "/api/v1/auth/login", // 登录
  REGISTER_NEW_USER: "/api/v1/auth/register", // 注册新用户
  SEND_CODE: "/api/v1/auth/send_code", // 验证码
  SEND_EMAIL_CODE: "/api/v1/auth/send_email_code", // 邮箱验证码
  REGISTER_WITH_EMAIL: "/api/v1/auth/register_with_email", // 邮箱注册
  REFRESH_TOKEN: "/api/v1/auth/refresh", // 刷新 Token
  SEND_RESET_PASSWORD_CODE: "/api/v1/auth/send_reset_code", // 发送忘记密码验证码
  RESET_PASSWORD: "/api/v1/auth/reset_password", // 重置密码
  UserList: "/api/v1/profile/list", // 用户列表（对齐 Go UserMiddlewareGroup 的 /list 路由）
  PROFILE: "/api/v1/profile/info", // 获取用户信息
  PROFILE_UPDATE: "/api/v1/profile/update", // 更新用户资料
  AVATAR_UPLOAD: "/api/v1/profile/avatar", // 上传头像
  VIDEO_UPLOAD_FILE: "/api/v1/video_upload/upload", // 上传视频文件
  VIDEO_UPLOAD_DRAFT: "/api/v1/video_upload/draft", // 保存视频稿件草稿
  VIDEO_UPLOAD_SUBMIT: "/api/v1/video_upload/submit", // 提交视频稿件审核
};

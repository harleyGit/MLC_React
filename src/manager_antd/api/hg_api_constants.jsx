/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:20:25
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-05-03 21:35:41
 * @FilePath: /MLC_React/src/manager_antd/api/hg_api_constants.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE

 * antd 图标：https://ant.design/components/icon?spm=5176.28103460.0.0.51986308ocBoJk
*/
export const HGMANAGER_API = {
  LOGIN: "/api/v1/auth/login", // 登录
  REGISTER_NEW_USER: "/api/v1/auth/register", // 注册新用户
  SEND_CODE: "/api/v1/auth/send_code", // 验证码
  REFRESH_TOKEN: "/api/v1/auth/refresh", // 刷新 Token
  UserList: "/api/v1/profile/list", // 用户列表（对齐 Go UserMiddlewareGroup 的 /list 路由）
  PROFILE: "/api/v1/profile/info", // 获取用户信息
  PROFILE_UPDATE: "/api/v1/profile/update", // 更新用户资料
  AVATAR_UPLOAD: "/api/v1/profile/avatar", // 上传头像
};

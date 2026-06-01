/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:39:47
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-18 11:00:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/login_module/hg_login_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LogOut } from "../../../logger/hg_logger";
import { REFRESH_TOKEN_KEY, TOKEN_KEY } from "../../auth/hg_auth";
import HGNet from "../../net_handle/hg_net_manager_vm";

// 📌 注册方式枚举（推荐用对象形式，避免魔法字符串）
export const HGRegisterType = {
  PHONE: "phone",
  EMAIL: "email",
  WECHAT: "wechat",
};

// 可选：反向映射或标签
export const HGRegisterTypeLabel = {
  [HGRegisterType.PHONE]: "手机号",
  [HGRegisterType.EMAIL]: "邮箱",
  [HGRegisterType.WECHAT]: "微信",
};

export default class HGLoginVM {
  /* 注册：
    curl -X POST http://localhost:8080/api/v1/auth/register \
        -H "Content-Type: application/json" \
        -d '{"account":"13800000000","code":"564877"}'
*/
  static requestRegisterUser = ({ userName, phone, code, password }) => {
    return HGNet.registerNewUser({
      userName,
      phone,
      code,
      password,
    })
      .then((res) => {
        LogOut("注册响应：", res);
        return res;
      })
      .catch((err) => {
        throw err;
      });
  };

  /* 邮箱注册：
    curl -X POST http://localhost:8080/api/v1/auth/register_with_email \
        -H "Content-Type: application/json" \
        -d '{"userName":"test","email":"test@example.com","code":"123456","password":"123456"}'
  */
  static requestRegisterUserWithEmail = ({ userName, email, code, password }) => {
    return HGNet.registerNewUserWithEmail({
      userName,
      email,
      code,
      password,
    })
      .then((res) => {
        LogOut("邮箱注册响应：", res);
        return res;
      })
      .catch((err) => {
        throw err;
      });
  };

  /*发送手机验证码
    curl -X GET "http://localhost:8080/api/v1/auth/send_code?phone=13800000000&verifyToken=xxx"

    verifyToken 是点选验证码验证通过后返回的一次性凭证：
    1. 前端先调用 /click_captcha 获取图片和字符。
    2. 用户按顺序点击完成后调用 /verify_click_captcha。
    3. 后端返回 verifyToken。
    4. 这里把 verifyToken 继续透传给 send_code，后端校验通过后才真正发送短信验证码。
  */
  static requestSendVerifyCode = ({ phone, verifyToken }) => {
    return HGNet.sendCode({ phone, verifyToken }).then((res) => {
      LogOut(res);
      return res?.verifyCode;
    });
  };

  /*发送邮箱验证码
    curl -X GET "http://localhost:8080/api/v1/auth/send_email_code?email=test@example.com&verifyToken=xxx"

    邮箱验证码和手机验证码共用同一套点选验证码前置校验。
    这里不消费 verifyToken，只负责透传；真正的一次性消费在 Go 后端 ValidateVerifyToken 中完成。
  */
  static requestSendEmailVerifyCode = ({ email, verifyToken }) => {
    return HGNet.sendEmailCode({ email, verifyToken }).then((res) => {
      LogOut(res);
      return res?.verifyCode;
    });
  };

  /* 登录
  curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"phone":"13800000000","password":"123456"}'
  */
  static requestLogin = ({ phone, password }) => {
    return HGNet.postUserLogin({ phone, password })
      .then((response) => {
        LogOut("登录 res：", response);
        // 兼容 access token / refresh token 的常见字段命名，避免后续请求 401 直接退出。
        const accessToken =
          response?.token ?? response?.accessToken ?? response?.access_token;
        const refreshToken =
          response?.refreshToken ?? response?.refresh_token;

        if (accessToken) {
          localStorage.setItem(TOKEN_KEY, accessToken);
        }
        if (refreshToken) {
          localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
        }
        // request() 已经返回后端 result，这里直接返回 response。
        return response;
      })
      .catch((error) => {
        console.error("登录请求失败:", error);
        throw error;
      });
  };
}

/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:39:47
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-18 11:00:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/login_module/hg_login_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LogOut } from "../../../logger/hg_logger";
import { TOKEN_KEY } from "../../auth/hg_auth";
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

  /*发送验证码
    curl -X GET "http://localhost:8080/api/v1/auth/send_code?phone=13800000000"
  */
  static requestSendVerifyCode = ({ phone }) => {
    return HGNet.sendCode({ phone }).then((res) => {
      LogOut(res);
      return res?.code;
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
          localStorage.setItem("refresh_token", refreshToken);
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

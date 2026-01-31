import { LogOut } from "../../logger/hg_logger";
import { TOKEN_KEY } from "../auth/hg_auth";
import HGNet from "../net_handle/hg_net_manager_vm";

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
    curl -X POST http://localhost:8080/user/register \
        -H "Content-Type: application/json" \
        -d '{"account":"13800000000","code":"564877"}'
*/
  static requestRegisterUser = ({ userName, phone, code, password }) => {
    return HGNet.registerNewUser({
      userName: userName,
      phone: phone,
      code: code,
      password: password,
    })
      .then((res) => {
        LogOut("注册响应：", res);
        if (res.code === 200) {
          return res.result.code;
        } else {
          throw new Error(res.message || "发送验证码失败");
        }
      })
      .catch((err) => {
        throw err;
      });
  };
  /*发送验证码 
    curl -X POST http://localhost:8080/auth/send_code -d "phone=13800000000" 
  */
  static requestSendVerifyCode = ({ phone }) => {
    return HGNet.sendCode({ phone: phone })
      .then((res) => {
        if (res.code === 200) {
          return res.result.code;
        } else {
          throw new Error(res.message || "发送验证码失败");
        }
      })
      .catch((err) => {
        throw err;
      });
  };
  /* 登录 
  curl -X POST http://localhost:8080/auth/login \
  -d "phone=13800000000" \
  -d "code=255830"

  或者

    curl -X POST http://localhost:8080/auth/login -d "phone=13800000000&code=255830"
  */
  static requestLogin = ({ phone, password }) => {
    // 调用真正的登录接口（返回 Promise）
    return HGNet.postUserLogin({ phone, password })
      .then((response) => {
        // 👇 在这里处理响应结果
        // 例如：假设后端返回 { code: 200, data: { token: 'xxx' } }

        if (response.code === 200) {
          localStorage.setItem(TOKEN_KEY, response.result?.token);
          // 成功：返回你需要的数据结构，比如只返回 data
          return response.result; // 页面 .then(res) 拿到的就是 data
        } else {
          // 失败：抛出错误，会被 .catch 捕获
          throw new Error(response.message || "登录失败");
        }
      })
      .catch((error) => {
        // 👇 可选：统一错误处理（如弹窗提示）
        console.error("登录请求失败:", error);
        // 重新抛出，让页面能 catch 到
        throw error;
      });
  };
}

/**
 *
    // 🔜 替换为真实注册 API
    setTimeout(() => {
      console.log("注册数据:", values);
      message.success("注册成功，请登录");
      this.setState({ loading: false });
      // this.props.navigate("/login");
    }, 1000);
*/

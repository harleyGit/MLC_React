/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:39:47
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-01 22:39:18
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
        return res;
      })
      .catch((err) => {
        throw err;
      });
  };
  /*发送验证码 
    curl -X GET http://localhost:8080/auth/send_code -d "phone=13800000000" 

    ✔ 不判断 code
    ✔ 不 catch
    ✔ 不 throw
  */
  static requestSendVerifyCode = ({ phone }) => {
    // res 就是后端 result
    return HGNet.sendCode({ phone }).then((res) => {
      LogOut(res);
      // res === 后端 result
      return res.code;
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

        LogOut("登录 res：", response);

        localStorage.setItem(TOKEN_KEY, response?.token);
        // 成功：返回你需要的数据结构，比如只返回 data
        return response.result; // 页面 .then(res) 拿到的就是 data
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

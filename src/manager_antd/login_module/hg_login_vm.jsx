import { TOKEN_KEY } from "../auth/hg_auth";
import HGNet from "../net_handle/hg_net_manager_vm";

export default class HGLoginVM {
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

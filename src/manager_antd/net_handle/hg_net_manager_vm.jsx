/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:32:04
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 17:00:15
 * @FilePath: /MLC_React/src/manager_antd/net_handle/hg_net_manager_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGNetManager from "../../api/hg_net_manager";
import { HGMANAGER_API } from "../api/hg_api_constants";

class HGNetManagerVM extends HGNetManager {
  // 发送验证码
  sendCode(phone, password) {
    return this.post(HGMANAGER_API.SEND_CODE, {
      phone,
      password,
    });
  }

  postUserLogin = ({ phone, password }) => {
    return this.post(HGMANAGER_API.LOGIN, { phone: phone, password: password });
  };

  //   HGNet.post("/auth/login", {
  //     phone: values.username,
  //     password: values.password,
  //   })
  //     .then((res) => {
  //       console.log("登录成功", res);
  //       localStorage.setItem(TOKEN_KEY, res.result?.token);

  //       const from = this.props.location.state?.from || ROUTE_PATH.USER_PROFILE;
  //       // window.location.href = "/home";
  //       this.props.navigate?.(from);
  //       this.setState({ loading: false });
  //     })
  //     .catch((err) => {
  //       this.setState({ loading: false });
  //       console.error("登录失败", err);
  //     });

  // 其他注册相关方法...
  register(data) {
    // return this.post('/auth/register', data);
  }
}
// 创建一个默认实例
const HGNet = new HGNetManagerVM();
export default HGNet; // 单例导出

/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:32:04
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-01-31 22:09:29
 * @FilePath: /MLC_React/src/manager_antd/net_handle/hg_net_manager_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGNetManager from "../../api/hg_net_manager";
import { HGMANAGER_API } from "../api/hg_api_constants";

class HGNetManagerVM extends HGNetManager {
  postUserLogin = ({ phone, password }) => {
    return this.post(HGMANAGER_API.LOGIN, { phone: phone, password: password });
  };

  // 发送验证码
  sendCode({ phone }) {
    return this.post(HGMANAGER_API.SEND_CODE, {
      phone,
    });
  }
  // 注册新用户
  registerNewUser({ userName, phone, code, password }) {
    return this.post(HGMANAGER_API.REGISTER_NEW_USER, {
      userName: userName,
      phone: phone,
      code: code,
      password: password,
    });
  }
}
// 创建一个默认实例
const HGNet = new HGNetManagerVM();
export default HGNet; // 单例导出

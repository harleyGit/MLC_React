/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-07 17:29:48
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-07 17:34:01
 * @FilePath: /MLC_React/src/manager_antd/page_modules/user/hg_user_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGNet from "../../net_handle/hg_net_manager_vm";

export default class HGUserVM {
  constructor() {}

  static requestUserInfoDataList = ({ userName, phone, code, password }) => {
    return HGNet.getUserDataList({
      pageNum: 1,
      pageSize: 20,
    })
      .then((res) => {
        LogOut("注册响应：", res);
        return res;
      })
      .catch((err) => {
        throw err;
      });
  };
}

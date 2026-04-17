/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-02-07 17:29:48
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-18 11:00:00
 * @FilePath: /MLC_React/src/manager_antd/page_modules/user/hg_user_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { LogOut } from "../../../logger/hg_logger";
import HGNet from "../../net_handle/hg_net_manager_vm";

export default class HGUserVM {
  constructor() {}

  /* 获取用户列表 */
  static requestUserInfoDataList = ({ pageNum, pageSize, keyword, cursor }) => {
    return HGNet.getUserDataList({
      pageNum,
      pageSize,
      keyword,
      cursor,
    })
      .then((res) => {
        LogOut("获取用户列表：", res);
        return {
          result: res?.result ?? [],
          total: res?.numResults ?? 0,
          pageIndex: pageNum ?? 1,
          pageSize: res?.pagesize ?? pageSize,
          nextCursor: res?.nextCursor ?? 0,
          hasMore: Boolean(res?.hasMore),
        };
      })
      .catch((err) => {
        throw err;
      });
  };
}

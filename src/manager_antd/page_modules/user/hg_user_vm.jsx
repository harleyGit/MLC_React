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

  /* 先更新联系方式，再更新公开资料；两次请求非原子操作，任一失败时调用方须刷新列表核对结果。 */
  static updateUserByUserId = async ({ userId, nickname, signature, gender, avatar_url, phone, email, previousPhone, previousEmail }) => {
    if (!userId) throw new Error("缺少目标用户 ID");
    // 仅发送实际变化的安全字段，避免重复写入认证表及无意义的审计记录。
    const securityChanges = {};
    if (phone !== (previousPhone ?? "")) securityChanges.phone = phone;
    if (email !== (previousEmail ?? "")) securityChanges.email = email;
    if (Object.keys(securityChanges).length > 0) {
      await HGNet.updateUserSecurityForAdmin({ userId, ...securityChanges });
    }
    return HGNet.updateUserProfile({ userId, nickname, signature, gender, avatar_url });
  };

  /* 后端尚未提供安全的物理删除入口；页面禁用删除按钮，避免误调用。 */
  static deleteUserByUserId = (userId) => {
    return HGNet.deleteUser(userId);
  };
}

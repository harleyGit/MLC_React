/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:32:04
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-18 11:00:00
 * @FilePath: /MLC_React/src/manager_antd/net_handle/hg_net_manager_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGNetManager from "../../api/hg_net_manager";
import { HGMANAGER_API } from "../api/hg_api_constants";

class HGNetManagerVM extends HGNetManager {
  /* 获取用户列表 */
  getUserDataList = ({ pageSize, pageNum, cursor, keyword }) => {
    const params = { pageSize };

    // 新接口使用 cursor 分页；未传时默认首页 cursor=0。
    params.cursor = Number.isFinite(Number(cursor)) ? Number(cursor) : 0;

    // 兼容保留 pageNum，便于后端或日志侧定位当前前端页码。
    if (Number.isFinite(Number(pageNum))) {
      params.pageNum = Number(pageNum);
    }

    // 仅在有搜索词时携带 keyword，避免 query 出现 keyword=undefined。
    if (keyword) {
      params.keyword = keyword;
    }

    return this.get(HGMANAGER_API.UserList, params);
  };

  /* 登录 */
  postUserLogin = ({ phone, password }) => {
    return this.post(HGMANAGER_API.LOGIN, { phone, password });
  };

  // 发送验证码
  sendCode({ phone }) {
    return this.get(HGMANAGER_API.SEND_CODE, {
      phone,
    });
  }

  // 注册新用户
  registerNewUser({ userName, phone, code, password }) {
    return this.post(HGMANAGER_API.REGISTER_NEW_USER, {
      userName,
      phone,
      code,
      password,
    });
  }
}

// 创建一个默认实例
const HGNet = new HGNetManagerVM();
export default HGNet; // 单例导出

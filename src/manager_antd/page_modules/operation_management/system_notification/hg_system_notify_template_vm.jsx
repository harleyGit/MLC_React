/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-11-20 22:15:23
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-11-20 22:19:04
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/system_notification/hg_system_notify_template_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { getRequestErrorMessage } from "../../../../api/hg_request_error";
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";
export { hgTemplateToForm, hgTemplatePayload } from "./hg_template_form.js";

const hgBase = HGMANAGER_API.NOTIFICATION_TEMPLATES; // 模板管理专用前缀，所有写入复用现有鉴权和签名请求层。

/**
 * 表单初始值不含业务通知正文；创建、编辑均由服务端权威数据驱动。
 * variables_schema 为变量条目数组、action_config 为 route_name + 参数键值对，
 * 全部通过编辑器按钮增删配置，不再以 JSON 文本编辑；契约见 hg_template_form.js。
 */
export const HG_EMPTY_TEMPLATE = Object.freeze({
  template_code: "",
  name: "",
  category: "system",
  title_template: "",
  body_template: "",
  variables_schema: [],
  action_type: "none",
  action_config: { route_name: "", params: [] },
  channels: ["in_app"],
  priority: 2,
  locale: "zh-CN",
  version: 0,
});

/** HTTP 409 必须保留用户编辑内容，提示重新读取，不自动提交旧草稿。 */
export default class HGSystemNotifyTemplateVM {
  static list = (cursor = "") => HGNet.get(hgBase, cursor ? { cursor } : {});
  static detail = (id) => HGNet.get(`${hgBase}/detail`, { id });
  static create = (body) => HGNet.post(hgBase, body, { _hasRetried: true });
  static update = (id, body) =>
    HGNet.put(`${hgBase}/update?id=${encodeURIComponent(id)}`, body, {
      _hasRetried: true,
    });
  static delete = (id, version) =>
    HGNet.post(
      `${hgBase}/delete?id=${encodeURIComponent(id)}`,
      { version },
      { _hasRetried: true }
    );
  /** 角色更新模板使用原有专用发布入口，不在客户端产生或推送权限数据。 */
  static publish = (id, version) =>
    HGNet.post(`${hgBase}/publish?id=${encodeURIComponent(id)}`, { version }, { _hasRetried: true });
  /** 站内模板使用带复核/超级管理员自审校验的发布入口，不绕过服务端版本锁。 */
  static publishSend = (id, version) =>
    HGNet.post(`${hgBase}/publish-send?id=${encodeURIComponent(id)}`, { version }, { _hasRetried: true });
  /** 通用发布只公开不可变版本，不赋予运营站内发送资格。 */
  static publishGeneral = (id, version) =>
    HGNet.post(`${hgBase}/publish-general?id=${encodeURIComponent(id)}`, { version }, { _hasRetried: true });
  static errorMessage = (error) =>
    Number(error?.status) === 409 || Number(error?.code) === 409
      ? "模板编码重复、版本已变更或不满足发布复核条件。请刷新列表后核对；不会覆盖现有版本。"
      : getRequestErrorMessage(error, "请求失败，请稍后重试");
}

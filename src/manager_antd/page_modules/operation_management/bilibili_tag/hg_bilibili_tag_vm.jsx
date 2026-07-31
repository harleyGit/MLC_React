import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";
import { getRequestErrorMessage } from "../../../../api/hg_request_error";

/** 默认每页数量，与后端 ops 标签列表 pageSize 上限约束配合使用。 */
export const BILIBILI_TAG_PAGE_SIZE = 20;

/** Bilibili 动画标签 ViewModel，封装 CRUD、cursor 分页和表格数据转换。 */
export default class HGBilibiliTagVM {
  /**
   * 获取运维标签列表。
   * 空 cursor 表示首页，后续页原样传上一页响应的 nextCursor，避免破坏不透明游标。
   */
  static fetchTags = ({ cursor = "", pageSize = BILIBILI_TAG_PAGE_SIZE } = {}) =>
    HGNet.get(HGMANAGER_API.OPS_BILIBILI_TAG_LIST, { cursor, pageSize });

  /** 创建标签，并在请求前统一去除名称两侧空白和转换数值字段。 */
  static createTag = ({ name, sortOrder, status }) =>
    HGNet.post(HGMANAGER_API.OPS_BILIBILI_TAG_CREATE, {
      name: name.trim(),
      sortOrder: Number(sortOrder),
      status: Number(status),
    });

  /** 更新标签；tagId 使用后端生成的字符串业务 ID，不暴露数据库自增主键。 */
  static updateTag = ({ tagId, name, sortOrder, status }) =>
    HGNet.post(HGMANAGER_API.OPS_BILIBILI_TAG_UPDATE, {
      tagId,
      name: name.trim(),
      sortOrder: Number(sortOrder),
      status: Number(status),
    });

  /** 软删除标签目录项，历史视频标签关联不会被修改。 */
  static deleteTag = ({ tagId }) => HGNet.post(HGMANAGER_API.OPS_BILIBILI_TAG_DELETE, { tagId });

  /** 将请求错误转换为页面可展示文案，优先透传后端业务错误。 */
  static getErrorMessage = (error, fallbackMessage) =>
    getRequestErrorMessage(error, fallbackMessage);

  /**
   * 执行前端快速校验，减少无效请求；后端仍会执行同等约束校验，前端结果不作为安全边界。
   * @returns {string} 空字符串表示校验通过，否则返回可展示的错误信息。
   */
  static validateForm = ({ name, sortOrder }) => {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) return "标签名称不能为空";
    if (normalizedName === "推荐") return "推荐为系统保留标签";
    if ([...normalizedName].length > 32) return "标签名称不能超过32个字符";
    const order = Number(sortOrder);
    if (!Number.isInteger(order) || order < 0 || order > 1000000) return "排序值需为0到1000000的整数";
    return "";
  };

  /** 将接口标签数据规范化为表格行，隔离页面与接口空值、数值类型差异。 */
  static toRows = (tags = []) => tags.map((tag) => ({
    tagId: String(tag.tagId || ""),
    name: tag.name || "",
    sortOrder: Number(tag.sortOrder || 0),
    status: Number(tag.status || 1),
    createdAt: tag.createdAt || "",
    updatedAt: tag.updatedAt || "",
  }));

  /**
   * 为分页组件合成最小 total。
   * 后端不执行 COUNT(*)；hasMore=true 时额外加 1，仅表达“至少还有一条”。
   */
  static buildCursorTotal = ({ pageNum, pageSize, rowCount, hasMore }) =>
    (pageNum - 1) * pageSize + rowCount + (hasMore ? 1 : 0);
}

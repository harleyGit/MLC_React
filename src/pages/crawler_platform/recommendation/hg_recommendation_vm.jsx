import { HGMANAGER_API } from "../../../manager_antd/api/hg_api_constants";
import HGNet from "../../../manager_antd/net_handle/hg_net_manager_vm";
import HGTaskVM, { CRAWLER_TASK_PAGE_SIZE } from "../task/hg_task_vm";

export const CRAWLER_CONTENT_PAGE_SIZE = 20;

/** HGRecommendationVM 封装采集结果页的任务和任务内容两级游标分页。 */
export default class HGRecommendationVM {
  static fetchTasks = (params) => HGTaskVM.fetchTasks(params);

  /** 获取指定任务关联的标准化外部内容。 */
  static fetchContents = ({ taskId, cursor = 0, pageSize = CRAWLER_CONTENT_PAGE_SIZE }) => HGNet.get(
    HGMANAGER_API.OPS_CRAWLER_TASK_CONTENTS,
    { taskId, cursor, pageSize }
  ).then(HGRecommendationVM.normalizeContentList);

  static normalizeContentList = (result = {}) => ({
    list: (result.list || result.List || []).map((item) => ({
      associationId: item.associationId ?? item.AssociationID,
      taskDefinitionId: item.taskDefinitionId ?? item.TaskDefinitionID,
      lastRunId: item.lastRunId ?? item.LastRunID,
      platform: item.platform ?? item.Platform,
      contentId: item.contentId ?? item.ContentID,
      title: item.title ?? item.Title,
      authorId: item.authorId ?? item.AuthorID,
      authorName: item.authorName ?? item.AuthorName,
      coverUrl: item.coverUrl ?? item.CoverURL,
      targetUrl: item.targetUrl ?? item.TargetURL,
      durationSeconds: item.durationSeconds ?? item.DurationSeconds,
      viewCount: item.viewCount ?? item.ViewCount,
      likeCount: item.likeCount ?? item.LikeCount,
      commentCount: item.commentCount ?? item.CommentCount,
      publishedAt: item.publishedAt ?? item.PublishedAt,
      firstSeenAt: item.firstSeenAt ?? item.FirstSeenAt,
      lastSeenAt: item.lastSeenAt ?? item.LastSeenAt,
    })),
    nextCursor: result.nextCursor ?? result.NextCursor ?? 0,
    hasMore: Boolean(result.hasMore ?? result.HasMore),
  });

  static total = HGTaskVM.total;
  static taskPageSize = CRAWLER_TASK_PAGE_SIZE;

  /** 将秒数格式化为 mm:ss 或 h:mm:ss。 */
  static durationText = (seconds) => {
    const total = Math.max(0, Number(seconds) || 0);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const remain = Math.floor(total % 60);
    return hours > 0
      ? `${hours}:${String(minutes).padStart(2, "0")}:${String(remain).padStart(2, "0")}`
      : `${minutes}:${String(remain).padStart(2, "0")}`;
  };

  static countText = (value) => Math.max(0, Number(value) || 0).toLocaleString();
}

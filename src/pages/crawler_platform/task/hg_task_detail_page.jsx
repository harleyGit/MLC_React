import React, { Component } from "react";
import HGButtonPage from "../../../components/hg_button/hg_button_page";
import HGCardPage from "../../../components/hg_card/hg_card_page";
import HGDetailGridPage from "../../../components/hg_detail_grid/hg_detail_grid_page";
import styles from "./hg_task_page.module.css";
import HGTaskVM from "./hg_task_vm";

/** HGTaskDetailPage 展示从任务列表导航进入的任务定义和最近运行摘要。 */
class HGTaskDetailPage extends Component {
  /** 从持久化 JSON 配置中读取请求超时。 */
  getTimeoutSeconds = (task) =>
    Math.max(1, Number(task?.configuration?.request?.timeoutMs || 10000) / 1000);

  render() {
    const task = this.props.pageContext?.task;
    if (!task?.id) {
      return (
        <HGCardPage title="采集任务详情">
          <div className={styles.empty}>未找到任务上下文，请返回任务管理重新选择任务。</div>
          <HGButtonPage onClick={() => this.props.onNavigate?.("crawler_tasks")}>
            返回任务管理
          </HGButtonPage>
        </HGCardPage>
      );
    }

    const request = task.configuration?.request || {};
    return (
      <div>
        <div className={styles.detailHeader}>
          <HGButtonPage onClick={() => this.props.onNavigate?.("crawler_tasks")}>
            返回任务管理
          </HGButtonPage>
          <div>
            <p>TASK DEFINITION</p>
            <h1>{task.name}</h1>
            <span>{task.platform} · 任务 ID {task.id}</span>
          </div>
        </div>
        <HGCardPage title="任务定义与运行摘要">
          <HGDetailGridPage
            columns={2}
            maxValueLines={3}
            items={[
              { label: "任务 ID", value: task.id },
              { label: "任务名称", value: task.name },
              { label: "数据源", value: task.platform },
              { label: "请求方式", value: request.method || "GET" },
              { label: "请求地址", value: request.url },
              { label: "解析类型", value: task.parserType },
              { label: "Item Selector", value: task.itemPath },
              { label: "执行方式", value: task.enabled ? `Cron ${task.cron}` : "手动" },
              { label: "执行限制", value: `${this.getTimeoutSeconds(task)} 秒 / ${task.maxItems} 条` },
              { label: "最近状态", value: HGTaskVM.statusText(task.lastRunStatus) },
              { label: "最近数据量", value: task.lastRunItemCount },
              { label: "最近错误", value: task.lastRunError },
              { label: "创建时间", value: task.createdAt ? new Date(task.createdAt).toLocaleString() : "-" },
              { label: "更新时间", value: task.updatedAt ? new Date(task.updatedAt).toLocaleString() : "-" },
            ]}
          />
          <div className={styles.configurationBlock}>
            <strong>完整任务配置</strong>
            <pre>{JSON.stringify(task.configuration, null, 2)}</pre>
          </div>
        </HGCardPage>
      </div>
    );
  }
}

export default HGTaskDetailPage;

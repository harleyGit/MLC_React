import HGNotifyChannelPage from "./hg_notify_channel_page";

/** 本人发送记录独立历史页：复用只读游标与任务详情，进入页面时才查询本人记录。 */
export default class HGNotifySendRecordsPage extends HGNotifyChannelPage {
  static defaultProps = {
    ...HGNotifyChannelPage.defaultProps,
    hgView: "records", // 默认仅展示本人记录和进度；不加载渠道或模板。
  };

  componentDidMount() {
    super.componentDidMount();
    // 服务端只返回本人任务；页面只在进入时读取，不在发送表单页预取记录。
    this.hgLoadTasks(true);
  }
}

import React from "react";
import HGNotifyChannelPage from "./hg_notify_channel_page";

/** 发送通知独立菜单页：复用任务校验、幂等重试与审批流程，不加载渠道概览。 */
export default class HGNotifySendPage extends HGNotifyChannelPage {
  static defaultProps = {
    ...HGNotifyChannelPage.defaultProps,
    hgView: "send", // 默认只显示发送、审批及本人任务；不请求渠道总览。
  };
}

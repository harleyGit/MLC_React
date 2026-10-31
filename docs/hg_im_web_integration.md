# 聊天首页 Web 对接范围与上线门禁

对接页面：`src/manager_antd/page_modules/home/hg_home_page.jsx`。服务端协议、审核前提和迁移风险见 `MLC_GO/docs/hg_im_integration.md`；这里不替代真实组件验收。**仅 Vite debug 构建展示聊天页；pre/release 展示未启用提示。** Go 的扩展配置默认关闭，没部署审核器/网关/LiveKit 时仍以服务端响应为准，不提供演示消息或假成功。

## 本轮实现

- `src/manager_antd/net_handle/hg_im_api.jsx` 通过既有签名 fetch 链调用 Go，消息、历史、设备、媒体和通话共用 JWT 刷新及账号校验；`src/api/HttpManagerV1.js` 新增可取消请求和有界字节分段，Range 中途 401 继续由既有刷新链重新签名；禁止媒体下载重定向。
- `src/manager_antd/page_modules/home/hg_home_vm.jsx` 负责会话主键游标、连续 seq 补拉（单轮最多 2×50）、消息窗口上限 200、每 8 秒 HTTP 兜底、逐设备 ACK。ACK **只确认当前页面已呈现且 messageId/seq 匹配的消息**；未打开或被窗口淘汰的指针保留，不能把 SDK 收到指针当作已送达。pending 单轮最多检查 400 条，积压大量会话时需滚动/打开具体会话及后续后台恢复方案。
- `hg_im_realtime.jsx` 使用锁定的 `centrifuge@5.8.0` 仅监听 Go JWT 服务器自动订阅的设备频道；不执行客户端订阅/发布。连接刷新重新调用 Go，权限失效时断开；发布、重连只触发服务端授权补拉。连接 token 不持久化。
- `src/components/hg_chat_input/hg_chat_input.jsx` 是首页唯一输入组件：文字与表情共用草稿及稳定 clientMsgId；请求结果不确定时保留原命令和会话供幂等重试。“更多”提供图片、视频、音频、文件，依次 SHA256 → Go 预留 → SeaweedFS 预签名 PUT → Go complete → 审核状态 ready → 用户确认经 Go 发送；只使用审核器真实宽高/时长。语音模式真实采集麦克风，松开发起审核、移出/取消不发送，60 秒自动停止。仅支持后端白名单中的 MP4/OGG 录音容器；仅支持 WebM 的浏览器须选择 MP3/OGG/M4A/AAC 音频文件，不能把 WebM 假冒 OGG 或跳过审核。上传最多一个在途，失败/撤销不保证配额返还。
- `hg_im_media_preview.jsx` 经 Go 按 4MiB 分段重新鉴权，核对 Content-Range/MIME/总长，在本地合并为 Blob；查看器关闭或路由卸载释放 URL。不提供不带 JWT 的媒体标签 src；整个文件解码占用浏览器内存，单文件最大 128MiB，媒体带宽和移动端内存仍需评估。
- `hg_im_call_panel.jsx` 使用锁定的 `livekit-client@2.22.0`，向 Go 申请创建、接听/拒绝/结束、取 room/token；只有 accepted 才由用户操作加入，加入后再次查询 Go，终态、过期和卸载断开本机轨道。浏览器 SDK 的连接状态不等于业务已接听或可保证服务端撤权。设备 secret 仅放在当前标签 `sessionStorage` 的账号绑定条目；退出时尝试撤销设备并立即清除，撤销失败明确显示“未确认”。

## 需要隔离环境执行的实际验收

1. 获取**独立隔离 debug 外部实例**并明确授权迁移 `000054`、创建 Kafka topic/消费组和 S3 私有桶后，检查 Centrifugo v6 实际配置（版本/digest）、同源/跨域 WSS、JWT 刷新、双用户多设备、断线补洞、重复提示、ACK 失败及积压恢复。当前页面只有已知呼叫 ID/实时事件，不提供离线来电清单；离线漏来电需服务端补拉能力才能保证发现。
2. 在隔离 debug 环境启用 `MLC_IM_REALTIME_ENABLED` 和 `MLC_IM_MEDIA_ENABLED`、提供专用存储及真实审核器之后，用真实审核器验证 S3 的 SigV4、CORS/Origin、Content-Length、ACL、签名到期、PUT 重试和隔离区→不可变封存；Go 跨域需许可 `Range` 并在 206 暴露 `Content-Range`。验证各类附件与可录音浏览器、拒审、伪造媒体、越权、单用户额度、设备撤销及全部 Blob/麦克风资源清理。扩展默认关闭，前端单独接入不能开启服务端媒体。
3. 锁定 LiveKit 服务端版本后，验证 TURN/UDP/浏览器权限和同名房间重建、迟到回调；**服务端自主续签与终态重新入房的拒绝策略仍未完成**，前端停止采集不能作为可靠撤权保证。群聊、好友/屏蔽、离线推送、归档/配额回收、容量压测也未完成。pre/prod 保持 IM 关闭，不在此处启动生产服务或运行迁移。

## 本地验证边界

本机使用 Node 24.7.0（项目指定的 `$HOME/.nvm/versions/node/v20.19.0` 不存在）；安装 `centrifuge@5.8.0` 与 `livekit-client@2.22.0` 时使用 `--ignore-scripts`，npm 报已有 `react-scripts` 间接 ESLint peer 警告。已定向 ESLint、Vite pre 构建（产物写在工程外）和 12 组本地 SWC 内存替身检查：签名 Range/401、取消/上限、跨账号缓存、序号补洞/切换竞态、ACK、幂等重试、媒体范围与 S3 PUT、设备频道订阅、LiveKit 终态。**未连接真实 Go/Centrifugo/SeaweedFS/LiveKit，未运行浏览器音视频/上传/跨节点验收，也未在 Node 20 实测。**

本次输入组件整合另执行定向 ESLint、工程外 pre 构建与内存 SWC 替身检查（附件选择/审核、原会话发送、表情草稿、失败命令幂等重试、权限取消后释放麦克风）；不是实际 S3 PUT、浏览器录音或审核服务联调。Go 仓库 base Gateway 已配置必需的 `im` 策略；自定义覆盖配置需单独定位并补齐后再启动，不能从前端构建推断 Go 已启动。

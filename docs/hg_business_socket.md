# Web 单标签实时连接分工

## 连接与所有权

- **用户业务 Socket**：`HGIAMAccessProvider` 随登录会话维护一条 `HGBusinessRealtime`，服务器通过 `/api/v1/iam/me/realtime` 的会话票据与私有 connect proxy 授权，将 `im:iam:<user>` 自动订阅给当前用户。同一连接同时承载 IAM 授权更新和消息中心的站内通知提示。该频道名称保留 `iam` 是为了兼容已部署网关，并不表示只能处理 IAM。
- **Chat 设备 Socket**：聊天页或消息中心的私信视图使用 `/api/v1/im/realtime/token` 的设备票据、`im:<device>` 频道及 `im:*` RPC。它与用户业务 Socket 的凭据、生命周期和权限边界独立；消息中心的**通知**走用户业务 Socket，消息中心的**私信**仍走 Chat 设备 Socket。互斥路由不会同时挂载两个私信视图。本轮不改变私信设备连接在离开对应视图时关闭的既有生命周期。
- 同一标签用户业务连接由 Provider 持有，子页不能为新业务创建另一条业务 Socket；不同浏览器标签或设备不跨上下文共享连接，也不把设备 secret 放进业务频道。

## 扩展业务事件

1. 服务端只向经认证的目标用户发布有版本的 `event_type`，不接收客户端指定频道。既有 IAM 事件包含服务端签发的本人授权快照；**新增业务**只发布最小变更提示，正文及需要鉴权的数据仍在各业务 HTTP/RPC 权威接口获取。
2. 页面从 `HGIAMContext.subscribeBusinessEvent("domain.resource.changed.v1", handler)` 注册处理器，返回函数在卸载时注销。处理器绑定注册时的账号；同一标签共享一条客户端连接，不进行客户端 `subscribe` 或 `publish`。
3. 目前 `iam.access.updated.v1` 经服务端快照校验后更新权限展示，`notification.inbox.updated.v1` 只触发消息中心本人收件箱补拉；未知版本直接忽略。新增业务须同时约定事件类型、合法载荷上限、权威补拉入口、断线补偿与账号隔离测试，不得把 `publication` 当作消息已读、设备 ACK 或服务端授权结果。
4. 用户业务 Socket 首次订阅及重连时同步服务端 IAM 快照与通知列表；断线期间 IAM 走约每分钟 HTTP 复核，复核失败不展示受保护入口。Chat 自身最多连续三次连接失败后才提示，二者不共用重试预算。

## 验收边界

本轮仅以本地网络替身覆盖频道隔离、连接实例数、分发、旧账号与注销回调；真实网关 Origin/WSS、会话撤销、多标签订阅和跨节点投递必须在授权的隔离环境验收。连接数为单标签设计上限，不代表已压测吞吐或浏览器线上连接数。

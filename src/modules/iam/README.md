# Web IAM 对接

- `/api/v1/iam/me/access`：使用现有 Bearer Token、请求签名和刷新链；响应由统一客户端解析为 `result`。只包含当前用户的 `roles`、逐绑定的 `grants`、`policy_version` 和 `expires_at`。
- `/api/v1/iam/authorize`：无 `resource` 时只预判全局权限；目前仅支持 `{"type":"product","id":"..."}` + `mall:product:update` 的已上架商品预判。其他资源返回 `RESOURCE_UNSUPPORTED`，不得自行填充 `owner_id` 或 `shop_id` 来推断授权。最终写操作仍由业务 API 鉴权。
- IndexedDB `client_settings` 只缓存按 JWT uid 隔离的短期展示快照，不保存 Token，也不能在网络失败时作为授权凭据；Provider 必须从 Go 刷新成功才进入 `ready`。过期、退出、账号切换默认拒绝。
- 登录成功后更新个人资料的非敏感字段、权限快照及服务端通知偏好；注册接口不签发 Token，也不返回可安全持久化的用户 ID，故注册成功时不写当前用户缓存，待首次登录拉取。
- 菜单和页面使用 `hg_menu_access.js`、`HGRouteGuard`，操作使用 `HGAuthButton`，模块数据挂载前可使用 `HGPermissionGate`。普通本人资料、买家订单与聊天等保留既有登录/业务归属规则，不凭空增加全局 IAM 权限。
- 页面焦点恢复、快照到期、跨标签页 Token 变更会重新核对权限；若将来 Go 推送 `iam.access.changed`，受信任的实时接入层可派发 `hg:iam-access-changed`（只含 `user_id` 和 `policy_version`）触发 HTTP 刷新。目前后端未发布此事件，不能声称实时撤权 UI 已接通。

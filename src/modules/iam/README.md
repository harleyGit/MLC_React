# Web IAM 对接

- `/api/v1/iam/me/access`：使用现有 Bearer Token、请求签名和刷新链；响应由统一客户端解析为 `result`。只包含当前用户的 `roles`、逐绑定的 `grants`、`policy_version` 和 `expires_at`。
- `/api/v1/iam/authorize`：无 `resource` 时只预判全局权限；目前仅支持 `{"type":"product","id":"..."}` + `mall:product:update` 的已上架商品预判，服务端核对真实商家 ID、本人归属和商品状态，匹配 `shop/merchant_id` 或全局权限。其他资源返回 `RESOURCE_UNSUPPORTED`，不得自行填充 `owner_id` 或 `shop_id` 来推断授权。最终写操作仍由业务 API 鉴权。
- IndexedDB `client_settings` 按 JWT uid 保存最近一次由服务端返回或本人可信频道推送的展示快照，不存 Token。页面重载时可直接恢复尚未到期的同账号快照；`ready` 只表示前端展示预判，不能代替服务端逐请求鉴权。过期、退出、账号切换仍默认拒绝。
- 登录成功后更新个人资料的非敏感字段、权限快照及服务端通知偏好；注册接口不签发 Token，也不返回可安全持久化的用户 ID，故注册成功时不写当前用户缓存，待首次登录拉取。
- 菜单和页面使用 `hg_menu_access.js`、`HGRouteGuard`，操作使用 `HGAuthButton`，模块数据挂载前可使用 `HGPermissionGate`。普通本人资料、买家订单与聊天等保留既有登录/业务归属规则，不凭空增加全局 IAM 权限。
- 登录首次取回快照并落库；注册不签发 Token，注册后须首次登录才能保存本人快照。Socket 断线和恢复均不自动请求 IAM 快照；已认证频道收到 `iam.access.updated.v1` 才更新本地展示并持久化。有限期快照到期时至多主动补拉一次 `/me/access`，再次到期只在本地失效；服务端未开启实时能力时默认有效期为 30 天，若有更早到期的绑定则取较早时间，开启实时能力且无有限期绑定时为 2099 年。错过推送可能导致菜单长期展示旧权限，业务接口仍从服务端权威数据鉴权。

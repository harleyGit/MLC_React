# 登录认证模块（auth）

按《本地数据库存储技术》方案预留目录。P1 阶段实现 `auth_sessions`（非敏感登录会话元数据）相关仓库。

安全边界（见技术方案第九章）：

- Access Token 仅存 JS 内存；Refresh Token 走 HttpOnly Cookie，不落 IndexedDB / localStorage。
- 本模块只允许存储非敏感会话元数据（如登录时间、设备摘要），仅供 UI 展示。
- 登出时需撤销服务端会话、关闭 WebSocket，并按隐私策略清理该用户本地数据。

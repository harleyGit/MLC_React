# 钱包二维码局域网开发

开发服务监听 `0.0.0.0:5174`，`/api/v1` 仍由 Vite 代理到电脑的 `8080`，弹幕和 crawler 代理保持原配置。Mac 用 `localhost` 打开充值页时，Vite 开发插件只在能唯一识别一个物理网卡私网 IPv4 时，把钱包订单二维码的 origin 改成该 LAN 地址；不会改生产 origin，也不会把地址发往外部服务。

## 多网卡与覆盖

- 自动选择仅考虑常规 `en*`、`eth*`、`wlan*`、`wl*` 网卡上的 RFC1918 IPv4。
- loopback、link-local、Docker 常见网卡名、`utun` VPN 和其他候选会被排除。
- 多个候选时不会猜测路由，也不会生成 `localhost` 二维码。设置 `VITE_WALLET_DEV_INTERFACE=en0` 后重启 Vite，或设置 `VITE_WALLET_DEV_ORIGIN=http://192.168.1.8:5174` 显式覆盖。
- 覆盖只接受无凭据的 HTTP(S) origin，不接受 localhost、本机回环、路径、查询参数或片段。`VITE_WALLET_DEV_*` 不是密钥，但不要把 token 放进 URL。

## iPhone 安全上下文

局域网 HTTP 在 iPhone 上通常不是安全上下文，现有请求签名的 `crypto.subtle` 可能不可用。请求层保留既有 SHA-256/HMAC-SHA256 fallback，因此不会因为没有 `crypto.subtle` 自动阻断既有请求流程；但 HTTP 会暴露传输和本机调试风险，建议使用手机信任的 HTTPS，尤其不要在不可信网络传输登录或钱包数据。

如需降低上述风险，可给开发服务器配置手机信任的证书：

```bash
MLC_DEV_TLS_CERT=/absolute/path/dev-cert.pem \
MLC_DEV_TLS_KEY=/absolute/path/dev-key.pem \
npm run dev
```

证书必须包含手机访问的 LAN IP 或开发域名，iPhone 也必须信任对应 CA。配置后从 `https://<LAN-IP>:5174` 打开页面，再登录创建订单的同一 MLC 用户。二维码只是受 JWT 保护的订单确认页，不是微信或支付宝支付码。

## Debug 模拟充值

仅在隔离测试数据库和测试账号上启用。模拟充值不扣人民币，但会写入真实平台币余额和流水，不能用于生产资产测试。

1. 经环境负责人确认后，为目标测试库执行后端 `migrations/000034_wallet_debug_payment.up.sql` 迁移（以及此前未执行的必要迁移）。前端不会自动执行迁移。
2. 在 `MLC_GO` 根目录，以以下环境变量启动或重启后端；仅修改变量而不重启现有进程不会生效：

```bash
SERVER_ENV=debug MLC_WALLET_DEBUG_PAYMENT_ENABLED=true go run -tags production .
```

`production` tag 仅选择 Go 服务入口，不表示 `SERVER_ENV=prod`。后端启动会连接基础设施并启动后台任务，须先确认隔离配置。前端在 `MLC_React` 根目录运行 `npm run dev`，不需要也不能通过 Vite 模式推断支付能力。

3. 开关开启后重新创建订单。旧订单绑定 `paymentMode=unavailable`，重启后端不会转换为模拟订单。
4. 只有订单同时返回 `paymentAvailable=true`、`paymentMode=platform_debug` 且 `availableMethods` 包含 `platform_debug`，才能点击“模拟充值（仅debug）”。微信和支付宝显示未接入并禁用，绝不降级为模拟渠道。

POST `/api/v1/wallet/recharge/orders/pay` 必传 `{orderId,paymentMethod:'platform_debug'|'wechat'|'alipay'}`，现阶段 UI 只提交 `platform_debug`；返回的 `result` 是完整订单。`paid` 优先于 `expiresAt`，`paidAt` 和字符串 `balanceAfter` 表示入账时间和历史余额快照，不等于实时余额。手机成功响应、电脑轮询发现 paid 后均停止订单轮询，重新调用余额接口；返回钱包主页也自动查询余额，金额不转为 Number。

网络超时或 500 后先查询同一订单。若查询仍失败，使用“重新查询”确认结果，不要新建订单；确认仍 pending 时可安全重试相同订单 pay，后端幂等保证不重复入账。前端不会自动重付或自动创建新订单。

## 签名验证范围

`node --test src/api/hg_sign_crypto.test.js` 在隔离 VM 中执行现有请求类，使用虚构密钥，不加载环境配置、不读 token、不调用服务。测试覆盖有/无 Web Crypto 的 SHA-256 填充边界、UTF-8、短/长密钥 HMAC、RFC 4231 向量和钱包 GET/POST 签名，并与 Node 标准实现比较。

这些证据表明既有 fallback 在所测输入上能生成正确签名，不是完整密码学审计，也不代表已验证 iPhone 实机、后端验签或付款。签名不能加密 HTTP 流量，亦不能防止中间人修改 HTTP 下发的页面脚本，可信 HTTPS 仍是推荐方式。

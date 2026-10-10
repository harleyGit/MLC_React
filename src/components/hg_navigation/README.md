# 页面导航协议

`hg_route_path.jsx` 保存 URL，`hg_page_registry.jsx` 注册 `PAGE -> route/component`，
`hg_page_navigator.jsx` 管理 React Router 适配和内存会话。现有 `WithNavigation`
及 `utils/WithRouter` 为类组件注入 `pageNavigator`、`pageNavigation`。

```jsx
this.props.pageNavigator.open({
  page: PAGE.WALLET_RECHARGE,
  params: { source: "wallet" },
  onSuccess: (result) => hgMessage.success(`订单 ${result.orderId} 已完成`),
});

const finished = await this.props.pageNavigation.success({
  orderId: order.orderId,
  status: "paid",
});
if (!finished) this.props.pageNavigator.open({ page: PAGE.WALLET, replace: true });
```

- `pathParams` 传原始值，由导航器编码；`params` 接受标量、标量数组或 URLSearchParams。
- 目标页 `pageNavigation.params` 为普通对象，查询值为字符串，重复键为数组。
- `state` 保留既有 history state 契约，只允许可结构化克隆的数据，禁止回调。
- 回调仅存在内存中，刷新后失效。普通离页和浏览器后退取消会话并清理；同路径内部 query 跳转保留会话。
- `success/cancel` 返回 `false | Promise<boolean>`，必须 await；返回 false 时业务决定明确的站内 fallback。
- `error` 只通知并清理，不自动后退。可恢复业务错误应留页重试，不必提前完成会话。
- 来源页通常已经卸载，回调不要更新旧实例。钱包回调仅发送全局通知，返回后由新实例读取权威余额。
- 充值页只在服务端确认 paid 且用户点击返回时提交成功结果，不在创建订单或请求返回时假定成功。
- 保留 Link 的原生新窗口/修饰键行为；未注册的旧诊断路由不属于本次迁移范围。

验证入口：`node --test src/components/hg_navigation/*.test.js src/manager_antd/page_modules/user/wallet/*.test.js`。

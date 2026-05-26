# AGENTS.md

## 入口
- 先读本文件，再读 `rules/common.md`；按任务追加 `rules/react.md`、`rules/ios.md`、`rules/go.md`。

## 优先级
1. 用户当前要求
2. 本文件
3. `rules/common.md`
4. 对应工程规则
5. 项目既有实现

## 回复
- 每次回复必须以`[BóYí(๑•̀ㅂ•́)و✧]` 开头

## 项目速览
- React 业务页：`src/manager_antd/page_modules/`，每个模块含 `hg_xxx_page.jsx`、`hg_xxx_vm.jsx`、`hg_xxx.module.css`。
- 请求链路：页面 VM → `src/manager_antd/net_handle/hg_net_manager_vm.jsx` → `src/api/HttpManagerV1.js`；接口常量在 `src/manager_antd/api/hg_api_constants.jsx`。
- 路由：`src/manager_antd/router/`；存储：`src/manager_antd/storage/`；日志：`src/logger/hg_logger.jsx`。
- 工具：`src/utils/`；环境：`.env.debug`、`.env.pre`、`.env.release`。

## Git
- 提交代码或生成 commit message 时，使用全局 skill：`dev_general_skill`。

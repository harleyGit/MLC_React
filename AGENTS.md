# AGENTS.md

## 入口

- 先读本文件，再读 `rules/common.md` 与对应工程规则。

## 全局硬规则

- 仅在当前 workspace 工作；不下载远程代码。
- 改前先看上下文/调用链/相似实现。
- 最小必要改动；不做无关重构；优先复用现有实现并保持行为稳定。
- 规则冲突时取更保守、更兼容、更小改动方案。
- 发现架构问题先简述「问题/建议/收益/风险」，获同意再改。
- 采用主流稳定方案与通行工程实践。
- 不擅改公共接口、对外字段、错误语义、响应结构。
- 不擅自新增第三方依赖。
- 新增/修改方法、函数、关键变量必须补注释（职责、边界、关键约束）。
- 改后必须自检；有条件就编译/测试/lint；未执行不得声称通过。
- 不在仓库保留缓存、日志、构建产物、临时文件。
- 非必要条件下，禁止使用三方组件，若是必须要，必须向开发者询问。

## 命名与目录规范

- **`hg_` 前缀**：所有新建的文件、文件夹、CSS 文件、JSX 文件、类组件必须以 `hg_` 开头。
- **组件目录**：新建组件统一放在 `src/components/` 下，每个组件单独建文件夹（如 `src/components/hg_button/`），内含 `hg_xxx_page.jsx`、`hg_xxx.module.css`。
- **图标资源**：组件图标（SVG）放在 `src/manager_antd/components/hg_icon/svg/`。
- **图片资源**：工程中图片放在 `src/assets/`。
- 组件需提供与 antd 相近的 props 接口，便于页面迁移。

## 项目架构与分层

### 页面模块（业务页面）

- 位置：`src/manager_antd/page_modules/`
- 每个功能模块单独建文件夹（如 `operation_management/`），内含：
  - `hg_xxx_page.jsx` — 视图层（类组件，负责 UI 渲染与用户交互）
  - `hg_xxx_vm.jsx` — 视图模型层（负责网络请求、数据处理、状态管理）
  - `hg_xxx.module.css` — 样式文件

### 网络请求层

调用链路：`页面 VM → hg_net_manager_vm → HttpManagerV1`

1. **接口常量**：`src/manager_antd/api/hg_api_constants.jsx`
   - 统一定义所有 API 路径常量（`HGMANAGER_API` 对象）
2. **网络管理 ViewModel**：`src/manager_antd/net_handle/hg_net_manager_vm.jsx`
   - 继承 `HttpManagerV1`，封装具体业务接口方法（如 `getUserProfile`、`postUserLogin`）
   - 单例导出 `HGNet`，页面 VM 直接调用
3. **底层请求库**：`src/api/HttpManagerV1.js`
   - 基于 `fetch` 封装，支持签名、鉴权、Token 刷新、错误处理
   - 统一处理 HTTP 状态码与业务码映射

### 路由

- 位置：`src/manager_antd/router/`
  - `hg_router.jsx` — 路由配置与页面映射
  - `hg_router_path.jsx` — 路由路径常量
  - `hg_naviagion_hook.jsx` — 导航 Hook

### 本地存储

- 位置：`src/manager_antd/storage/`
  - `hg_storage.jsx` — 通用本地存储封装
  - `hg_user_profile_storage.jsx` — 用户资料存储

### 工具类

- 位置：`src/utils/`
  - `HGAssetUtils.jsx` — 资源工具（图片、视频等）
  - `HGEnvLogger.jsx` — 环境日志
  - `SystemInfoUtil.js` — 系统信息工具
  - `TimeUtils.js` — 时间工具
  - `toast/` — Toast 工具
  - `VideoPlayUtil.jsx` — 视频播放工具
  - `WithRouter.jsx` — 路由 HOC

### 日志

- 位置：`src/logger/hg_logger.jsx`
- 导出 `LogOut`（调试日志）和 `LogError`（错误日志）
- 开发环境全量输出，预发布环境 INFO 及以上，生产环境仅 ERROR

### 环境配置

- `.env.debug` — 开发环境配置
- `.env.pre` — 预发布环境配置
- `.env.release` — 生产环境配置

## 任务优先级

1. 用户当前要求
2. 本文件“全局硬规则”
3. 本文件其他规则
4. `rules/common.md`
5. 工程类型规则（React/iOS/Go）
6. 项目既有实现

## 规则加载

- 所有任务加载：`rules/common.md`
- React 追加：`rules/react.md`
- iOS 追加：`rules/ios.md`
- Go 追加：`rules/go.md`

## 默认流程

1. 读任务与规则
2. 查上下文/调用链/相似实现
3. 按最小改动实施
4. 自检并尽量执行编译/测试/lint
5. 真实说明改动、原因、影响、验证结果

## React 补充

- 保持现有组件结构、路由、状态流、接口调用方式。
- 不为"更优雅"改变业务逻辑、props 契约、接口字段、页面交互。
- 先修正确性，再做结构/性能优化。
- 请求层、签名、鉴权、错误处理改动需与后端行为对齐。
- 验证优先：`npm run dev`；构建：`npm run build:pre` / `npm run build:release`。
- 默认使用类组件；仅非常简单、无复杂业务状态组件可用函数组件。
- 类组件中复杂 JSX 必须拆为 `renderXxx()` 方法；方法需注明职责、输入与关键约束。
- 组件文件与业务逻辑文件统一使用 `.jsx` 后缀。
- 优先使用 React 原生 API 实现；仅在确有必要时引入第三方库。
- **不使用 antd 等第三方 UI 库**，所有 UI 组件均在 `src/components/` 下自建。
  - 每个自建组件单独建文件夹（如 `components/hg_button/`），内含 `xxx_page.jsx`、`xxx.module.css`。
  - 组件需提供与 antd 相近的 props 接口，便于页面迁移。

## 详细解题思路如下

每次修改和改进应包含：

- **问题定位**：明确要解决什么问题
- **方案选择**：为什么选择这个方案（考虑稳定性、性能、可维护性）
- **实现细节**：具体做了什么改动
- **影响范围**：改动影响了哪些模块/接口
- **验证结果**：如何验证改动正确性

## 输出要求

每次任务完成后，按以下格式输出（固定 1~7 项）：

### 1. 修改了哪些文件

- 写真实文件路径；无改动写"未修改文件"

### 2. 做了什么改动

- 简述具体修改内容（新增/删除/修改了什么）

### 3. 为什么这样改

- 说明改动原因和设计决策

### 4. 准确性检查结果

- 列出实际执行的检查（lint/编译/测试）及结果
- 未执行需说明原因

### 5. 潜在影响

- 说明改动可能影响的范围和风险

### 6. 格式化/编译/测试说明

- 列出执行的具体命令和结果
- 未执行写原因

### 7. 后续优化建议（可选）

- 按收益排序，列出可选的优化点

### 要求

- 输出必须真实、具体、可核对
- 不得把理论可行说成已验证通过

## Git Commit 规范

- 使用全局 skill：`dev_general_skill`。
- 提交代码或生成 commit message 时，以该 skill 中的 Git Commit Convention 为准。

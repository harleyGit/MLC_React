# MLC_React 工程规则

## 项目与规则入口
- 本项目是 MLC Web 前端，包含管理后台、视频与弹幕、采集平台及诊断页面。
- React 任务按需使用 `react`；实施与重构使用 `engineering-workflow`，安全相关使用 `security`，验证使用 `testing`，审查使用 `code-review`。不在本仓库复制这些通用方法。
- 输出与提交参照 `dev_general_skill`；未发现该技能时读取 `~/HGFiles/GitHub/AITools/Skills/dev_general_skill/SKILL.md`。
- 跨语言任务须先获得目标仓库授权、读取其根 `AGENTS.md`，再按需使用对应语言技能，不从 React 规则推导 Go 构建范围或 iOS 设备限制。

## 版本与关键依赖
- React / React DOM `^19.1.0`、React Router DOM `^7.5.3`；源码使用 JavaScript/JSX、ES modules、CSS Modules，也保留既有普通 CSS。
- `package.json` 声明 Vite `^7.1.2`，使用 `@vitejs/plugin-react-swc` 与 ESLint flat config；精确版本以 `package-lock.json` 为准，不擅自升级。启动与测试以现有脚本为准，不因依赖含 `react-scripts` 就使用 CRA 命令。
- `.nvmrc` 指定 Node `20.19.0`。dev/build/preview 脚本在 PATH 前追加 `$HOME/.nvm/versions/node/v20.19.0/bin`；lint 不覆盖 PATH，执行前检查实际 Node 版本。
- 请求主链使用浏览器 `fetch`，不能因依赖中有 Axios 就改写请求层。

## 目录与架构
- 入口：`src/main.jsx` 使用 `createRoot` 挂载 `src/App.jsx`；App 为类组件，通过 `RouterProvider` 加载 `src/manager_antd/router/hg_router.jsx`。
- 路由采用 `createBrowserRouter`、鉴权守卫及部分 `lazy`/`Suspense` 页面；`src/manager_antd/router/hg_naviagion_hook.jsx` 的 `WithNavigation` 为类组件注入路由能力，沿用既有适配方式。
- 管理页位于 `src/manager_antd/page_modules/`，按页面 `hg_xxx_page.jsx`、业务 VM `hg_xxx_vm.jsx`、样式 `hg_xxx.module.css` 分层。视频、采集等其他页面也在 `src/pages/`，不擅自迁移。
- 管理请求主链：页面 VM -> `src/manager_antd/net_handle/hg_net_manager_vm.jsx` -> `src/api/hg_net_manager.jsx` -> `src/api/HttpManagerV1.js`。接口常量位于 `src/manager_antd/api/hg_api_constants.jsx`；其他业务 API 保留各自已有封装。
- 鉴权在 `src/manager_antd/auth/`，存储在 `src/manager_antd/storage/`，日志在 `src/logger/hg_logger.jsx`，工具在 `src/utils/`。
- 新组件放 `src/components/hg_xxx/`；组件 SVG 在 `src/components/hg_icon/svg/`，不是 `src/manager_antd/components/`。页面 SVG 在 `src/assets/icons/` 并通过 import 引入，图片在 `src/assets/`。

## 命名与组件约束
- 默认使用 React Class Component，仅非常简单且无复杂业务状态的组件可使用函数组件。不主动把既有类组件改为函数组件或 hooks；既有函数组件和路由适配器也不批量反向迁移。
- 新增目录、组件与业务文件沿用 `hg_` 前缀和 `.jsx` 后缀，样式使用 `.module.css`；现有纯函数 `.js` 与 `.test.js` 不批量改名。
- React 组件类/JSX 标识符使用 `HGXxx` 大写形式，如 `HGTestModulePage`，不能改为小写 `hg_xxx` 导致 JSX 被识别为原生标签。
- 复杂 JSX 不得集中写在 `render()` 中；按页面职责拆分为 `renderXxx()` 方法（例如页头、卡片、列表和空态），由 `render()` 负责组装调用，保持页面与 VM 职责、路由、状态流、请求方式和 props 契约稳定。
- 不引入 antd 等第三方 UI 库，优先 React 原生 API 和现有自建组件；目录名 `manager_antd` 不代表允许新增 antd。自建组件提供与 antd 相近的 props，同时保留已有契约。

## 工作边界与禁止事项
- 仅在当前 workspace 及用户明确授权范围工作，不下载远程代码；不得擅自新增第三方依赖或组件。架构调整须先说明问题、建议、收益、风险并获同意。
- 中文解释和注释，源码标识符与系统 API 保持英文。
- 新增或修改方法、函数及关键变量的注释说明职责、边界与关键约束，避免复述显而易见的语句。通用设计原则按 `engineering-workflow`；保留本项目对组合层级避免超过两层的偏好，不因此重构无关代码。
- 请求签名、鉴权及错误处理须对齐后端，使用既有日志组件；`.env.debug`、`.env.pre`、`.env.release` 的存在不授权读取或披露凭据，安全检查引用 `security`。
- 不保留或提交本次新增的缓存、日志、构建产物、临时文件；不擅自清理已有内容或回滚他人改动。

## 启动与代理
- 开发：`npm run dev`；其他环境：`npm run dev:pre`、`npm run dev:release`，分别使用 debug/pre/release 模式。release 模式开发服务不是生产部署。
- `vite.config.js` 指定端口 `5174`、`strictPort: true`。主 API `/api/v1` 和上传资源转到本机 `8080`，弹幕 WebSocket `/api/v1/video_danmaku/ws` 转到 `8081`，`/api/v1/crawler` 转到 `8090`；具体路径必须先于泛化路径匹配。
- `proxy_until.js` 提供域名诊断中间件及代理；部分代理会访问外部服务，不能把启动或诊断视为纯本地只读检查。
- 预览：`npm run preview`。dev/preview 带 `--host`，会启动可经网络访问的服务，执行前确认使用场景。

## 测试与构建
- 差异检查：`git diff --check`；lint：`npm run lint`。按本次变更范围选择验证，不把既有全库问题混为本次回归。
- 已有 Node 纯函数测试入口示例：`node --test src/api/hg_api_url.test.js`。项目没有统一 `npm test`；`*.test.jsx` 中还有 Jest 风格 `expect` 测试，不能直接交给 Node 测试运行器或声称已覆盖。
- 构建：`npm run build:pre` / `npm run build:release`；没有 `npm run build`。构建会写入 `dist/`，不提交生成内容。
- 只读任务不安装依赖、不启动服务、不运行写入式构建或初始化脚本；开发服务器启动不等于功能通过。实际验证范围、失败与未执行原因按 `testing` 如实说明。

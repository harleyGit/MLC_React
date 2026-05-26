# react.md

## 结构
- 保持现有组件结构、路由、状态流、接口调用方式。
- 页面模块放 `src/manager_antd/page_modules/`，包含 `hg_xxx_page.jsx`、`hg_xxx_vm.jsx`、`hg_xxx.module.css`。
- 新建组件放 `src/components/hg_xxx/`，文件/文件夹/CSS/JSX/类组件均以 `hg_` 开头。
- 组件图标 SVG 放 `src/manager_antd/components/hg_icon/svg/`；页面 SVG 放 `src/assets/icons/` 并通过 import 引入；图片放 `src/assets/`。

## 代码
- 默认使用类组件；仅非常简单、无复杂业务状态组件可用函数组件。
- 类组件中复杂 JSX 拆分到 `renderXxx()` 方法，并注明职责、输入、关键约束。
- 组件与业务逻辑文件统一使用 `.jsx` 后缀。
- 不为“更优雅”改变业务逻辑、props 契约、接口字段或页面交互。
- 请求层、签名、鉴权、错误处理改动必须与后端行为对齐。
- 优先使用 React 原生 API；不使用 antd 等第三方 UI 库。
- 自建组件需提供与 antd 相近的 props 接口，便于页面迁移。

## 检查
- 验证优先：`npm run dev`。
- 构建优先：`npm run build:pre` / `npm run build:release`。
- 有条件执行 lint；未执行需说明原因。

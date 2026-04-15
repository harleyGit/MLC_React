# react.md

## 技术栈约束
- 使用函数组件 + Hooks
- TypeScript 必须有明确类型定义
- 组件拆分不超过 300 行

## 修改要求
- 不改业务逻辑，仅优化结构
- 保持 props 兼容
- 禁止新增状态管理库

## 修改后检查
- npm run build
- npm run lint

## 常见优化
- useMemo / useCallback 优化性能
- 避免重复渲染

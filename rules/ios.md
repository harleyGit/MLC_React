# ios.md

## iOS
- 遵循 Swift API Design Guidelines
- 保持现有 public API、delegate、protocol、extension 结构稳定
- 属性访问控制合理

## 命名
- 方法：动词开头
- 属性：名词
- 枚举：大驼峰

## 实践
- 优先用 `guard` 提升可读性
- 优先用计算属性复用简单逻辑
- 复杂 UI、业务逻辑、IO 分层处理，避免 ViewController 承担过多职责

## 检查
- 有条件优先执行 `xcodebuild`
- 目标是无 warning

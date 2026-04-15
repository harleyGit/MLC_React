# ios.md

## 代码风格
- 遵循 Swift API Design Guidelines
- 属性访问控制合理（private / internal / public）

## 修改约束
- 不改变 public API
- 优先使用 extension
- 保持 delegate / protocol 结构

## 命名规范
- 方法：动词开头
- 属性：名词
- 枚举：大驼峰

## 修改后检查
- xcodebuild 编译检查
- 无 warning

## 推荐实践
- 计算属性替代重复逻辑
- 使用 guard 提升可读性

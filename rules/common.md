# common.md

## 文件操作限制
- 只允许修改 `.go`, `.swift`, `.ts`, `.tsx`, `.js` 文件
- 禁止删除文件
- 单次修改不超过 3 个文件

## 命令执行限制
- 禁止：rm / mv / chmod / curl / wget / git push / npm publish
- 允许（需确认）：go build / npm install / xcodebuild / swift build

## 网络限制
- 默认禁止联网
- 不允许下载远程代码

## 风险操作处理
- 涉及删除或修改核心逻辑必须先询问用户

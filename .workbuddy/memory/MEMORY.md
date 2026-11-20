# MLC_React 项目长期记忆

## 用户交互约定
- 增删改查交互约定（2026-11-20 用户明确要求）：所有类似的增删改查功能，全部操作（含查询）必须由用户显式点击按钮触发执行，禁止自动加载、自动提交、订阅自动刷新等隐式执行；每次操作结果通过提示文案反馈，列表展示点击查询时刻的数据快照。参考实现：`src/manager_antd/page_modules/test_module/hg_local_db_test_page.jsx` 数据管理面板（存储数据 / 查询列表 / 编辑→保存修改 / 删除 均为按钮触发）。

## 本地数据库存储系统
- `src/infrastructure`（database/storage/realtime/sync）+ `src/modules`（六个 Repository）+ `src/hooks` 三层结构，方案文档 `docs/本地数据库存储技术.md`；浏览器端全量测试页在测试模块「数据 > 本地数据库测试」（`/test?menu=local_database_test`），用例定义在 `hg_local_db_test_cases.js`。
- 测试页第 2 项用例与「清空本地数据库」按钮会整库删除重建 MLC_CLIENT_DB，手动录入数据会被清除。
- 密码等敏感字段仅在测试页演示存储，真实业务禁止明文入库（Token 走 HttpOnly Cookie，验证码只存脱敏元数据）。

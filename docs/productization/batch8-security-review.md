# Batch8 累计安全回归核查

测试代码基线：Batch7 `42edc878aa8a754713f2b857db4e835e3ebe6999`。本批没有修改授权或业务代码。

## 实际执行

在隔离 PostgreSQL 17.7、合成数据和本地 HTTP API 上执行以下专项：

- `sec010-http-postgres.integration.test.ts`：3 项。
- `risk-replay-http-postgres.integration.test.ts`：19 项。
- `commission-postgres.integration.test.ts`：8 项。
- `foundation-postgres.integration.test.ts`：10 项。
- `authorization-http-postgres.integration.test.ts`：19 项。

合计 **59/59 通过**。覆盖当前授权、数据范围缩小、跨公司/跨组织拒绝、撤权后重放、不同用户幂等键、敏感字段投影、事务失败和重复副作用检查。完整 CI 后续仍需绑定 Batch8 最终 SHA。

## 结论矩阵

| 范围               | 当前证据                            | 结论                                            |
| ------------------ | ----------------------------------- | ----------------------------------------------- |
| 风险评价/任务重放  | risk replay HTTP/PG 19 项           | 当前授权在幂等命中前重新检查；无新可达绕过      |
| 佣金重放和任务事件 | commission PG 8 项                  | owner/TEAM 范围和旧事件隔离保持；无重复证据写入 |
| 业务文档历史回执   | foundation PG 与 authorization HTTP | 撤权、范围变化和历史回执不泄露受保护内容        |
| 跨组织/跨公司      | authorization HTTP、scope SQL 回归  | 服务端拒绝，不能由前端隐藏替代                  |
| 审计与幂等副作用   | 事务失败、重复请求场景              | 失败不产生成功审计或额外业务写入                |

这是受影响测试和主控源码核查的结论，不等同于真实岗位人工验收。未发现新的 P0/P1 可达授权缺陷；生产旧版仍未包含 Batch1—6 修复，生产风险保持 INT-001/P1。

## 后续门禁

最终候选必须再次运行完整 `pnpm ci:local`，并在同一 SHA 上完成原 P1 浏览器双轮。若远程候选改变身份、DataScope、数据库配置或历史对象合同，必须重新执行本矩阵。

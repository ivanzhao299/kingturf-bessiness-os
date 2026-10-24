# Harness 竣工常驻契约自检（2026-10-21）

本检查假定施工图已归档，只使用 `AGENTS.md`、`docs/design-docs/core-beliefs.md`、`ARCHITECTURE.md`、`docs/CI.md`、`docs/GATES.md`、`docs/QUALITY_SCORE.md` 及 ADR。结果为通过：

| 项目                       | 结论 | 证据                                                       |
| -------------------------- | ---- | ---------------------------------------------------------- |
| 单向依赖                   | 通过 | `ARCHITECTURE.md` §1、§5 与 `service:check`/结构门禁       |
| R1/R2 行为守恒与显式登记   | 通过 | `core-beliefs.md` 竣工契约；台账逐项入口                   |
| SQL 参数化与 G3 可信根     | 通过 | `docs/GATES.md` structure:check 规则                       |
| 不透明会话                 | 通过 | ADR-0003 与常驻架构说明                                    |
| 单一职责与 `[已测试]` 标注 | 通过 | `AGENTS.md` 硬性约束、提交历史与完整 CI                    |
| prompt-history 纪律        | 通过 | `AGENTS.md`：只追加、不读取、不入库                        |
| 文档索引与链接             | 通过 | `docs/index.md`、`doc:lint`                                |
| 覆盖率分母/豁免期限        | 通过 | `docs/GATES.md` 与 `QUALITY_SCORE.md` 固定分母、到期硬失败 |
| CSP 强制化边界             | 通过 | `core-beliefs.md`：须另行登记授权，不由归档隐式改变        |
| 施工状态转换               | 通过 | 归档计划 §14、本文及收官报告                               |

`AGENTS.md` 当前 87 行，低于 200 行地图上限；所有常驻入口均可由索引到达。归档后完整 `pnpm ci:local` 仍是提交硬门禁。

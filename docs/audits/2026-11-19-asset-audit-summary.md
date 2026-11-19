# A 系列资产审计总录 — 2026-11-19

> 第七次人裁配套：对「不动层」做全量行业基准审计（OWASP ASVS v4.0.3 / NIST 800-63B / NIST SSDF 800-218 / SLSA / GitHub 加固最佳实践）。四份分报告见本目录 A1-A4。审计为只读，主协调派四个并行审计代理执行。

## 总结论

- **代码层零 P0**（无注入、无跨租户越权、无未认证业务面）
- **唯一 P0：GitHub 平台配置**——main 无分支保护、production environment 无审批人（`docs/evidence/GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md` 早已审计并建议，从未落地）；全部 workflow 级自检的信任根悬空于此
- 台账两项过期：TD-SEC-008、TD-RISK-001 实际已于 2026-10-26（f7397a4/cc6905e）修复，应关闭
- 资产判定复核：opaque token+CSRF 体系、谓词单点收敛+对拍、outbox 工程、双 SHA 控制面、真还原演练、dump 保护契约、ci:local 单一真源、coverage 防伪机制——**确认保留并推广**

## 修复批次规划（A-F 系列）

| 批   | 内容                                                                                                                                                                                                                          | 载体                                                      |
| ---- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| A-F0 | 平台配置（仅管理员可做）：main 禁 force-push/删除；secret scanning+push protection；Dependabot 警报。**挂起（2026-11-19 所有者裁定：待仓库迁移自部署 Git 触发；残余风险=单操作者委托模式+第三方管理员信任假设，已知情接受）** | GitHub 设置（清单见 A3/A4 报告）；dependabot.yml 仓库文件 |
| A-F1 | 快赢批：identity 开通端点原子权限+assign 保留码拒绝、calendarDate 回验、UUID 小写归一、四处非原子审计双写、.env.production 权限断言、staged 目录私有根+竞态收口、audit-scan 接线 ci:local、workflow 卫生、文档漂移            | 执行会话                                                  |
| A-F2 | 安全纵深批：持久登录锁定+限流审计、profiles 字段投影、complaint/dashboard TEAM depth、通知收件人 validate、last_seen_at 空闲超时、弱口令黑名单、HSTS+nginx 登录限流（含 recover 脚本 hash 同步）                              | 执行会话                                                  |
| A-F3 | 供应链批：actions SHA 钉扎、CodeQL、镜像 trivy+SBOM+provenance（cosign keyless）、PR 依赖审查                                                                                                                                 | 执行会话                                                  |
| A-F4 | 大项批（随 U3 波次）：SoD 自定义角色、会话治理端点、authorization:manage 退场（需人裁）、RLS ADR、N+1 清偿                                                                                                                    | 执行会话+裁定                                             |

## 分报告

- [A1 SQL/DataScope 仓储](a1-sql-datascope-repositories.md)：无注入绕过路径；P1=complaint/dashboard TEAM 无 depth（横向越读）；P2=通知 skip/四处非原子双写/谓词形状矩阵；P3=calendarDate/UUID/N+1/RLS 决策
- [A2 认证/会话/授权/审计](a2-authn-authz-audit.md)：opaque token 体系确认为最扎实资产；P1=登录爆破仅进程内；P2=profiles 字段绕过/SoD 仅 KT\_/authorization:manage 架空/无空闲超时/弱口令黑名单缺失
- [A3 CI 门禁与供应链](a3-ci-supply-chain.md)：门禁自防御超主流但平台配置零落地（P0）；P1=SHA 钉扎缺失/无 SAST/镜像无扫描无 SBOM/密钥扫描未接线
- [A4 发布安全契约](a4-release-security-contracts.md)：制品完整性达 SLSA L2/L3 等效（除签名）；P0=environment 审批未配置；P1=.env 权限断言/HSTS/cosign 签名；P2=staged 竞态/docker root 等价/告警缺失

## 仓库迁移就绪清单（P0-1 挂起项，迁移至自部署 Git 时一次性执行）

> 2026-11-19 项目所有者裁定：GitHub 平台设置因当前账号非管理员挂起，迁移触发即按本清单一并落地。

**平台安全配置（A3/A4 汇总）**：①main 分支保护（禁 force-push/删除、必过 CI）②secret scanning + push protection ③Dependabot 警报开启（仓库文件 dependabot.yml 已就位）④production environment 审批人配置 ⑤actions 全量 SHA 钉扎（A-F3 承接）⑥SAST（CodeQL 或等价）与镜像扫描/SBOM/provenance 接线（A-F3）。

**迁移工作流注意项**：GitHub Actions→自托管 runner/Gitea Actions 兼容评估（workflow_dispatch/并发组/environment 语义差异）；GHCR→自托管 registry（发布契约 digest 五元组溯源与 skopeo 复验步骤适配）；canonical origin URL 与 `gh api` 溯源调用替换；known_hosts 钉扎与 secrets 在新平台重建；恢复双 SHA 控制面字节绑定重签。

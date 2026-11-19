# A3 审计：CI 门禁链与供应链 — 2026-11-19

基准：GitHub Actions 加固指南、NIST SSDF v1.1、主流开源 CI 水准。

## 结论

- **代码内门禁自防御维度显著高于一般项目**（防绕过/防伪证/防回退密集且真实）
- **平台配置维度零落地**（P0）；**行业基准扫描维度缺口**（SAST/镜像/SBOM/密钥扫描接线）

## P0-1：分支保护与 production 审批未实施（单点平台级绕过）

> **2026-11-19 挂起裁定**：待仓库迁移自部署 Git 触发时随《迁移就绪清单》（总录）一并执行；残余风险=单操作者委托模式+第三方管理员信任假设，所有者已知情接受。

main protected=false、rulesets=[]、production environment protection_rules=[]（GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md:15，至今无后续落地记录）。所有 workflow 自防御建立在「main 历史可信」上；文档自认（PRODUCTION_PARK_HOST.md:42）。**修复（管理员设置，约 0.5-1h）**：main ruleset=required status check `quality`+禁 force-push/删除；Actions 默认 token 只读确认；production environment 建议配 reviewer+分支限 main（注：reviewer 会给每次生产发布加人工审批点，与项目所有者已授权主协调全权发布冲突——是否启用由所有者定夺）。

## 其余发现

- **P1-2**：43 处 `uses` 全 tag 钉扎零 SHA 钉扎；webfactory/ssh-agent（收生产私钥）与 docker/build-push 为第三方。修复：全量改 full SHA+dependabot github-actions 生态自动跟进，1-2h。
- **P1-3**：无 SAST。修复：CodeQL Default Setup（codeql.yml，TS+actions），2-4h。
- **P1-4**：发布镜像无 CVE 扫描/SBOM/provenance attestation。修复：build-push 加 sbom+provenance=max+id-token、trivy HIGH+ 拦截，0.5-1 天。
- **P1-5**：audit-scan.mjs（密钥 regex+.env 跟踪检查）存在但未接任何 script/CI=纸面资产。修复：GitHub 开 secret scanning+push protection（设置）+audit-scan 接入 ci:local（0.5h）。
- **P2-6**：依赖供应链单点——无 Dependabot/PR 端审查/--prod 不审 dev。修复：dependabot.yml+dependency-review-action+去掉 --prod，1-2h。
- **P2-7**：G1/G2/G3 豁免 due 为文本批次无机器到期（G5/coverage 有日期强制）。修复：迁移 until-YYYY-MM-DD 机制，2-4h。
- **P2-8**：service-boundary-gate 以文件名正则圈域，命名外文件逃逸。修复：import 图反向推导或登记规则，0.5-1 天。
- **P2-9**：workflow 卫生——recover verify 无 timeout、ci.yml checkout 无 persist-credentials:false、node 版本钉扎不一致（24.13.0 vs 24）。15 分钟。
- **P3-10/11**：文档漂移（PRODUCTION_PARK_HOST 指向已封闭入口/迁移数 70→74/GATES 13 步旧编号）；无 CODEOWNERS；建议删除已封闭 deploy-production.yml。

## 资产判定

**真实资产（保留+对外介绍）**：ci:local 单一真源零漂移架构；coverage 门禁全链（基线 sha256 钉扎+三阈值+run manifest 防伪+双写豁免带人类审批与自动到期，当前 0 活动豁免）；G5 豁免表按时结清；发布控制流（双 SHA+canonical 校验+控制脚本字节绑定+互斥锁+digest 交叉核对）；门禁自测试文化（每个 gate 有 \*.test.mjs）。
**纸面资产（不计入防御）**：分支保护（未应用）；audit-scan（未接线）；--report 软化模式（CI 未用）。

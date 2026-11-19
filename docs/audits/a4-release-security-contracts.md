# A4 审计：发布与部署安全契约 — 2026-11-19

基准：NIST SSDF 800-218 / SLSA / GitHub Environments 最佳实践。

## 总评：制品完整性与控制流严谨度达 SLSA Build L2/L3 等效强度（除签名外）；最薄弱一环在 GitHub 平台侧治理配置，且是唯一 0.5 小时可消除的最高风险项。

## 制品完整性：digest 钉扎链 TOCTOU 分析——链路无窗口（合格）

构建 tag+digest 自检→run 溯源（gh api 五元组）→tag 现势复验（skopeo --raw）→**按 digest 不可变引用拉取（不经过 tag）**→逐 descriptor 全量校验（拒 symlink/外部 URL blob）→tar sha256 绑定→导入后运行时身份复验（diff_ids+config 原始字节）。协作者重推同名 tag 只会导致 fail-closed（DoS 非注入）。信任根=main 历史+dispatch 输入正确（见 P0-1）。

## 发现

- **P0-1**：production environment 无审批人+main 无保护

> **2026-11-19 挂起裁定**：待仓库迁移自部署 Git 触发时随《迁移就绪清单》（总录）一并执行；残余风险=单操作者委托模式+第三方管理员信任假设，所有者已知情接受。——双 SHA/溯源自检信任根悬空（证据 GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md:15）。修复：管理员 0.5h 配置；仓库侧契约已为此预备好。

- **P1-1**：无 cosign 签名/SLSA provenance 验证/SBOM（buildx 默认附 provenance 但恢复链从不验证）。多协作者场景无法区分官方构建与协作者合法 dispatch 构建。修复：id-token+cosign keyless 签名/验证+syft SBOM，1-2 天。
- **P1-2**：.env.production 权限无机器强制（含三秘密；apply_migrations.py:168,336 write_text 继承既有 inode 权限）。修复：preflight 断言 mode≤0600+写后 chmod，0.5h。
- **P1-3**：nginx 无 HSTS（唯一对外 HTTPS 入口）。修复：加 header+主机同步审批（recover 脚本 hash 钉扎会拦截未同步变更——有意的门），0.5h。
- **P2-1**：SSH 用户 docker 组=root 等价+三项目共享主机。修复：sudoers 白名单 wrapper 或受控容器执行，1-2 天（可分期）。
- **P2-2**：staged 目录 /tmp mkdir 竞态+检查-执行 TOCTOU（apply-migrations.yml:133-138；dispose rm 竞态）——前提苛刻（本地账户+可预测 RUN_ID）但修复廉价：staged 根改私有前缀+mkdir 后断言 700/属主+rm 前 lstat 复检，2h。
- **P2-3**：RECOVERY_FAILED 无外发告警；附件只备份不演练还原；无 off-host 备份。修复：webhook 0.5h+附件演练 0.5 天+off-host 加密转储 1-2 天。
- **P2-4**：nginx 层无限流（登录爆破仅应用层）。limit_req_zone 于 /api/auth/login，1-2h。
- **P3**：registry serve 常驻入口加自毁定时；server_tokens；TLS 语义探测；删除已封闭 deploy-production.yml；attachments tar 跟随 symlink（低危）；authorization.json 单操作者硬编码（多操作者后换会话票据）；write_state 无 fsync（重跑语义仍安全）。

## 资产判定（七项特色，保留并作为亮点）

①离线 OCI 传输契约（不落凭据/全哈希/Docker29 语义坑处理）②双 SHA 控制面+生产锁后复验 ③每次发布真还原演练（无网络 tmpfs PG 真还原——多数组织只敢季度做）④迁移「读一次、验执同字节」+advisory lock+静默探针 ⑤dump 保护+单向失败语义（绿跑=迁移完成）⑥write fence+handover 状态机（停机窗口一等公民建模）⑦known_hosts 四 workflow 同构钉扎+指纹溯源入仓。

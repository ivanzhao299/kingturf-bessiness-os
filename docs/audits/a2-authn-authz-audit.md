# A2 审计：认证/会话/授权/审计 — 2026-11-19

基准：OWASP ASVS v4.0.3 第 2/3/4/7 章 + NIST SP 800-63B。逐项对照+22 端点 default-deny 抽验+水平越权抽样。

## 结论：无 P0；opaque token 与 CSRF/通道配套为全库最扎实安全资产（逐行验证确认）

## ASVS 对照要点

**PASS（超出/达标）**：密码长度 12+scrypt 参数化+timingSafeEqual（2.1）；限流先于凭证校验+dummy scrypt 反枚举+统一 401（2.2.2/2.2.4）；must_change 服务端门完整无绕过（2.5.5/6，app.ts:204-216 三端点白名单位于全部分发之前）；token 256-bit CSPRNG+keyed-SHA256 存储+\_\_Host- cookie+Secure/HttpOnly/SameSite（3.1/3.4）；登录新 token 防固定+改密全量吊销（3.2.1）；CSRF 三重闸 Origin+HMAC 双提交+generation 绑定+常量时间（3.2.4/3.3）；default-deny 22 端点全覆盖+操作级+水平越权抽样未发现（4.1/4.2/4.3）；审计不可变触发器+同事务双写+内容四要素+元数据过滤（7.1/7.2/7.3）。

## 发现（11 项）

- **F1/P1**：登录防爆破仅进程内滑窗（login-rate-limit.ts:12 Map 桶）——重启/扩容失效、退避封顶 1s、无持久锁定、429 不入审计。修复：failed_attempts+locked_until 持久化+审计，1-2 天。
- **F2/P2**：user-access-profiles 故意绕过字段授权（identity-access.ts:44 注释自认）返回完整身份画像。修复：permittedDto 投影，0.5 天。
- **F3/P2**：SoD 触发器与应用层均只拦 KT\_% 编码（0047:27 早退）——自定义角色零检查。修复：改冲突表驱动+sod_group，1-2 天。
- **F4/P2**：authorization:manage 粗粒度仍打开全部 IAM 写并架空 0062 原子拆分；开通端点独占粗粒度（dispatch/credentials.ts:21）；既有保留角色可经 assignments 自授（repositories.ts:850-859）。修复：①端点改原子权限 0.5h ②assign 拒绝保留码 0.5 天 ③粗粒度退场需人裁。
- **F5/P2**：last_seen_at 建列后零更新——无空闲超时（遗留项确认未解决）。修复：resolveSession 节流写回+窗口校验，0.5-1 天。
- **F6/P2**：无用户级会话治理端点（仅当前 logout+管理员整体吊销）、无并发上限。修复：GET/DELETE /auth/sessions+上限逐出，1-2 天。
- **F7/P2**：无弱口令/泄露黑名单（NIST SHOULD）。修复：本地 top-N 表+新≠旧+最大长度，0.5-1 天。
- **F8/P3**：429/503 不入审计（随 F1）。
- **F9/P3**：授权调用内联无中心注册表——新路由漏写 authorize 无门禁拦截。修复：structure-gate 断言每 attempt 存在 authorize，1 天。
- **F10/P3**：密码无历史/p.string trim 密码/无 HSTS/审计无保留策略——各 ≤0.5 天。
- **F11/P3**：限流桶耗尽 503 自扰；IPv6 不聚合 /64。

## 遗留未批项真实现状

authorization:manage 部分收敛未关闭（permissions 收归 SYSTEM_ADMIN+roles 拒保留码已做；粗粒度 fallback/开通独占/保留角色自授未做）；SoD 自定义角色未解决；会话治理未解决——与代码一致，非新发现。

## 资产判定（保留并推广）

token 本体设计、CSRF 三件套（域分隔 HMAC+长度前缀+常量时间）、通道分离纪律（cookie/机器/摄取三通道互斥）、反枚举时序均衡、租户五重有效态 SQL 校验、审计不可变+同事务双写、MUST_CHANGE 门、外围闸（write-fence/HMAC 摄取/头白名单）。

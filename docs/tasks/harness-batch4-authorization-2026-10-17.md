# 阶段4·批次4 D1安全加固实施授权（R7）

2026-10-17人工正式授权，原始人工消息已只读核实；方案于2026-10-13批准，当前基线harnessing `64757d4`、干净工作树，批次1/2（含E1）/3均已人工验收。本授权独立docs提交，未开始业务修改；后续各项分别独立行为提交、台账关联、前后行为/测试期望变更清单、验证和回滚点，不混纯重构（R2/R7）。本执行步只实施S1，最终SHA/日志交协调独立审查后由协调续派，不重复向人类索取已授许可；不是批次4人工验收。

## 顺序与边界

1. **S1 / TD-SEC-004**：API统一响应中间件加与仓库nginx一致的`X-Content-Type-Options: nosniff`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy: strict-origin-when-cross-origin`。正常/404/500新增app.test断言，错误响应也覆盖；其它旧行为/断言冻结。
2. **S2 / TD-SEC-002**：账户与IP独立维度内存滑窗，10次失败/15分钟、429与渐进退避；parseEnvironment配置与默认值/.env.example（明确允许packages/config，不扩大其它packages），无Redis/新依赖。新增窗口恢复、失败计数不含成功、双维度隔离等测试；核真实受信IP，不盲信可伪造forwarded头；核login-flow预留429文案实际接线。不碰SQL。本执行步尚不实施。
3. **S3 / TD-SEC-001**：API与nginx仓库配置Report-Only及默认关闭的强制开关，self/最小内联放开逐项说明；本地CDP登录→工作台→文档发送链收集违例，如实记录，违例不等于测试失败。区分API响应头与HTML文档策略、Report-Only与强制。强制生产启用不在本批，部署后一发布周期观察并另行人工授权；不得扩生产URL或放宽Chrome安全标志。本执行步尚不实施。
4. **S4 / TD-SEC-003**：只产影响面报告与候选方案后**硬停止等人工确认**。盘entry sessionStorage读写、实际http.ts Bearer、API认证读取、登录恢复/登出/过期/撤销、API与CDP/Playwright会话夹具及verify_p1_demo等非浏览器调用；比较同源双提交/Origin校验等方案。确认前禁止Cookie/CSRF/Origin实现、删sessionStorage、改会话夹具或Bearer兼容。未来Cookie载体设想HttpOnly/Secure/SameSite=Lax不改变ADR0003 opaque token与服务端哈希，禁止JWT。

## 测试与停点

- 新行为新增断言；旧行为消失才显式改期望，每处登记“旧→新→D1依据”。其它既有测试语义冻结。会话夹具若未来S4获授权才逐处映射/变异红绿，不提前适配。
- 各项相关新测试、API/web全量及实际稳定干净HEAD完整`pnpm ci:local`真实0；源码及最终证据HEAD分别验证，禁止运行中修改CI候选。新中间件G1/G2/G3强制，800/200/5阈值不松、不扩G3白名单；函数200另完整审计，不冒称已有全仓AST强制。
- 唯一写入/测试执行者为原执行会话；协调/reviewer只读。所有PG仅串行受guard的回环测试库，不回显连接串/真实密钥token，不读prompt-history。CDP本地独立临时profile/随机端口、严格网络硬闸/清理；不sudo，不引依赖。
- 不push/部署/dispatch/触生产或`.github/workflows/`；nginx仅仓库文件修改不使生产生效。SEC006/007、BOUND003/004、七N+1修复均不纳入。
- 台账SEC001仅Report-Only段完成、强制段待决；002/004按真实证据，003影响报告阶段不关闭。原9个Playwright spec未补跑义务继续保留，阶段5前提供Linux Chrome后补跑；本批不擅自启动阶段5。
- 最终S1–S3及S4报告的最后HEAD全CI0/干净，交人工验收；S4实施必须另获明确确认，不能以影响简单跳过。

## 当前回滚与验证

授权docs可独立revert，基点64757d4；S1源码及证据提交SHA待真实实施后在计划§7记入。当前只运行授权文件格式/文档门禁，提交后实际干净HEAD全CI；不预填成功或关闭任何SEC项。详见[计划](../exec-plans/active/harness-migration.md)、[台账](../exec-plans/tech-debt-tracker.md)、[ADR0003](../adr/0003-opaque-session-authentication.md)、[发布边界](../RELIABILITY.md)。

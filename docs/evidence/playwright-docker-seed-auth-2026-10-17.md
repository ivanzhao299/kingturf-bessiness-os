# Docker P1 种子机器认证适配与 C7 停点（2026-10-17）

**当前停点**：信用500已证本轮owned schema未暴露已装public.pgcrypto，独立环境修正e2c8ce6后信用通过（TD-TEST-010）；原seed随即推进到生产关单500，安全诊断P0001/require_approved_cost_before_close。冻结seed缺实际成本批准业务步骤（TD-TEST-011待决），不属仅认证URL/环境授权，当前停止后继spec/两轮；下文信用C7为初次历史，完整失败史保留。两配置/spec/业务源码/迁移/SQL均未改。

[具体最小待裁方案](../tasks/playwright-p1-cost-seed-proposal-2026-10-17.md)只准备本地owned演示policy/计算/异人批准后继续原close，费率/稳定标识及复用规则明确；未实施，不将增加业务seed假装成fixture环境修正。

## 独立小步范围

基线 `ce74386`（已授回环环境工具），[人类增量裁定](../tasks/playwright-docker-rulings-2026-10-17.md)明确只允许 `scripts/seed_p1_demo.mjs:12` 机器认证URL从 `/api/v1/auth/login` → `/api/v1/auth/token-login`。静态字节不变量实际通过：用父提交源仅替换这一个URL后，与本步完整文件逐字节相同。凭据参数/两身份/Bearer/幂等/全部业务seed步骤与断言均保持；业务源码与两配置/spec均零改。

必要环境工具：`seed-auth.mjs`用TypeScript AST取实际CLI唯一login函数，在VM绑定原变量与真实本地fetch（不是复制URL/伪造响应），真实两身份login→无Cookie Bearer session核员工归属，只报布尔；每请求5s/协作abort。TOKEN_LOGIN_ENABLED由owned API fixture显式true，经原配置解析。预检runner扩seed-auth/seed-full两模式；后者原脚本完整子进程、机密只内存env，seed-audit仅观察真实失败HTTP method/path/status，不改请求/响应；raw stdout/stderr不转发，身份/assertion原文不落日志。容器先原PG READ ONLY同一性证明，宿主才初始化/API/执行seed，完成后通知容器verified-only关闭，不称浏览器spec。

已证seed原文件不在根plain-JS lint组，单独root eslint报type-information错误；仅沿相同原策略加这个精确文件并纳入根lint，与新环境目录接线相同，无规则/阈值/G3/依赖/PW配置改变。root eslint/Prettier均通过，真实hook照常不跳过。

## 实际绑定变异红→还原绿

统一命令：`NODE_ENV=test DATABASE_URL=<private guarded loopback test target> node --experimental-transform-types scripts/e2e-docker/preflight.mjs seed-auth`。真实目标由内存env提供，不打印DSN，不读.env。镜像/网关/owned marker与host/container只读同一性沿[通道证据](playwright-docker-loopback-2026-10-17.md)，不是通过连接串字面伪装guard。

| 检查                       | 实测结果/日志                                                                                                                                         |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| 新URL初绿                  | `/tmp/kingturf-docker-seed-auth-green-2026-10-17.log`：exit0/4770ms；实际CLI函数、两个合成身份、无Cookie机器token/Bearer session均通过                |
| 真实源文件仅URL扰回旧login | `/tmp/kingturf-docker-seed-auth-red-2026-10-17.log`：实际工具exit1/4629ms，phase=seed-auth，绑定断言红；外层变异验证器按“确为1”返回0，不把工具1写成绿 |
| URL立即还原                | `/tmp/kingturf-docker-seed-auth-restored-2026-10-17.log`：exit0/4506ms，原真实绑定再次通过                                                            |
| 最后工具补有界fetch后复核  | `/tmp/kingturf-docker-seed-auth-final-2026-10-17.log`，结果以实际日志为准，不预填未来HEAD完整CI                                                       |

每次owned schema/container/API全部清理；变异未入库。此绑定证明**只认证出口和两身份**，不是完整业务seed绿，也不抵每份Playwright变异或补跑。

最后有界fetch工具实际复核 `/tmp/kingturf-docker-seed-auth-final-2026-10-17.log` 已完成，exit0/5117ms；表中“以实际日志为准”不是仍未跑，也不冒称未来HEAD完整CI。

## 历史C7：完整冻结种子在信用业务阶段失败

上述还原后实际运行同runner的 `seed-full`（完整原seed、仅获准认证URL差异），日志 `/tmp/kingturf-docker-seed-full-restored-2026-10-17.log`：

- host guard/owned marker/容器只读同一性先通过，继而真实API原seed请求。
- **POST /api/v1/credit-decisions → 500**；seed子进程实际exit1/680ms，宿主工具exit1/5050ms，随后schemaGone/containerGone/previewGone均真，后续实际ss和Docker task label无残留。
- `scripts/seed_p1_demo.mjs:329–345` ensureCredit在列表未命中后创建信用决策；依赖此前quote revision/issued snapshot（258–312）和credit limit（314–327），审批346–352及后继未到达。不是机器登录失败，不修改业务步骤使其绿。
- 只读独立核验锚点：`apps/api/src/routes/qtc-credit-writes.ts:97–135` 进入信用评估路径，`apps/api/src/qtc-repositories.ts:198–305` 相关事务/报价快照/限额/敞口依赖；`apps/api/src/app.ts:4085–4104`错误分类。当前只有安全method/path/status，**不能判断是仓储、fixture业务前置、授权/DTO或其它内部异常；根因/生产影响待核实**，不宣称产品bug或SQL根因已证。

依R4登记待核实债务、依C7停在本步：**不继续fixture/oracle适配，不跑A8/B2，不做两轮，不改credit API/SQL/seed业务/PW语义**。C两生产spec从未运行。九旧延期义务保持，不用通道/绑定/完整CI绿冒称补跑已履行；runtime Chromium/真实匿名401等也尚未执行。

下一诊断须明确范围后，在隔离owned schema按correlation ID只取脱敏异常类别/栈定位，核实际quote/snapshot/limit/权限与migration前置；不得打印body、SQL参数、token/proof/Cookie/密码/DSN，不顺手修。当前不额外重复完整seed去猜根因。

## 诊断区分与当前C7：生产关单缺实际成本批准

1. 一次有界owned重现仅观察真实PG失败的白名单code/constraint/源码位置，不输出原始SQL/params/detail/body/身份。`/tmp/kingturf-docker-seed-safe-diagnostic-2026-10-17.log` 实际1/5245ms，SQLSTATE42883，qtc-repositories.ts:267插credit exposure snapshot。0026迁移:79 trigger调用未限定digest；实际owned schema只读探针证unqualified digest不可见/public.digest可见/pgcrypto namespace=public，原authz HTTP fixture:135–140迁移后明确API用owned,public。此为环境可见性（TD-TEST-010），非产品SQL故障。
2. 仅fixture在owned迁移完成后核既有pgcrypto namespace=public，再API运行连接用owned,public，owned仍current/first，容器marker/实例不变；不创建扩展/改公共数据/迁移/业务SQL。独立提交e2c8ce6，回滚点ce74386。`/tmp/kingturf-docker-seed-public-extension-2026-10-17.log` 实际host1/7253ms、seed1/2741ms，信用及后续已通过，最终推进到生产关单500；因此只关闭环境可见性候选，不称整个seed绿。
3. 当前完整失败：POST `/api/v1/production-orders/:synthetic-id/close` →500，原seed:1165–1174（complete后关单）。安全诊断 `/tmp/kingturf-docker-seed-production-safe-diagnostic-2026-10-17.log` host1/6935ms、child1/2561ms；最后精确类别诊断 `/tmp/kingturf-docker-seed-production-category-2026-10-17.log` host1/7117ms、child1/2526ms，SQLSTATE **P0001**、production-repositories.ts:130、trigger **require_approved_cost_before_close** line3。固定类别没有白名单匹配时明确unclassified，不回显原message；触发器名来自固定格式where元数据，不输出SQL上下文。
4. 独立只读核验：迁移0048:62–67在CLOSED event要求同tenant/order effective APPROVED actual manufacturing cost；50–57另禁止计算者自批。完整seed搜索 `actual-cost|actual_cost|production-cost|production_cost|cost.*approv|cost-close` 无成本政策/计算/审批调用。现有关单前置未准备，不是Cookie/Origin故障；需新业务种子步骤/独立身份审批与权限选择，超出只URL/环境准备，**不得补SQL结果/绕触发器/删除关单或改P1断言**。具体三步是否足够尚未实跑，不宣称种子全程根因均排除。
5. TD-TEST-011登记待人类业务seed范围裁定；A8/B2、逐spec变异、首轮/第二轮均未执行，九旧义务仍未履行；C两生产spec不改不跑。所有尝试只owned schema，最终schema/container/API均清理，镜像保留。没有在待决时去做其它业务/spec改变。

## 回滚与最终验证

本轮独立提交链：增量R7 **4e691e5**（父c2ff52b）→回环/自然网络/清理工具 **ce74386** →仅pgcrypto环境修正 **e2c8ce6** →seed一行机器URL/真实绑定 **b13c15a** →认证在途取消验证 **bb04e8f**。逆序回滚取消验证→认证URL/绑定/精确lint→环境扩展可见性→回环环境工具→R7，保持S4实现及旧生产边界；每步先核相邻hunk/依赖，不保证跳步revert无冲突。本次没有实际revert。最后停点仅docs提交后完整CI日志 `/tmp/kingturf-docker-pw-current-stop-final-ci-2026-10-17.log`，此处不预填该未来HEAD/exit；最后实际结果由日志首尾同HEAD/clean/unchanged与交接报告核证。

逐spec当前事实如下；没有任何spec执行命令/exit/耗时，不能填0或绿。没有本轮spec失败trace/截图；runtime仍原off，不用旧附件充本轮证据。

| spec                                   | 本轮结果                                                  |
| -------------------------------------- | --------------------------------------------------------- |
| cost-matrix-product-quality.spec.ts    | A，未执行/未适配/未变异                                   |
| document-send-product-quality.spec.ts  | A，未执行/未适配/未变异                                   |
| login-product-quality.spec.ts          | A，未执行/未适配/未变异                                   |
| order-evidence-product-quality.spec.ts | A，未执行/未适配/未变异                                   |
| workspace-route-isolation.spec.ts      | A，未执行/未适配/未变异；旧非S4字段候选未顺手补           |
| session-revocation.spec.ts             | A，最小oracle迁移已授但未执行                             |
| startup-delivery.spec.ts               | A，最小oracle迁移已授但未执行                             |
| source-nested-authorization.spec.ts    | A，回放/producer前置已登记，本轮未执行                    |
| p1-demo.spec.ts                        | B，完整seed阻断，未执行/未适配/未变异                     |
| runtime-local.spec.mjs                 | B，最小请求/oracle迁移已授但未执行，原guards/隐私配置保持 |
| production-readonly.spec.ts            | C，本轮禁止执行/未改                                      |
| production-role-uat.spec.ts            | C，本轮禁止执行/未改，临时账号开关不启用                  |

故首轮A+B未形成，第二完整轮未开始；第三轮终验义务也未抵销。新的待决仅成本业务seed前置，不重开三项已授会话/通道/机器URL裁定。SOURCE/TEST/CONFIG/G3/生产保护如上，安全质量评分不抬分，不宣称Harness完成。

认证验证工具取消传播定向补记：实际CLI函数真实fetch启动后给host注入SIGTERM，`/tmp/kingturf-docker-seed-auth-abort-bounded-final-2026-10-17.log`非零退出并drain/owned-cleanup；随后`seed-auth-bounded-final`原样正向再次0。每fetch使用外部cancel＋5s deadline，主120s协作截止不冒称任意OS/PG挂起均有界。此负例只证明工具取消闭环，不改变原CLI登录函数/请求和任何业务seed步骤，不抵spec/实际成本审批。

此源小步可独立回滚到ce74386：机器URL与绑定/审计模式/精确lint接线配套撤，业务数据只存在已清理随机schema，不会复活会话/清生产数据。通道ce74386可再独立退到4e691e5；R7再退c2ff52b，保S4实现与人类裁定史。未实际回滚，不push/部署/生产/workflow/新依赖。

最终停点文档/台账/索引/计划收口后另在稳定干净HEAD实际完整ci:local；即使全CI绿，也只表示既有门禁通过，不抵本次完整seed 500、未执行spec/两轮和人类待决。

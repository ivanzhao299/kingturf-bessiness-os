# 批次4 S4：后端会话载体实施与期望映射

## 权限与当前边界

2026-10-17，协调亲核fead2d1干净HEAD全CI0/205231.486ms及自然Secure前置后，直接续派已正式授权的后端小步。按固定设计efae93d、2e22837六项和[开工R7](../tasks/harness-batch4-s4-authorization-2026-10-17.md)施工，不重新选型。仅后端/config/必要机器工具接口/API相关测试/文档；Web业务与Playwright冻结，Docker补跑排队至S4全部收口，不并发启动。SQL/哈希/opaque token/密码算法/事务与撤销范围/依赖/infra/workflow/部署冻结。SEC003保持开放。

## 实施前逐文件旧→新登记及实际变异

严格旧业务body/status/receiver/权限/顺序保持；新敏感token-login亦按协调增量要求no-store，不扩大其它业务缓存。下列日志均在 `/tmp/kingturf-s4-backend-` 下，后缀均为 `-2026-10-17.log`。未记录数字退出码的运行只报告实际测试汇总，不推算退出码。

| 文件/原锚点                                                                    | 必要适配及依据                                                                                                                                           | 实际变异与还原                                                                                                                                                                    |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| auth-route-contract.test.ts：login成功/失败/badbody                            | 原JSON token契约迁机器token-login，窄helper去Authorization、带JSON；认证追加no-store；GET旧login原样。六项2/5                                            | 生产token-login目标扰动；本文件与下列rate/app/foundation合跑4文件9红75绿，共84。还原4文件84绿；日志machine-four-files-mutation-red、machine-restored-green（恢复退出0）           |
| login-rate-limit-http.test.ts：共享dispatch/严格429头                          | 机器入口，保10/11、窗口/异常/成功/receiver/旧代理首错；仅认证no-store。另证明两入口同一S2实例                                                            | 同上四文件真实红→还原绿，不声称各文件所有用例均红                                                                                                                                 |
| app.test.ts：直接login成功                                                     | 仅该请求改机器端点/JSON头，旧session/logout Bearer保持                                                                                                   | 同上四文件真实红→还原绿                                                                                                                                                           |
| foundation-api.test.ts：login异常脱敏                                          | 改机器端点/JSON头，仍触发原auth.login异常，断言500/telemetry不泄漏                                                                                       | 同上四文件真实红→还原绿                                                                                                                                                           |
| auth-http-postgres.integration.test.ts：7处旧login                             | 仅机器路径换token-login；原SQL/seed/schema/双实例/锁审计不动。新增Cookie HTTP闭环，不称浏览器Jar                                                         | 同一目标扰动时只选旧 changes the password, atomically audits：1红19跳过，guard0/PG退出1，日志pg-machine-mutation-red。还原全文件20绿、退出0，machine-restored-green；不是20例都红 |
| website-lead-ingest-route-contract.test.ts：login邻界400/两处故意Authorization | badbody优先/body/status保留、认证追加no-store；仅成功201与缺repo503去旧故意Auth以符合新双载体/机器分流，增加12项拒绝负例；四参/receiver/HMAC签名夹具不变 | 把Origin检查提前到body之前，选定邻界1红93跳过，website-priority-mutation-red；还原全94绿，website-restored-green                                                                  |
| scripts/verify_p1_demo.mjs：机器login                                          | 仅URL改token-login；JSON/Bearer/业务断言不动，未执行完整写业务CLI                                                                                        | AST读取实际CLI的URL/POST/JSON绑定；实际URL扰动1红，cli-mutation-red；还原1绿，cli-restored-green。非CLI端到端                                                                     |
| config原index.test.ts/CSP/S1/普通Bearer业务                                    | 不需适配，保持零差异；新config另测                                                                                                                       | 不声称全库存均被适配                                                                                                                                                              |

## 新行为与验证层次

新增公开配置在旧配置/S2/CSP校验后；精确Origin集合不信任Host，原始语法拒绝URL自动修复/路径/别名，只允许声明的大小写与默认端口规范化。Cookie名字/路径/寿命/开关严格校验，CSRF可读Cookie拒绝要求HttpOnly的前缀，依据[MDN Cookie prefixes](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#cookie_prefixes)。默认两Cookie均Secure/Lax，认证HttpOnly、无Domain；原始多头保留数组，不连接Set-Cookie。

会话私有framed HMAC proof/generation，不出secret/tokenHash；登录proof签时间/nonce/empty-or-session绑定。同session复用有效，跨session/错域/非规范编码拒绝。Cookie认证及所有非安全方法的Origin、generation、签名双提交先于业务handler；双载体401；无Cookie Bearer机器限制与独立HMAC头矩阵。Cookie值不trim、UTF8字节限长、重复安全头拒绝。受控单坏CSRF修复与坏认证Cookie拒绝分开，普通401/logout/改密/session读取不发认证Cookie。缓存分类只认精确Cookie名及认证上下文，不按值子串误判普通业务。

新配置、独立crypto oracle、模型store dispatch/真实Node HTTP、多实例真实PG与后续浏览器分别计量；模型撤销不当SQL事务证明，Node手动Cookie不当Chrome Jar。真实HTTP适配器证明两独立Set-Cookie及重复头拒绝。新增真实双实例PG覆盖Cookie登录/跨实例session/logout单撤销/改密全撤销与无认证Cookie回写，仍手工传Cookie。最终乱序清理、浏览器应用主链和Web迁移后续验证，不关闭SEC003。

## 已执行检查、失败史与边界

- 配置最终2文件71/71（旧29不改）；日志config-final-green。定向API最终9文件232/232，target-final-green。API lint/typecheck退出0，final-lint/final-typecheck；此前结构0违规/29豁免、服务边界160文件/31端口/220静态模板0违规（structure-first/service-first）。完整API/Web与最终干净HEAD全CI尚待本次提交后执行，不以定向绿替代。
- 时间变异同时移除生产签发/验证MAC中的issuedAt：独立公式两例及单独“只改issuedAt”一例共3红8跳过（time-complete-mutation-red）；立即还原全11绿（time-restored-green）。不是只改一侧，也不是同一断言提前失败遮蔽时间验证。
- 首轮新增配置68/68、proof/API40/40；复核发现Origin的WHATWG自动修复及无Cookie restore401遗漏no-store，已修并加负例；协调另要求token-login no-store已落实。不是自然浏览器绕过已证。
- 首次Node raw headers漏Host，40绿1红、400而非403；只补测试Host，不弱化transport。首次必要适配213绿3红：旧401消息恢复原字节，两处HMAC故意Auth按已登记分流适配并补拒绝负例；随后230、最终232绿。
- 初lint30错误涉及类型/async无await/mock绑定/Buffer/箭头返回等；按严格类型与纯fixture拆分修正，无规则禁用或预算扩大。数次apply_patch锚点未匹配无变更，重新定位；不覆盖失败史。
- 独立只读reviewer核验原hash/login/authenticate/changePassword/logout及store调用无实现diff、原PG SQL/seed及HMAC签名fixture不变；frontier末审无必要阻断。只读结论不是其代跑测试。保护区Web/domain/database/types/infra/tests/workflows/lockfile/PW配置相对fead2d1零diff。
- 用户异步CRM状态恢复与360单夹具确认属于历史上下文，不扩大本轮范围或单独授权后续夹具改动；本提交不改CRM/夹具、不启动CDP/PW。后续仅按固定S4设计由协调续派。

最终完整CI日志约定为 `/tmp/kingturf-s4-backend-final-head-ci-2026-10-17.log`，须在本提交后的同一稳定干净HEAD串行实际执行，结果交协调；本文件不预填未来SHA/通过结果或安全评分。不进入前端、Docker、Playwright或阶段5。

## 回滚

getter修正首次提交钩子另拦2项no-unnecessary-condition：新增路径早返后两个旧session比较成为恒真。只移除已被守卫证明的重复比较，不改判定；格式化后risk+browserSession再次1132绿（getter-final-green），由提交钩子重新lint。独立只读复核早返保留三敏感入口/session no-store，无普通业务Cookie读取。

首源码提交6c453e4实际干净HEAD完整CI退出1/192598.636ms（final-head-ci日志）：API126文件17242中4红/17238绿、Web13/266及config71绿；build/audit尚未到达，不标通过。四红均为未改旧risk-route-contract的headers getter必须3次、实际4次：新增缓存分类在非session路由也先读Cookie。只在browserAuthResponse的三个敏感入口早返后加非session路径早返，不改旧测试/业务断言；risk+browserSession定向2文件1132绿（getter-restored-green）。首CI失败不覆盖，后继最终HEAD另完整CI。

CLI JS规则真实负例：临时加入一个未使用常量，ESLint以@typescript-eslint/no-unused-vars实际退出1（cli-lint-negative）；立即还原文件与6c453e4字节相同，lint实际退出0（cli-lint-restored），未执行CLI。独立只读核验精确配置路径无更广放宽。后继完整CI日志使用final-fixed-head-ci，保首失败日志。

提交钩子首次退出1：机器CLI原未进入现有JS工具的ESLint类型检查分类，规则await-thenable因缺类型信息崩溃；定向API lint不覆盖它，故此前API绿不代表该文件已lint。必要接线只在eslint.config.mjs既有Node JS工具集合增加精确scripts/verify_p1_demo.mjs路径，保留推荐JS检查、不扩通配符/G3/阈值；单文件eslint实际退出0（cli-lint日志）。不绕过钩子。此配置须与机器CLI配套回滚。

核后继后配套逆撤本后端/config/机器接口与适配测试，返回fead2d1，保S1–S3/已确认设计/自然预检/他人3144562文档；无SQL迁移/secret轮换，不恢复已撤销会话或旧storage，不自动revert/部署。

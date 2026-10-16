# 批次3新web模块C3最小护栏（2026-10-16）

## 基线与候选范围

基线 `6d467e4`（CDP六场景/五类基线独立提交），该稳定干净HEAD完整 `pnpm ci:local` 真实exit0，单调计时 **181403.487ms**；API117/17099、原PG、web114、CDP纯JS4 tests、预算11368/1898、audit无已知漏洞（`/tmp/kingturf-cdp-harness-ci-2026-10-16.log`）。浏览器六场景与负向仍独立手动，不并入Vitest/Playwright。

本候选仅修改structure-gate及其自测/文档，**没有前端/后端业务源码迁移**；按C3先护栏后3a。四个新目录在此基线没有存量源文件（搜索`rg --files apps/web/src`再匹配`/(shared|crm|commercial|governance)/`无命中）；不能将这次新目录G2规则当旧bootstrap已通过AST。

| 范围                                                         | G1                                      | G2                                                                                | 其他边界                                                   |
| ------------------------------------------------------------ | --------------------------------------- | --------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| apps/web/src/{shared,crm,commercial,governance}/及所有子目录 | 原sourceTS全扫≤800，原split换行口径不变 | 复用既有routeNestingViolations≤5，词法函数/回调继承深度、不reset；类型/格式不凑层 | 精确带尾斜杠四prefix，无新豁免；routes命名子目录也必须扫描 |
| apps/api/src/routes/                                         | 原样                                    | 原AST算法逐字节不变                                                               | G3/G4原样                                                  |
| root bootstrap/http/entry及其他旧路径                        | 原样                                    | 原格式缩进算法/既有豁免保留                                                       | 不扩大为整个web AST，不改其他routes跳过策略                |

`walk`原本跳过非API的routes目录，本候选只给四个新web prefix内部routes递归加例外，防新增`shared/routes/fixture.ts`目录逃逸；其他旧排除保持。G1本已逐sourceTS执行，不重复造一套文件计数器。G3/G4、D5≤800/≤5与拦截模式、原31豁免逐项保持，**函数≤200仍不是机械AST门禁**，须在3a逐完整函数独立实测，不能拿片段或大factory藏巨函数。

## 真实机械注入与守恒验证

`node --test scripts/analysis/structure-gate.test.mjs` **38/38真exit0**（原36原文不改，新增2 tests；约9455ms），日志`/tmp/kingturf-web-c3-guard-tests-2026-10-16.log`。新增真实CLI测试以os.tmpdir独立mkdtemp根创建apps/web/...及空packages，执行**仓库绝对实际gate脚本**、cwd=tempRoot；TypeScript import仍从原脚本位置解析。测试不在共享apps树生成新夹具，不将格式检查与注入并发；结束仅删除该次临时根。

四目录各在`<scope>/routes/fixture.ts`逐次执行7组完整CLI（共28次），再旧legacy格式对照1次，共 **29次**：

| 注入                          | 实际退出/断言                       | 证明                               |
| ----------------------------- | ----------------------------------- | ---------------------------------- |
| split计数801行                | 1，命中当前scope路径/G1 800修复指引 | 新目录含routes子目录不能逃文件大小 |
| split计数800行                | 0                                   | 阈值边界未放宽                     |
| 无缩进function+五层if（AST6） | 1，当前scope/AST6                   | 不靠格式缩进冒充G2                 |
| 七层表达式箭头（AST7）        | 1，当前scope/AST7                   | 回调/函数不能reset深度             |
| 残缺TS                        | 1，AST解析失败                      | 不用部分AST放行                    |
| 完整AST5                      | 0                                   | 合法界限保持                       |
| 50空格深格式但AST1            | 0                                   | 新范围确为AST而非格式口径          |
| scope外legacy.ts 50空格       | 1，格式缩进25层                     | 不把整个web悄改为AST               |

反向范围断言还覆盖bootstrap.ts/http.ts/shared-other/other/API/packages，均不进新web判定。原36保留API routes的G1/G2/G3/G4真实注入、AST词法语义、E1撤例外、真实仓库清理后31豁免等，不改旧预期。

另外主代理只读对拍真实仓库：`/tmp/kingturf-web-c3-conservation-2026-10-16.log`真exit0，当前hard0；从基线完整CI日志提取的31个rule:path，与当前runChecks soft逐项完全相同；SIZE_WHITELIST/NESTING_EXTRA源码、原AST算法、G3/G4主体相对6d467e4逐字节相同。没有加新例外、改SQL可信根、放宽validate或用--report冒绿。

独立reviewer只读检查scope、walk逃逸、旧规则/原36及新增测试，结论无必要阻塞、可落盘提交；未执行测试/写入。协调此前独立设计同意精确四prefix/仅内部routes例外/os.tmpdir真实CLI方案，未要求扩大旧API/其他web范围。当前候选提交后的完整CI另跑，不能把38局部自测或旧6d CI当新HEAD全链结果。

## 下一步与回滚

此护栏独立提交并完整CI0后，才3a首模块form候选/旧新守恒复核。现有openForm完整175行/AST4，openFileForm61/AST4，依赖仅既有dom.el/setOperationStatus与DOM全局；保持完整函数形状，不包成>200大factory，不让shared反向依赖bootstrap。具体提取/import/读源锚点/旧新正文对拍与每适配测试文件扰动红→还原，将在首模块证据独立登记；本轮尚未提取、未改变bootstrap.test读取或业务fixtures，不宣称变异已做。

原31含bootstrap的豁免只在真实消解后撤，不因这次新范围就结清TD-WEB债务。回滚本护栏/自测/文档到6d467e4；将来若已有新模块，不能只撤护栏而继续声称这些模块受C3保护，需与相关模块回滚顺序协调。Playwright配置/九spec冻结未执行，阶段5终验前全部真实补跑义务仍保持；不提前3b，4/5及其他保护范围不动。

语义澄清来源：本线程用户确曾通过异步UI独立回复“按原行为验证（推荐）”，指CRM input允许原重建并恢复状态；它只确认既有守恒契约与仓库证据，不是新行为/范围裁定，也不是把协调send消息当人工决定。CDP基线中的身份边界仍以bootstrap.ts:14548-14562/旧隔离spec为依据。

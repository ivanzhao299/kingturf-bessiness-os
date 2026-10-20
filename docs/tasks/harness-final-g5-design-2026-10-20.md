# 终验 B：完整函数 G5 实测与设计（2026-10-20）

授权：[终验R7](harness-final-acceptance-authorization-2026-10-20.md)。仅增加工程门禁，不改产品/SQL，不拆现存长函数；既有29项G1/G2及G3表逐字保持。先测量与设计，后小步实现/验证。本设计非业务豁免续期、非终验通过。

## 完整函数口径与基线

主执行者只读内存AST实测日志 `/tmp/kingturf-final-b-g5-before-baseline-2026-10-20.log`：全部 `apps/*/src`、`packages/*/src` 下递归生产 `.ts`，排除 `.d.ts`/`.test.ts`/`.spec.ts`及`/test/`；不包括脚本/测试目录，不使用旧walk的routes裁剪。共377文件、3413个 `ts.isFunctionLike(node) && node.body`。递归所有子节点，包含嵌套函数、回调、默认参数、表达式箭头、方法、构造器及存取器；完整跨度为`getStart(source)`首行至`getEnd()-1`末行，首尾均计，包含签名，不扣嵌套函数重叠行。

节点分布：ArrowFunction2381、FunctionDeclaration597、MethodDeclaration370、Constructor51、GetAccessor9、SetAccessor5。routes子集116文件/875节点/203自带名字节点。历史870/最大522仅routes局部口径且旧算法未完整记录，不能视为全仓；前次全函数3411至本次3413的差额不得偷换成routes变化。生产冷提示修复引入两个箭头与差额相符，尚非Git前后同算法重跑证明。旧历史保留。

| 路径                                    | 精确结构符号                                                                            | 完整基线首末行 | 当前行数/上限 |
| --------------------------------------- | --------------------------------------------------------------------------------------- | -------------- | ------------- |
| apps/api/src/app.ts                     | FunctionDeclaration:buildApp                                                            | 541–4167       | 3627          |
| apps/api/src/app.ts                     | FunctionDeclaration:buildApp/VariableDeclaration:application/MethodDeclaration:dispatch | 549–4106       | 3558          |
| apps/api/src/commercial-repositories.ts | ClassDeclaration:PostgresCommercialRepository/MethodDeclaration:createQuote             | 1714–1921      | 208           |
| apps/api/src/routes/foundation.ts       | FunctionDeclaration:foundationRoutes                                                    | 89–610         | 522           |

上述四项是嵌套可重叠完整函数，不是四个独立文件。独立只读复核已核对基线与扫描缺口，未代执行测试。

## G5 实施合同

新增独立AST模块与相对扫描根读取的JSON精确函数表；`structure-gate`调用，同`ci:local`现有structure步骤接入。阈值200：200允许、201拒绝。扫描解析失败、发现不可支持的运行时源扩展或符号链接均失败，不以漏扫放行。新模块独立扫描所有生产src，不改旧G1–G4输入集合或语义。

每项字段固定：path、symbol、baselineStart、baselineEnd、maxLines、reason、owner、dueBatch、until。路径必须确切生产源相对路径，无目录/glob/上级逃逸；结构祖先名称链不以行号/遍历编号认领。表中每项须解析为恰好一个函数，包括已缩至200以下的条目也验证。缺失/更名/歧义/重复/增长超max/新超200/过期/无效元数据或JSON全部硬失败；文件前加注释导致整体平移不算函数增长。表缺失仅代表无任何豁免，真实仓库四项因此不放行；测试临时根不得继承本仓库表。

四项逐函数使用上述当前上限，reason具体注明巨函数/嵌套分发/报价事务/基础路由存量债；owner为本轮Harness执行者（仅门禁跟踪，不冒认未来业务整改人类负责人）。dueBatch为“终验后独立长函数整改批次；若先到硬日期则停止”，until统一选2026-11-17。该有限工程截止日期由本轮执行者在已授限期表范围内选定，不声称人类指定该日期；不得自动续期。新加坡该日含当日有效，**2026-11-18 00:00:00 +08（UTC 2026-11-17 16:00:00）起失败**。测试纯函数可传固定now；CLI不接受绕过日期的参数/环境变量。

G5仅明确有效条目作信息性豁免，其余即使`--report`仍硬失败；原29与G5四项分开报告，原SQL插值/G3可信根一字不扩。输出包含路径、结构符号、跨度、原因与修复指引。G5表不是无条件业务修改/重构授权。

## 验证与回滚计划

单测覆盖全部函数类型/嵌套/匿名回调/默认参数/多行签名，200/201、完整目录覆盖与测试排除；精确允许与增长/新超限/缺失/更名/歧义/坏JSON/路径/元数据/日期拒绝；新加坡过期边界前1ms及当刻；临时根无表不继承；实际CLI `--report`仍拦截。

真实注入只在owned新增临时生产源文件添加201行函数，实际CLI红→仅移除该owned文件→绿；精确表暂改为已过日期，实际CLI红→精确字节还原→绿。原产品源码不改。另验证移走表时四原函数均不放行，恢复后原哈希。所有注入串行、有真实exit与还原hash，不宣称单测代替真实变异。

主执行者唯一写入/测试，后独立只读审实现与证据；定向自测/structure/原规则回归/格式/lint/完整CI逐项实际记录，不预填绿。代码、证据分小步提交；回滚G5模块、独立表、门禁接入与自测调用须同一责任组，保留原29/G3和历史失败。后续最终干净HEAD完整CI及人类终验另计。

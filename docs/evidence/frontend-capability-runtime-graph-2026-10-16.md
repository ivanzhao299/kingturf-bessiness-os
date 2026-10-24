# 能力门禁静态TS读源修正（2026-10-16）

后补实际交付：授权47a8ee5、独立门禁36b1153、随后独立CRM源码487d698；487d698干净稳定实际HEAD完整ci:local真实exit0/177297.989ms，日志 `/tmp/kingturf-3b-487d698-head-ci-2026-10-16.log`，包含本22自测/39-19/lint接线与所有原测试。门禁36b1153本身未单独跑干净HEAD全链，不把后续组合HEAD结果倒记给该SHA。当前仅证据归并，最终文档HEAD仍另完整复验。

## 授权与范围

用户对async范围题正式答复“批准入口可达模块扫描（推荐）”，R7先独立提交 `47a8ee5`，仅计划§7新增两行，全部3b候选保留未提交，未reset/stash/覆盖。早次部分stage尝试因读取大计划的默认Node maxBuffer不足而ENOBUFS，未stage/提交；提高只读buffer后仅stage授权行并成功提交，不隐去失败。

本提交单责修正 `scripts/verify_frontend_capability_manifest.mjs` 的web输入，必要helper为 `scripts/analysis/frontend-runtime-sources.mjs`，独立Node自测接现有test:release-guardrails/ci:local。无新依赖；原TypeScript开发依赖复用。API输入仍只读app.ts，原authorizeQuery正则/Set去重排序、39能力、19路径清单、两原missing断言/成功输出不改。匹配仍逐文件原带单引号includes，不把跨文件边界拼成字面。不把读源修改称为权限语义分析或后端全量扫描。

## 实现边界

从bootstrap出发，AST仅沿本地runtime import、非纯type re-export、静态字面dynamic import；纯type clause和全type命名列表不加边，混合命名列表/default/namespace/side-effect加边。先解析现有.ts、缺真实.js时.js→.ts、extensionless.ts/index.ts，再realpath核边界与真实.ts后缀；真实.js存在即fail closed，不用TS兄弟文件遮蔽真实JS。去重循环、路径确定排序，限制apps/web/src。

tests/spec/fixtures/声明/生成物/外部包不纳入，显式导入这些排除文件也不把其字符串作为证据；因此是“按排除策略纳入的静态实现图”，不宣称完整运行时调用可达性。已知静态资产扩展（含webp?inline）跳过，未知代码扩展/代码query、缺失/空/parse错误/越界均失败。非字面dynamic目标不覆盖，计数并在非零时stderr告警；当前实际18个TS文件、0个非字面dynamic。原字面规则可匹配注释等既有限制不在本次顺势升级。

## 诊断与验证

首13项自测有1红：extensionless `hidden.test` 被extname当作未知代码扩展；按明确test/spec/generated后缀排除补齐，不放宽未知资源兜底。随后13/13绿，独立review指出realpath非TS与真实JS兄弟遮蔽风险，新增两负向并修正；跨平台边界改用node:path.sep，避免手工反斜杠转义。两次编辑补丁因格式化后的行形状不匹配被原子拒绝，无写入，重新读取后修正。当前自测15/15（独立于web114与CDP7），日志 `/tmp/kingturf-capability-graph-unit3-2026-10-16.log`；覆盖循环/排序、runtime/types/mixed、静态dynamic、非字面计数、资源/query、独立临时fixture中的无关补齐字符串、解绑、缺失、空、parse错误、边界、越界symlink、根内非TS symlink、真实JS遮蔽。临时fixture均为os.tmpdir下每测试自有新目录，finally仅清理该目录，不污染冻结业务fixture。

真实新源CLI逐项负向已执行：audit/library2处；configure/library与contextual共4处；manage/contextual5处；read/contextual1处；send/contextual2处；translate/contextual2处。每次暂变异该权限在实际新图内全部带引号匹配，仅运行原verify CLI：exit1且原missingPermissions恰报该项，完整恢复后39/19 exit0。另将原19路径中的organizations在真实bootstrap全部8处暂变异，原missingPaths恰报该路径、exit1，恢复39/19 exit0。无浏览器/DB/业务测试并跑，mutant字面已核无残留。日志 `/tmp/kingturf-capability-{audit,configure,manage,read,send,translate,path}-{red,restored}-2026-10-16.log`，不是内存探针或副本替代实际CLI变异。

独立只读review核实现与原规则保持；排除策略与非字面dynamic局限已按意见显式记录。新边界修正后验证结果见本页后补，不把早次13项或旧负向当最终15项证明。门禁代码独立提交时3b仍未提交，局部workingtree校验绿不是该SHA稳定干净HEAD完整CI证明；最终3b独立提交后才在干净实际HEAD完整ci:local，真0后进入3c。回滚本门禁提交不撤R7/3a，若3b依赖门禁则先回滚3b或保留此读源支持，不用死字符串绕过。

## 保持的边界

提交门禁诊断：首次独立门禁commit被pre-commit真实拒绝（无提交），原因是原verify脚本未纳入已有Node MJS ESLint files，暂存首次触发typed规则缺parserServices；未使用no-verify。仅把此确切脚本路径加入现有Node MJS disableTypeChecked/Node globals配置，并加入原root lint命令，沿现成JS规则正常校验；不改全局规则、hook或其他源码。属于本读源修正必要最小CI接线，不顺手全量扩MJS范围。修后检查与提交另如实记录。

最终稳定解析器再验：22项进入现有完整test:release-guardrails并真实exit0，日志 `/tmp/kingturf-capability-release-guardrails-final2-2026-10-16.log`；末次resolver后再次串行重做六权限与一平台路径CLI红绿，均原缺失断言准确报单项/exit1、恢复39/19 exit0，日志 `/tmp/kingturf-capability-resolver-final-{audit,configure,manage,read,send,translate,path}-{red,restored}-2026-10-16.log`。三个实际业务源文件变异前后sha256逐字相同；读源错源修正未留任何业务修改。协调/frontier与独立reviewer末次只读复核无阻塞；局部eslint/doc-lint118/diff检查通过，最终3b完整CI仍后续单独执行。

最终解析边界补充：frontier依据已安装Vite的实际解析先后指出.mjs等扩展和目录package.json入口也可能造成错源，故不实现完整bundler解析器，而对extensionless存在精确无扩展文件、非.ts候选（mjs/js/mts/jsx/tsx/json/cjs及目录index对应形式）或目录package.json采取保守fail closed；显式.js有真实JS亦拒绝，显式.ts精确解析。即使有些备选不一定优先于.ts，也选择拒绝歧义，不虚称完全模拟Vite。当前websrc无这些竞争实现，属于新门禁未来边界修正，不是业务缺陷；新增mjs/mts/无扩展/index-mjs/package入口五例，最终22/22，日志 `/tmp/kingturf-capability-graph-unit5-2026-10-16.log`。此前13/15/17各时点与日志保留，不重写为从未失败。

终复核后补：协调另指出extensionless文件/index亦可能被已有.js遮蔽，已将缺省扩展名的两种实际JS候选同样fail closed，新增两例，总17/17，日志 `/tmp/kingturf-capability-graph-unit4-2026-10-16.log`；此前15项记录保留为前一时点。显式.ts仍精确取该TS，不用JS兄弟字面作证明。最后一次增量补丁误含不匹配的空test hunk，原子拒绝无写入，去除后成功；未改业务源码。最终eslint与实际39/19均0。`/tmp/kingturf-capability-frozen-rule-proof-2026-10-16.log` 将实际新wrapper受限还原为原web读取/两includes后，整个原脚本规范化AST相等；当前18TS/非字面dynamic0清单同日志，不凭人工“规则未变”声明。

原3b基线d222560、70公开绑定/457完整expect链、114/预算12000-4000、31结构豁免、G3/G4/D5、Playwright九spec/config冻结未跑且阶段5前真实补跑保持。后端/packages/SQL/lock/workflow/生产/push部署、D1/BOUND/SEC/N+1不动。3b分段证据及已发生失败史见 `frontend-3b-crm-2026-10-16.md`，不以本门禁局部结果冒称3b或整批完成。

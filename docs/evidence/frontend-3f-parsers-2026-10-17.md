# 前端3f：已知 HTTP 与存储边界轻量解析

**源码完成检查点**：`dc3697b`独立业务行为提交，实际稳定干净HEAD完整`pnpm ci:local`真实0/178446.705ms（`/tmp/kingturf-3f-dc3697b-head-ci-2026-10-17.log`），开始/结束HEAD相同且树空，无其它测试/构建/编辑并发；Web13/266、API117/17099及原13 PG套件、能力39/19、结构0违规/29豁免、预算11794/1898、audit零已知漏洞通过。之后才恢复工具/文档WIP。`FRONTEND_PROOF_REF=dc3697b node scripts/analysis/proofs/frontend-3f.mjs`固定提交后完整证明真实0（`/tmp/kingturf-3f-dc3697b-fixed-proof-2026-10-17.log`），不是仅以可变候选树推断最终源码。下列“待提交/待源码CI”为原时点；工具证明更正/整批文档另独立提交及完整CI，非业务行为混合提交。

输入：3e源码`c0a549f`及完成docs`303d3d9`均实际干净HEAD全CI0；前置工具`2f9d316`独立干净HEAD全CI0/191524.069ms（日志`/tmp/kingturf-3f-cdp-fixture-2f9d316-head-ci-2026-10-16.log`）。用户已确认独立修正客户360夹具；实际补服务端`['orders','finance']`，非初拟空数组。3f业务WIP隔离后恢复，plan仅追加位置冲突，保留工具历史及事前行为登记两者，无丢弃。源码提交及其干净HEAD全CI待随后真实补记。

## 行为范围与保留项

本次是TD-BOUND-001事前登记后的独立行为提交，不是守恒迁位：畸形已知响应/存储被拒绝或按缺失处理。新增5个无依赖parser，不引入schema库、JWT或新存储模型。

| 边界         | 解析范围                                                                          | 兼容边界                                                                                                                                             |
| ------------ | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| http/json    | 非204成功body原await之后可选同步decoder；畸形错误body安全回退RequestError(status) | 默认仍接受所有合法JSON；204 undefined；嵌套message优先及合法空串/correlation保持；15s含body、abort/401/credential204通知/finally不变，json.length仍3 |
| 会话         | 原始token字符族；登录token；session employee/company与permissions基础类型         | 不强43位、不trim/写回；显示名/员工号可缺失/null；keys/有效读写顺序不变；坏存量token按无token分支，不发请求                                           |
| CRM/商业     | records/items/cursor/cost页及360固定容器                                          | 接受Partial DTO甚至空业务record、不强ID或业务枚举；cursor必需string/null；360必需unavailableSections string[]，不强tuple词汇；保原引用/未知字段      |
| 文档         | 固定路径对应reference/list/detail/version/send/translation/connectors最小消费键   | detail版本正文必需record，body/html可缺/null；translations正文可缺/null；未知动态路径及忽略返回体的写操作透传；无全T/深层完整schema证明              |
| localStorage | sidebar原字面true；register JSON record及已知可选字段类型                         | 坏已知字段整份视图不恢复，合法未知字段/可选值保留；无删除/迁移/自动写回；不收紧JSON textarea                                                         |

文档服务每次真正请求前同步读取原token、原缺失同步throw、path Promise身份及失败删除不变；TD-PERF-003旧失败删新代缓存不修。TD-WEB-007旧顶层挂载/其他旧门控/抽屉问题不修。无后端、SQL、packages、依赖、workflow、生产变更。

## 测试与真实负向

- 原179用例在未适配前通过。新87后最终Web **266/13**通过（`/tmp/kingturf-3f-tests6-2026-10-17.log`）；工具 **34/34**（原33+可选overlay契约1）。类型/lint/结构/build均已过，完整CI仍待源码提交后执行。
- 新测试覆盖generic JSON/204/401/decoder顺序与引用、错误消息优先/畸形回退、Partial DTO/分页/360、实际CRM商业调用、token/session/storage、文档正文及路径、同步缺token/缓存身份/失败显式重试。合法大整数元数据不加safeInteger上限。不声称新测试逐一动态覆盖entry所有存储写入序列或全部安全矩阵。
- bootstrap源码读取仅增加5个唯一非空export锚点，旧457 expect完整链不改，旧其余11 test字节不改。5锚点实际扰动各1红/264绿，还原265绿；旧HTTP整体替回`2f9d316`实际7红/258绿，还原265绿；文档正文parser实际破坏6红/259绿，还原265绿。这些在最后新增合法大数用例之前，不能冒报266负向。日志`/tmp/kingturf-3f-mutant-{1..5}-{red,restored}-2026-10-17.log`、`3f-old-http-{baseline-red,restored}`、`3f-document-content-{red,restored}`。
- 初候选lint的undefined默认值/泛型/多余断言、新测试动态delete与异构it.each展开错误均在冻结前修正；保留原失败日志，不把第一次异构表运行说成已覆盖数组输入。修正null默认值保原函数arity。

## 浏览器（临时CDP通道，非Playwright）

扩展命令：`node scripts/e2e-cdp/preflight.mjs --probes --sales-views --pricing-views --credit-contract-views --fulfillment-views --finance-risk-views --operations-views --dashboard-view --register-tools --document-editor --governance-view --lazy-routes --boundary-parsers`。

- `10ahHx` **50/50**：旧41+lazy6+boundary3；DOM171/viewport55/route93/text190/overflow70；网络blocked/unknown/failed fulfillment均0，自有preview3819626、Chrome root/profile清理全真。`/tmp/kingturf-3f-browser50-first-2026-10-17.log`。
- boundary3分别为坏session不发session GET/原值不写回、坏register整份拒绝及选择性Storage getter抛错默认、已映射quotes畸形200→局部错误→真实retry只多1 quotes GET。需要`--register-tools`的12行合成数据；不宣称单独flag同样覆盖。
- 原fixture29完整flags（上命令去掉register-tools/editor/governance/lazy/boundary）`IvFeK9` **29/29**，分类80/47/69/142/56，网络三零/自有preview3820731及root/profile清理全真；`/tmp/kingturf-3f-browser29-full-2026-10-17.log`。首次只传`--probes`实际7/7（`RInDtN`），不能当29，随后完整补跑。
- optional overlay先经过原base.respond，之后只改已映射quotes响应，不授权未知/写请求。原driver/网络硬闸/命中/预算/旧UI断言不动。CRM筛选沿原重建input并恢复值/焦点/选区；商业workspace/menu/未重绘成本input身份保持，按用户确认口径。

Chrome154.0.8037.99，Windows headless=new、随机端口/独立临时profile/仅回环；不访问真实API/SQL/生产或真实账号矩阵。原Playwright9spec及config未改未执行；阶段5终验前仍须提供Linux Chrome或免交互安装权限后真实补跑，不以CDP抵销。

## 证明工具缺陷与完整重核（更正旧证据）

版本化工具的独立lint接入仅新增proof目录同等Node MJS规则及lint glob，首次该目录未匹配导致typed-lint配置错误，随后两处regex空格规则失败，等价改为` {2}`；原TS规则无放宽。三证明分别手动执行，不把依赖历史git对象的审计强加到浅克隆CI测试。

协调独立发现临时encoder的`forEachChild(n,x=>array.push(...))`返回truthy，TypeScript提前停止后续child。旧3e-lazy/date/3f的AST内容等价结论不足，不能只凭457数量推断参数/matcher相同；字节比较、数量walker和实际测试结果不因此失效。独立扫描15个本批proof，另协调16脚本范围，均只确证这三份有此缺陷；其余3c2–3c11、3d、3e-store回调有void块体。该结论不是全仓所有证明工具已审。协调最初最小复现误把SourceFile全文计入encoder，修正后复现三类遗漏，亦为诊断脚本失败史，不冒称业务回归。

修复为void块体；每份新增第二声明/函数尾语句/expect实参三类差异自校验，全部必须不等。版本化脚本在`scripts/analysis/proofs/`，从仓库根运行：

- `node scripts/analysis/proofs/frontend-3e-date.mjs`：固定baseline382d7f0→候选c0a549f，13调用逆展开/10完整消费者含imports与旧457链相等。首次固定SHA diff含已提交helper共11文件，明确排除helper后仍严格核10消费者；不是删消费者。日志`/tmp/kingturf-3e-date-proof-full-recheck2-2026-10-17.log`。
- `node scripts/analysis/proofs/frontend-3e-lazy.mjs`：固定b210c77→580cc72。首完整比较真实红，定位refreshViews新增note移除后剩`if (...) { this.views.set(...); }`，旧为无括号单表达式if；仅归一化if.then恰一个ExpressionStatement的block，不删除声明/条件/其它节点，然后controller全方法/两loader/default workspace/routes/list installer、70公开/457链全部完整比较通过。日志`/tmp/kingturf-3e-lazy-proof-full-recheck{,2}-2026-10-17.log`。不宣称原始AST逐节点字节相同。
- `node scripts/analysis/proofs/frontend-3f.mjs`：基线2f9d316；6消费者逆掉28decoder参数/4storage wrapper及指定原view initializer后，**完整文件含imports/顺序AST相同**；HTTP原setup/fetch/通知/catch/finally和单body await检查相同，不声称故意变更的成功/错误解析体相同；root字节/70公开/457完整链/旧其它11 tests字节同。修正后`/tmp/kingturf-3f-proof3-full-2026-10-17.log`真实0；首临时proof另曾错误解包旧HTTP AsExpression已修，不是业务故障。提交后以`FRONTEND_PROOF_REF=<源码SHA>`再次固定候选重核。

## 量度与交付边界

5新runtime split/完整函数/AST分别26/8/2、33/16/3、57/14/3、40/22/3、89/30/4。root仍749/完整158/AST3/格式5/70公开。全仓357源/57814行、150测试/67017行（repo-metrics口径）；API4129/buildApp3598不变。最后build启动gzip JS11794/CSS1898，低于原12KB/4KB，workspace deferred；不削39能力/19路径门槛或29存量豁免。

源码提交后实际稳定干净HEAD全CI、完成docs全CI及整批评分/回滚索引待真实补记。3f后停整批人工验收；不进入批次4/阶段5，不push/部署。TD-BOUND-001按已知轻量schema范围收口，不称任意泛型T已深校验。

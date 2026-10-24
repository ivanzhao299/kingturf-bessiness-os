# 前端3e②：按路由数据惰性读取（2026-10-16）

证明更正（2026-10-17）：原临时encoder返回push长度导致后续child未比较，旧AST内容证明不足。修void全遍历/三差异自检后，固定b210c77→580cc72完整重核；首红定位refreshViews移除新增note后留下单表达式if括号块，仅归一化该类块，不删条件/表达式/else/声明，多处完整逆比较通过。旧实际测试/CI不回写；版本化脚本及完整失败史见[3f更正](frontend-3f-parsers-2026-10-17.md)。

## 当前候选实测（覆盖下方实施前时态）

**源码完成检查点**：`580cc72`（refactor(web): lazy-load authorized commercial route sources [已测试]）稳定干净实际HEAD完整`pnpm ci:local`真实退出0/179498.691ms；开始/结束HEAD相同、工作树均空，执行期间无编辑/其它测试/构建/浏览器并发。日志`/tmp/kingturf-3e-lazy-580cc72-head-ci-2026-10-16.log`。全链包含回环测试库guard/迁移/13个PG集成文件、lint/type/tests/build/审计，API维持原117文件17099、Web11文件163，登录预算11368/1898、无高危审计项；不把原Playwright写成已执行。下文“待执行源码CI”为候选时点历史；完成docs提交仍须自身实际干净HEAD全CI。回滚点580cc72，前置b210c77，需核后继冲突后独立revert，不自动回滚。

首次缺失源按21route闭包读取，已加载共享源/DOM复用，不实现历史首提案的每次返回刷新或清选择。overview保全授权读取，因此默认overview不减少请求；CRM、治理和文档读取仍各自独立。仅网络data lazy，构造器仍创建全部视图，不声称DOM/JS懒构建。旧公开load/refreshViews与写后刷新范围保持；源lease、public读barrier及成本guard只约束新lazy，不修旧顶层挂载/文档缓存竞态。

- 新增8runtime：store/{dashboard-query,read-owner,route-dependencies,route-read,route-state}、commercial/{workspace-frame,route-dom,route-navigation}。root749 split/完整函数158/AST3/格式5，8runtime最大139行/完整函数106/AST5。入口豁免保持撤销，structure-gate实际0/29豁免，不放宽阈值。
- 原120测试不改语义，新增43数据契约，总163/11文件真实绿。覆盖21闭包、权限交集、仅首次缺失、显式retry/部分成功、A→B/源lease、dispose/token/public load/refresh、成本public先/后起及两完成顺序、public/public原latest-wins、全失败和false成本不能标ready、loading setter异常释放barrier。不是完整安全或真实API写入矩阵。
- bootstrap.test仅增加8实际唯一非空源码锚点，457条完整expect链不变；原其它既有测试文件字节相等，公开70项相等。8次真实锚点变异逐个1失败162成功，逐个还原163绿；这是源码绑定负向，不冒称8个业务故障。日志`/tmp/kingturf-3e-lazy-mutant-{1..8}-{red,restored}-2026-10-16.log`。
- `/tmp/kingturf-3e-lazy-proof.mjs`最终真实0（proof2日志）：逆去owner无状态钩子/可选guard、还原年度query调用后，完整controller所有fields/methods/await顺序及两load helper与b210c77 AST相等；默认workspace函数以frame原初始化逆展开、两个route赋值器及默认列表安装逆展开均相等。可选live分支保持真实workspace/status闭包，不离线摘子树。
- 新UI静态审修正了回访无新DOM仍重建分区菜单、lazy分批创建不同drawer闭包、旧visit锁定未同步释放、无旧配对dashboard落末尾四项候选缺陷；新visit/dispose同步release且ticket防旧finally撤新hold，canonical配对后逆序anchor插入。独立reviewer最终只读复核未见这四项必要阻塞，非生产故障证明。旧默认写后替换的多drawer候选仅登记TD-WEB-008，现45项，不全局改旧行为。

### 浏览器与失败史

Windows Chrome154.0.8037.99、独立临时profile、headless随机loopback CDP；4173自有preview，确定性GET stub，未知请求/写入fail closed，原driver三秒/物理命中不动，Playwright原9spec/config未改未执行。

1. 原fixture/原29 `suWvy6`真实0：DOM80/viewport47/route69/text142/overflow56与旧计数一致；原CRM rebuild后值/焦点/选区恢复且商业workspace/sidebar菜单/未重绘cost input同ref。新请求计数另表：customers/session各5，cost6/detail2/orderEvidence2；opportunities2/quotes4/dashboard2，不能把减少GET写成少做原UI断言。日志`/tmp/kingturf-3e-lazy-browser29-first-2026-10-16.log`。
2. 新45首跑`0yJfP6`原41+首次无预取共42绿，随后新“quotes分区菜单存在”断言false，真实退出1；静态核实quotes的readiness用strong、主h2等于route label，原helper不保证quotes分区菜单，故改为绑定实际非空全体分区菜单并比较逐项ref，未改原41。旧新断言差异仅新未冻结夹具选择，非业务修复。日志`/tmp/kingturf-3e-lazy-browser45-first-2026-10-16.log`。
3. 新47首跑`vjpp7U`进行中发现新hold夹具会同时挂住A/B两个solutions请求，主代理主动SIGTERM本人本次Node PID3669262，在原26项后退出1；未到新lazy用例、不是业务竞态失败。自有preview3669294/root/profile均确认清理。修成仅第一个solutions请求消费hold，B请求正常返回；原cost/detail hold语义不变。
4. 首轮47成功`b1wV1S`真实47/0：原41不动+6lazy，DOM168/viewport54/route92/text188/overflow69。6项为首次customers无业务预取/非空实际岗位卡明确“尚未加载”、首次route与返回节点ref及ready重应用focus、两个增量列表复用同drawer、非overview→overview dashboard原装配顺序、首A旧solutions受控挂起→B新source提交→放旧A仍不改B route/节点→回A采用新共享源、首次quotes503→真实retry按钮仅补失败quotes源。旧A响应明确不同`CDP-TS-OLD-LAZY`，新值`CDP-TS-A`，不是相同payload伪竞态。日志`/tmp/kingturf-3e-lazy-browser47-second-2026-10-16.log`；自有preview3669455/root/profile清理全真，blocked/unknown/failed fulfillment均0。合成503为已映射HTTP响应，不放宽网络硬闸。

候选迭代还保留：新成本启动/ready防线先红3/161、误期待取消而实际应等待public采纳的一轮2/161、fulfilled false成本误标ready2/163；修正后163绿。UI首lint10项（新代码格式/空函数等）和root格式缩进6真实失败，修后lint/type/163/build及gate0，未恢复豁免。证明脚本首轮误把SourceFile传给需要string的metrics API而TypeError，修的是临时只读证明脚本，不是业务；局部patch空白不匹配均原子拒绝，无部分落盘。

### 候选体积及下一检查点

最终独立只读复核无必要阻塞；纯JS工具32/32、Web163/163、最终逆AST证明、structure-gate0/29、doc-lint及format:check真实通过。命令为`node scripts/e2e-cdp/preflight.mjs --probes --sales-views --pricing-views --credit-contract-views --fulfillment-views --finance-risk-views --operations-views --dashboard-view --register-tools --document-editor --governance-view --lazy-routes`；`--lazy-routes`护栏依赖`--sales-views`等已列完整夹具，不宣称单flag即可运行。日志`/tmp/kingturf-3e-lazy-final-{tools,tests,proof,structure,doc-lint,format-check,metrics}-2026-10-16.log`。新增两纯JS用例已包含32通过，不再是未执行状态；下段“待下项检查”为前一时点。

最终护栏精度复核后另跑`NHQUkp`，同47/0及168/54/92/188/69，网络三零/自有preview3670122/root/profile清理全真（`/tmp/kingturf-3e-lazy-browser47-final-2026-10-16.log`）。首次无预取断言改遍历全部实际请求counter，仅排除显式session/CRM、governance和文档独立读取；旧响应等待加3500ms有界race，并在两条solutions响应body的PerformanceResourceTiming结束后观察350ms/至少两真实rAF，再验节点和新值。这是有限稳定窗口，不声称任何无限未来异步或所有会话竞态已被证明。前次b1wV1S的Fetch ack不单独当页面处理完成证据。新增两项纯JS夹具测试约束默认关闭、首请求独占hold/不同payload、503与恢复、未知/写入仍拒绝，实际运行结果待下项检查。

repo-metrics真实351源/57442行（前343/56625）；测试148/66504（前147/66069），root≥4缩进19/≥7为0/最深5，API4129/buildApp3598不变。构建bootstrap-0SNR2tbU.js/index-DZ3P_1AA.js；登录gzip JS11368/CSS1898，workspace仍deferred。无API/packages/SQL/依赖/lock/workflow/评分改动。完整干净源码提交CI与独立最终审结果待随后真实记录，不能预填通过；完成后继续3e日期统一，再3f，3f后整批人工验收，不提前收尾。

回滚：本子批源码提交可在核对后继依赖后独立revert，恢复b210c77全量商业首次读取；不运行破坏性回滚。历史首提案与审查文字保留下方，已被上述现时规则覆盖。

**现时设计更正（独立范围复核后）**：下文“每次进入/返回重读、数据变化可清选择”的首提案已撤回，未接入mount/binder、未实现为用户可观察行为，也未写成新护栏预期。仅实现首次未加载的完整依赖补齐；已加载route/共享source复用原快照，原公开load/refreshViews及写后刷新继续更新共享数据，使访问过的route采用已显式刷新的值，不能永久持有独立旧副本；不额外每return GET、不新增清选择提示/策略。失败保持独立error并由显式retry处理。首提案留作审查历史，不是另获行为授权。采购另补contract-documents传递依赖，正常mount TD-WEB-004投影仍不修，公开直接constructor兼容支须保留。overview全域读取经shell-frame312–326/role-insights21–47确认必要，默认overview无全量请求减少，返回overview也复用快照；仅网络lazy非DOM/code lazy。成本波次guard不代表整波原子，原requestcounter/pendingQuery/loading仍在await前修改，须验证不取消或覆盖后来的public成本请求。一次更正patch因表格空格不匹配原子拒绝，确认源码/文档均未局部写入后重做；非业务失败。尚无mount惰性集成或浏览器通过宣称。

输入守恒源码fc14d50稳定干净实际HEAD完整CI0/184438.376ms；完成docs b210c77另实际干净HEAD完整CI真实0/181086.562ms（`/tmp/kingturf-3e-store-b210c77-head-ci-2026-10-16.log`），结束HEAD不变/树空。原9/114+六定向为120，70公开/457链冻结；五store模块完整279行class逆证明与实际负向/新41及原29齐。此后才实施真正lazy，不能把之前纯搬迁算已完成TD-ARCH-002。

## 实施前变化登记与不变量

台账TD-ARCH-002追加本步骤可观察变化，原文历史保留，仍44顶层项；本步按既有授权独立提交。公开load()保全权限请求/原失败/写后reload，refreshViews(paths)保不按权限过滤及部分成功后报错；CRM首次加载后原数组ref赋值，不随commercial.load重读。TD-WEB-004/006、旧顶层挂载TD-WEB-007、文档旧缓存TD-PERF-003不修；新lazy自身绑定真实controller/shell/token，不能改写成旧会话全链已安全。

新挂载按allowed initial hash选依赖；后续点击/hashchange/返回同一通道。每次进入/返回重新读，语义相同的数据不重绘（保原节点、筛选/分页/选择）；有变化才刷新目标主+legacy组，保筛选/分页/显示设置，旧行无统一业务key时不拿标题猜选择，数据变化可清除选择并提示。首次未加载不呈假空卡，失败显式retry；有旧快照则提示刷新失败/保旧。网络失败不自动重试；仅因旧public读取导致的失效波次可待其结束重发。文档模板、CRM、治理与overview跨域读取均单独披露，不声称所有请求只当前route。

## 21 route完整依赖表（实施前只读复核）

下表省略共同`/api/v1/`前缀；均与原43对read权限过滤交集，`opportunities`走独立listOpportunities。`cost-matrices`是Map/source key，真实wire为分页cost-matrix-summaries（保API fallback）；不预取旧点击详情。

| route                  | 首次渲染/操作选项/readiness依赖                                                                                                                                 |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| opportunities          | opportunities；CRM customers                                                                                                                                    |
| technical-requirements | ctrs、opportunities                                                                                                                                             |
| technical-solutions    | technical-solutions、ctrs                                                                                                                                       |
| costing                | cost-models、cost-matrices、cost-evaluations、technical-solutions、manufacturing-items                                                                          |
| sales-policies         | sales-policies、sales-policy-evaluations、cost-evaluations                                                                                                      |
| quotes                 | quotes、ctrs、technical-solutions、cost-evaluations、sales-policies                                                                                             |
| credit-review          | credit-limits、credit-decisions、quotes、opportunities；CRM customers                                                                                           |
| contracts              | contracts、contract-documents、quotes、opportunities                                                                                                            |
| sales-orders           | sales-orders、quotes、credit-decisions、contracts、opportunities                                                                                                |
| order-360              | sales-orders、risk-policies；CRM employees                                                                                                                      |
| receivables            | ar-open-items、sales-orders、bank-payments、collection-cases                                                                                                    |
| collections            | collection-cases、ar-open-items；CRM employees                                                                                                                  |
| payments               | bank-payments、reconciliation-runs；CRM customers                                                                                                               |
| commissions            | commissions、commission-policies、sales-orders；CRM employees                                                                                                   |
| business-risks         | risk-evaluations、risk-policies、sales-orders；CRM employees；风险控件仍order360构建再跨区消费                                                                  |
| manufacturing-master   | manufacturing-items、manufacturing-boms、manufacturing-routings                                                                                                 |
| procurement            | suppliers、procurement-rfqs、supplier-quotes、purchase-orders、goods-receipts、inventory-locations、inventory-balances、manufacturing-items、contract-documents |
| material-planning      | mrp-policies、mrp-demands、mrp-runs、manufacturing-items                                                                                                        |
| production-orders      | production-orders、manufacturing-items、manufacturing-routings、inventory-balances、inventory-locations、production-cost-policies、production-cost-runs         |
| quality-inspection     | quality-plans、quality-inspections、lot-traceability、complaints、complaint-sla-policies；CRM customers/employees                                               |
| shipments              | shipment-releases、sales-orders、production-orders、lot-traceability                                                                                            |

overview需要已渲染各route DOM的role insight，保全授权source及dashboard年度CNY GET；三readiness分别是quote的CTR/solution/cost/policy/quote、order的quote/credit/contract/order、cash的AR/bank/cases/legalhandoffs。CRM引用仍由CRM自己权限决定，不追加授予。详情仍仅点击后读：order360单订单（原仅inflight合并）、成本详情无factors才GET、投诉动作详情；新策略不能把这些移到登录预取。

独立scout两轮实际跨模块盘点，主要证据为store/readable-sources全部43对、commercial/{quote-view,cost-view,sales-orders-view,workspace-readiness,procurement-view,production-orders-view,production-cost-view,quality-view,shipments-view}以及root商业装配。business-risks须额外含sales-orders，因risk控件在order360段捕获订单，即使主risk-view不直接读orders也不能漏。不是仅grep主view名的同名列表。

## 设计审查发现与取舍（尚未实施）

已否决“离线构建整工作区再只摘目标子节点”：quote等handler捕获离线workspace，保存时replaceRouteView因不连接返回，造成真实闭包回归。改为可选live workspace构建入口，所有新handler创建时捕获稳定实际workspace/status；默认三参仍原新树语义。live分支不得重置运行时immutable类/挪动原status，route赋值只处理本次新child，完整主+legacy组原序替换，不碰其它route/shell/menu。仍构造所有DOM/listeners，只声称网络按route延迟，不声称JS/DOM懒构建。

原status含全部21route token，导航hasView不能当数据ready；新增独立ready/loading/error状态。保存可整commercial workspace替换，提交前还须校验工作区身份/代际，不能只查shell连接/current route。inert由visit拥有，旧visit不解除新visit的busy状态，退出/失败/销毁必须释放。

新数据先写私有staging；每source lease与route visit/shell/session验证，A→B旧结果不得盖新共享source。旧public load/refresh仍原提交，新增只用于attached lazy owner的读barrier：同步开始前claim、原finally后可靠no-throw release；新route开始等待idle，落盘再查public epoch/idle/source lease，失效重发不混失败自动retry。成本直接写真实controller不能仅靠staging，lazy调用须携该波次guard并采纳真实boolean，原public调用不附新guard。barrier不覆盖submit至随后refresh整个事务，不外推安全矩阵。

列表原state/selectedSet保存HTMLElement，recordName只标题并不唯一；不能猜新row身份。相同data直接不重绘，数据变化时仅恢复可唯一配对的逻辑列表控件与分页，选择安全清除且提示，抽屉不宣称自动重绑定最新record。原默认持久化key/用户主动保存时机不变、不引入自动storage写。独立只读审提出的闭包/status/immutable/成本/旧writer边界已纳设计，尚无实现/测试通过宣称。

后续必须实际验证：原120/457/70、21依赖与权限交集、初始hash/点击/返回、每次进入fresh、普通及成本A→B late、public load/refresh中途开始/失败释放、跨owner与dispose/旧token取消、保存整workspace更换、首次失败≠空及显式重试、列表筛选/分页/选择策略。原UI断言/driver/网络硬闸不放宽，新请求计数分表；原Playwright仍环境受限待阶段5前补跑。源码/提交/metrics/build/浏览器/CI均待实施后补，不预填。

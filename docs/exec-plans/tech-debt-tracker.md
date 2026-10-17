# 技术债台账（tech-debt-tracker）

**阶段5 Workspace实施收口（2026-10-17，仍58项）**：按5230625新字段许可仅补真实orders/finance tuple，原4过；缺字段真红3过1败→还原4过，旧session DTO真红4败→还原4过。TD-TEST-014仅旧夹具/文件适配实施验证关闭，不认定产品问题；A七份绿/成本一败，P1待逐页期待裁定、第二轮未开。[全部实际结果](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)。批次4已人工验收，SEC003载体项按5230625关闭；下方旧待裁/未验收均历史，阶段5其它义务未完成。

**首轮部分交付（2026-10-17，58项）**：新增TD-TEST-018，P1两次安全定位出现active upstream4173 CONNECT_TIMEOUT，最新仅3例完成、前两例原看板断言/overview隐藏，第三原因未知；TD-TEST-016转C7，候选封存还原。A六文件全绿/两份各一败，B runtime真红绿/P1未完成，不开第二轮、不改产品/网络失败条件。[事实与封存](../tasks/playwright-p1-replay-blocker-2026-10-17.md)。最后稳定干净HEAD完整CI另实测；下方均历史时点。

**B工具新回归（2026-10-17，57项）**：新增TD-TEST-017，43047ec进度reporter把Playwright构造options误作writer；本地官方源码确认框架传对象，直接回归unit1/5过1败。仅已授B私有工具兼容缺口，先登记/红例后独立最小修复，不改产品/原断言。[证据](../evidence/playwright-local-private-runner-2026-10-17.md)。最新P1诊断还出现upstream4173 CONNECT_TIMEOUT/closing=false并清理，非RESET证据，不贸然放宽通道失败条件；下方56为历史。

**P1首轮现时（2026-10-17，56项）**：新增TD-TEST-016，原种子0/成本关单通过后，完整11发现/完成、11 failed，PW1/65088ms/host1/73640ms，owned全清；raw按人裁清理/未留图，不凭其猜根因。仅安全failureLine定位候选，不改原业务期待/配置，[事实与未测](../tasks/playwright-p1-replay-blocker-2026-10-17.md)。runtime首轮可独立续，第二轮仍禁，下方55为历史。

**A首轮现时（2026-10-17，55项）**：TD-TEST-015已按直接人裁只修应收合成nextCursor，缺字段与auth各真红→还原原3绿，样本SHA/权限/业务断言保持，仅该缺口实施关闭。A8六份全绿，Workspace/成本各仍一败待裁，B首轮接线后独立执行，第二轮禁；下方已授待实施等为历史。

**Source夹具现时（2026-10-17，55项）**：新增TD-TEST-015，原PG producer19过、两次PW均2过1败，authorized催收卡hidden；旧应收合成cursor响应缺nextCursor，静态ready依赖链支持夹具候选。直接人类仅批该endpoint补null，原样本/权限/断言冻结，待实施与真变异；[事实/原话](../tasks/playwright-source-fixture-ruling-2026-10-17.md)。不扩大Workspace字段/成本提示许可，旧54为历史。

**Workspace夹具现时（2026-10-17，54项）**：TD-TEST-014，已授auth/void候选2过2败，首次成本GET q空被gate挂住、360缺必填字段；只读trace/源码支持旧夹具候选，不归责产品/改原16assert。人类已批等待点最小修正，字段另待裁，[事实/原话](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)。成本TD-TEST-013不扩修、未第二轮，下方53为历史。

**成本提示C7现时（2026-10-17，53项）**：新增TD-TEST-013，成本仅auth候选真实1通过1失败，原末提示不可见、前URL/dialog/decisionId过；trace报价commercial-status文本空、201→GET200。lazy覆盖message是候选未干预实证，不改业务/期望；临时auth精确还原未完成变异。[待裁事实](../tasks/playwright-cost-handoff-blocker-2026-10-17.md)。login已2过且f3882a3全CI0，其它6A/2B未跑、C禁/未第二轮，下方旧计数为历史。

**A类接线静态发现（2026-10-17，52顶层项）**：TD-TEST-012仅登记冻结document-send spec:154在额外strict全A tsc下string|undefined诊断（exit2），非原CI/PW失败证据；不改旧断言或放宽规则，若实阻断原门禁/补跑再C7。成本种子前置已验证，下列51为前时点。

**成本种子现时（2026-10-17，仍51项）**：TD-TEST-011已获独立人类R7并完成最小本地policy→calculate→异人approve→原close；完整seed同schema重复计数稳定、缺料/自批真实红后还原绿。只关闭本地种子前置实施项，不等于A/B补跑或整批验收；[证据](../evidence/playwright-p1-cost-seed-2026-10-17.md)。下列待裁/未修均为历史，原500保留，不改产品SQL/其它业务或抬分。

**Docker前置当前停点（2026-10-17，51顶层项）**：TD-TEST-010 owned pgcrypto可见性仅环境修正，信用段已通过；新增TD-TEST-011：冻结P1 seed缺实际成本批准，生产关单500/P0001/require_approved_cost_before_close已实证。补业务种子超仅认证URL/环境授权，C7停后继spec/两轮；不认定产品触发器有bug、不绕过约束，待人裁。源码/两PW配置/spec/原业务步骤保持，最终HEAD完整CI另实测。下方50/49及旧信用停点均保留历史。

**Docker前置环境新登记（2026-10-17，50顶层项）**：新增TD-TEST-010，本轮owned随机schema完整P1 seed信用POST500、认证已通过；初登记根因待核实，后继安全诊断SQLSTATE42883/credit snapshot插入锚点及owned schema看不到public已装pgcrypto已证，尚不认定产品bug。仅本环境前置候选，业务/SQL/冻结seed步骤不改；旧49/48等为历史。

**批次4交验现时（2026-10-17，仍49顶层项）**：f114ee0稳定干净HEAD全CI实际0/192524.18ms、API17242/Web313与真实网络26/故障9已核。SEC001仅RO完成、强制开放；SEC002登录范围及SEC004按S1–S3人工验收核账实施完成；SEC003按固定六项及真实网络/最终源码CI关闭载体迁移实施项，整批人工验收待本次交付、九旧PW延期仍硬前置；TD-WEB-009窄修实施完成待整批验收。TD-TEST-006新CDP异步失败后继候选待核实，不回写旧解决历史、不新增顶层ID。WEB007/PERF003仅必要同文件代际适配，不整体关闭；其它债不扩修。[统一交验包](../evidence/security-batch4-acceptance-2026-10-17.md)。下方所有旧“现时/开放/未完成”保留原时点。

**TD-WEB-009窄修检查点（仍49项）**：协调/frontier裁为S4内部实现缺陷已授窄修，http精确POST logout仅豁免本地pause、current/proof/服务端不动。新增9测试真实红绿/变异红绿、API17242/Web313全量及原失败DOM链复跑通过，工具完整矩阵/最终干净HEAD CI仍待执行，未整批验收或关闭SEC003。[窄修证据](../evidence/security-batch4-s4-paused-logout-2026-10-17.md)。下方仅登记为此前时点。

**S4网络实测新增登记（2026-10-17，现49项）**：TD-WEB-009：挂载信号冲突后paused owner让恢复页“返回登录”在fetch前本地403，真实Chrome重复失败且零logout请求；刷新仍可恢复。仅登记、未修改业务，不关闭SEC003。证据见[S4网络检查点](../evidence/security-batch4-s4-network-2026-10-17.md)。下方48项为历史时点。

**S4前端现时候选（2026-10-17，仍48项）**：后端25526c8全CI0已协调确认；本步前端Cookie不可变上下文实施，WEB007仅挂载await归属耦合、PERF003仅文档generation/owner/cache同Promise耦合，两整项不全面关闭。Web304/预算11992与1898定向通过，最终提交后另干净HEAD全CI再停协调；Chrome网络级/旧PW未跑，SEC003/评分不提前关闭，无新增条目，不修其它债。[前端证据](../evidence/security-batch4-s4-frontend-2026-10-17.md)。

**现时48项（S4后端小步，非整批完成）**：fead2d1预检最终CI0经协调确认后仅后端/config/机器接口实施，逐文件真实变异、定向API232/config71/PG20绿、独立静态复核无阻断；最终提交后另同一稳定干净HEAD全CI再停协调。[后端证据](../evidence/security-batch4-s4-backend-2026-10-17.md)。Web/PW/SQL/事务/依赖/infra冻结，SEC003保持开放，SEC001仍仅RO、SEC002/004整批核账待完成，评分不预填。九旧PW硬前置、TD-HYG-002仅登记等边界不变，无新增条目；下文“仅设计/未编码”等为历史。

**现时45项（3e②）**：新增TD-WEB-008旧列表抽屉闭包候选，仅登记；下列44项为前一检查点历史计数。

> 依据 `docs/HARNESS-RULES.md` 附录 B 字段定义维护。**本台账是长效文件**：结清的条目移除并记入对应提交，新发现的条目持续登记（§14.3）。
>
> - **度量基线**：commit `779dea3`（2026-10-12），全部数字可用 `node scripts/analysis/repo-metrics.mjs` 复算。
> - **度量口径**：行数以度量脚本为准（内容按换行符切分，含末段空行），与 `wc -l` 相差 ≤1 行/文件（如 bootstrap.ts：脚本 16,082 / `wc -l` 16,081）；两者差异不影响任何结论的量级。函数跨度为起止行号差，两口径相同。
> - **业务行为影响**取值：`无`（纯重构）／`修复 bug`（纠正错误行为）／`变更行为`（有意改变外部可观察行为，必须单独提交并前置人工决策）。
> - **初始扫描（779dea3）未发现明确的功能性 bug**；计划内安全加固归入独立批次 4 并前置决策 D1。后续新增问题按各自业务影响与人工决策边界处置，与纯重构严格分离（红线 R2）。

## 索引

**现时44项（2026-10-16，3e前置只读盘点）**：新增TD-WEB-006商业controller创建与部分route读取门控差异、TD-WEB-007旧异步挂载缺会话代际复核，两者仅登记、实际触发/生产影响待核实，不实施旧行为修复。新lazy自身的路由/销毁隔离不能冒称已修旧entry/mount，原42及历史原文保留。

**现时42项（2026-10-16，3c⑪只读复核）**：新增TD-PERF-003文档读缓存失败回调代际风险待核实，仅登记不修；原41及更早计数保留，不推论跨账号数据泄露。

**现时41项（2026-10-16，3c⑩旧编辑器护栏）**：新增TD-WEB-005，仅登记旧构建合成文档历史比较后的布局遮挡实测，不修业务。旧40及更早计数保留；具体CSS成因、真实生产数据影响待核实。

**现时40项（2026-10-16，3c共享装配）**：新增TD-TEST-007，仅登记源码断言跨域精度缺口，不修原114/fixtures/expect，不推论在线文档业务有bug；原39及更早计数均保留为当时时点历史。

**TD-WEB-004存量投影登记（2026-10-16，现39项，原38历史保持）**：3c③旧实现CDP前发现，独立只读复核确认正常mount过滤遗漏三族合同文档权限，仅登记不修、不影响守恒迁移。9b52443 bootstrap:687–733前缀仅contract:，111–119类型却含contract-document:/contract-ocr:/contract-signature:；mount:10910–10914过滤后构造controller，load:1240等无法取文档，2990等由空views生成列表。779dea3/85affd3同缺口，实际函数擦类型VM执行日志 `/tmp/kingturf-contract-permission-projection-2026-10-16.log` 中三族六能力false、contract:read/sign true；旧Chrome doc row缺失仅作一致现象，不以缺行单独证明根因。影响限定前端已授予权限的投影/可达性，不推论后端越权、实际生产授予或contract:sign记录回执不可达；API对文档GET仍单独authorizeQuery。修复会改变前端可达行为，须独立授权、独立提交与真实mount回归，当前不得补前缀/改认证/绕过过滤器。详见3c③证据。

**TD-TEST-007登记（3c共享读源）**：冻结的在线文档广源测试`embeds controlled templates`原读取整个bootstrap+contextual-documents+document-library，`'/submit'`原唯一匹配是eb86107 bootstrap:2197 CTR旧面板，而非文档编辑器动作；后者使用动态action路径。只读独立复核确认原三源匹配范围，已证此关键词不能单独保障文档提交实现；真实文档提交行为与其他护栏覆盖待核实，不是文档业务bug或迁移回归。当前只把真实迁移目标workspace-legacy-panels以唯一非空锚并回同一广源集合、保持全部expect字面，不用伪造字符串或修改业务迎合测试，不称文档提交已覆盖。是否原意允许跨域粗观察、是否另补专门行为护栏留阶段5/独立决策，本轮不修；当前40项，原39历史不改。

**TD-TEST-006再次工具收口（2026-10-16，3c⑥）**：先复开登记于业务3f77a81，后独立工具830d1fb稳定干净实际HEAD完整CI0/177187.409ms，业务零diff。FbxNIM首次scroll前metrics1440但app-shell mobile/侧栏无纵向overflow，随后desktop侧栏1488>1000、目标y1071，已证该轮viewport指标先于resize handler；仅加强原同一次60×50ms等待，shell/已有commercial类按640/1024同步，不改click唯一scroll/3秒/命中/物理事件/网络/Playwright。延迟类别VM旧真红→原10不动＋新3/纯JS23绿，提交前myDiOW/提交后7FXldH两次无trace28真0、网络三零/资源清理全真；源码3f77a81独立完整CI0/170456.489ms。类别匹配不证明CSS全过渡结束，不将该因果追认前三轮，也保留诊断观测影响和有限竞态边界；39项不新增。详见[⑥证据](../evidence/frontend-3c6-operations-2026-10-16.md)。

**TD-TEST-006复开（2026-10-16，3c⑥，历史时点）**：全28两次无trace稳定点击超时，既有trace-nav诊断28绿不覆盖首失败；新增四页probe只在失败后读取锁定节点，第三次CQwqNj在procurement desktop1440×1000记录connected实际按钮y1110/高37、中心在viewport外、hit=null、无剩余动画，资源均清理。故当时至少存在首次scroll后最终目标仍在屏外的工具可靠性问题；何时失效/布局或滚动因果待独立定位，不能称业务回归或生产UI故障。先复开登记，任何工具修正须独立最小提交、旧红新绿，不改业务/原3秒/真实节点命中与网络硬闸；条目仍39顶层项，不抹旧收口史。详细日志及边界见⑥证据。

**TD-TEST-006工具收口（2026-10-16，历史时点）**：单责修正3f3aae7稳定干净实际HEAD全CI0/184806.065ms，旧driver移动目标用例真红→新10/纯JS总16绿，提交前/提交后两次无trace合并13绿且未知网络零/自有清理全真；源码9429a31独立全CI0、业务源码随工具零diff。本测试工具条目当时已修复，采样到派发仍有有限竞态，不由新绿反推旧两次失败根因全证；原37历史保持、当时38项，详细边界与完整失败史见3c②证据。

**CDP工具登记（2026-10-16，现38顶层项，原37历史保持）**：新增TD-TEST-006，仅本批自有合成浏览器驱动可靠性，业务行为影响无。旧driver单帧命中后再次scroll/取点、未等导航布局稳定；真实诊断看到13.3ms内目标下移25px、同坐标变邻项命中，但前两次导航失败的实际事件target未捕获，根因不作全证声明。先登记，随后只做独立最小工具修正和负向验证，不改业务/Playwright/原超时/断言/网络硬闸。

**E1现时更新（2026-10-16）**：父项2f/GATE003已人工验收b575b9c；E1已授权守恒去嵌套并撤例外，完整CI0/0硬31软，不再是32。下面原A/B待验收/32说明保留旧时点，E1关闭及前端停报不改其他债务。

**本轮现时更新（2026-10-16，A/B待人工验收）**：TD-PERF-002的13/13判定完成，7确证仅登记R1–R7修复/6有界误报关闭该候选；TD-GATE-003扫描覆盖已修复，仍留E1精确限期例外。32信息豁免＝旧31逐条保持＋1，台账仍37顶层项。下方旧“未修复/未判定”登记及7/24口径按历史时点保留，不当作当前状态；生产性能未实测、不是全体风险已消除。

**登记现状更新（2026-10-16，TD-GATE-003）**：当前登记37条（包含已解决历史项）；新增P1工程门禁覆盖缺口，静态遗漏已证、未修复／动态影响待核实，业务行为影响无。仅本独立登记获R4授权，旧36条正文/索引和处置历史不回写。

**登记前快照（原36条，保留原文）**：

当前登记36条（包含已解决历史项）；TD-REG-001迁移求值/receiver回归已协调确认解决并按本轮授权留存，原35条与历史时点保持，不改其他债务状态。

| ID           | 标题                                                                                          | 严重度 | 类别           | 业务行为影响             | 关联批次                           | 状态                            |
| ------------ | --------------------------------------------------------------------------------------------- | ------ | -------------- | ------------------------ | ---------------------------------- | ------------------------------- |
| TD-WEB-001   | bootstrap.ts 16,082 行巨石文件，七种职责混合                                                  | P1     | 复杂度         | 无                       | 批次 3                             | 已实施待人工验收                |
| TD-WEB-002   | commercialWorkspaceStructure 单函数 ≈8,551 行                                                 | P1     | 复杂度         | 无                       | 批次 3                             | 已实施待人工验收                |
| TD-WEB-003   | bootstrap.ts 深嵌套：≥4 层 8,603 行，最深 14 层                                               | P2     | 复杂度         | 无                       | 批次 3                             | 已实施待人工验收                |
| TD-WEB-004   | 登录商业权限投影遗漏合同文档/OCR/电子签三族前缀                                               | P2     | 前端权限投影   | 修复 bug（若实施）       | 3c③仅登记，后续独立决策            | 待独立授权修复                  |
| TD-WEB-005   | 旧在线文档历史比较后版本按钮中心被命令栏遮挡（合成夹具实测）                                  | P2     | 前端布局       | 修复 bug（若实施）       | 3c⑩仅登记，后续独立决策            | 成因/生产影响待核实             |
| TD-WEB-006   | 部分商业只读权限可见route但不满足controller创建条件                                           | P2     | 前端门控       | 修复 bug（若实施）       | 3e仅登记，后续独立决策             | 触发/生产影响待核实             |
| TD-WEB-007   | 旧异步工作台挂载结束前未复核当前会话代际                                                      | P2     | 异步生命周期   | 修复 bug（若实施）       | 3e仅登记，后续独立决策             | 触发/生产影响待核实             |
| TD-WEB-008   | 旧工作区替换后跨安装批次可能产生多个详情抽屉闭包                                              | P2     | 前端生命周期   | 修复 bug（若实施）       | 3e②仅登记，后续独立决策            | 动态触发/生产影响待核实         |
| TD-WEB-009   | 挂载冲突恢复页“返回登录”被paused写门禁本地拦截                                                | P2     | 会话恢复       | 修复 bug                 | S4真实Chrome发现/bfdc4ff           | 实施完成待整批验收              |
| TD-API-001   | buildApp 单函数 ≈6,442 行、230 个顺序路由分支，吞掉 Service 层                                | P1     | 架构/复杂度    | 无                       | 批次 2                             | 待处理                          |
| TD-API-002   | app.ts 深嵌套：≥7 层 3,202 行，最深 14 层                                                     | P2     | 复杂度         | 无                       | 批次 2                             | 待处理                          |
| TD-REG-001   | QTC 前六模块提前读取仓储根，违反旧求值/receiver契约                                           | P1     | 重构回归       | 修复 bug（恢复旧契约）   | 2b独立回归恢复                     | 已解决（留历史）                |
| TD-DUP-001   | 数据范围(DataScope) SQL 谓词在 12 个文件各复制一份                                            | P1     | 重复/安全      | 无                       | 批次 1                             | 已完成                          |
| TD-DUP-002   | audit_events + domain_event_outbox 双写 44 处/20 文件                                         | P1     | 重复           | 无                       | 批次 1                             | 已完成                          |
| TD-DUP-003   | 幂等键查询样板 23 行重复                                                                      | P2     | 重复           | 无                       | 批次 1                             | 已完成                          |
| TD-DUP-004   | 前端日期格式化内联 12 处                                                                      | P2     | 重复           | 无                       | 批次 3                             | 已完成（待整批人工验收）        |
| TD-ARCH-001  | foundation-repositories.ts 一文件 4 仓储 + 全仓仅有的 29 处代码级 any + 文件级 eslint-disable | P2     | 架构/类型      | 无                       | 批次 1                             | 已完成                          |
| TD-ARCH-002  | CommercialController God store：load() 一次拉取 30+ 端点                                      | P2     | 架构           | 无                       | 批次 3                             | 已实施待人工验收                |
| TD-BOUND-001 | API 响应边界无运行时形状校验（`as T` 裸转）                                                   | P1     | 架构（T4/T5）  | 无                       | 批次 3                             | 轻量已知边界实施待验收          |
| TD-BOUND-002 | 入站请求体校验为逐路由手写调用，无声明式 schema                                               | P2     | 架构           | 无                       | 批次 2                             | 待处理                          |
| TD-BOUND-003 | calendarDate 放行不存在的日历日期到仓储，真实 PG 影响待核实                                   | P2     | 边界校验       | 变更行为（若收紧）       | 待独立人工决策，不在当前 2b 修复   | 待核实                          |
| TD-BOUND-004 | complaint batch 字符串去重放行同一 UUID 大小写变体，真实副作用待核实                          | P2     | 边界校验       | 变更行为（若收紧）       | 待独立人工决策，不阻塞 2b 守恒迁移 | 待核实                          |
| TD-SEC-001   | 全链路无 Content-Security-Policy                                                              | P1     | 安全           | **变更行为**             | 批次4/前置D1                       | RO完成已验收/强制段开放         |
| TD-SEC-002   | API 无限流/429，登录爆破仅 scrypt 成本兜底                                                    | P1     | 安全           | **变更行为**             | 批次4/前置D1                       | 登录范围实施完成/已验收         |
| TD-SEC-003   | 会话 token 存 sessionStorage，XSS 可读                                                        | P2     | 安全           | **变更行为**             | 批次4/六项实施                     | 载体实施项已关闭/整批交验待确认 |
| TD-SEC-004   | API 自身不设安全响应头，仅依赖生产 nginx                                                      | P2     | 安全           | **变更行为**             | 批次4/前置D1                       | 实施完成/已验收                 |
| TD-SEC-005   | 动态 SQL 片段拼装面广，缺结构性约束防回归                                                     | P2     | 安全/门禁      | 无                       | 阶段 3（结构测试）                 | 已完成                          |
| TD-SEC-006   | complaint 锚点谓词语义弱于其他域（osr 单表、TEAM 无 depth、无组织有效性校验）                 | P2     | 安全/一致性    | **变更行为**（若统一）   | 待决策（批次 1 后）                | 待处理                          |
| TD-SEC-007   | foundation 通知收件人谓词缺省省略 actor_org/authorized_org 两处组织有效性 JOIN                | P2     | 安全/一致性    | **变更行为**（若统一）   | 待决策（批次 1 后）                | 待处理                          |
| TD-PERF-001  | 前端无自动重试/断路，失败依赖人工重试按钮                                                     | P2     | 性能           | **变更行为**（仅实施时） | 待排期                             | 待处理                          |
| TD-PERF-002  | 13 处 N+1 候选已判定；7项修复待排                                                             | P2     | 性能           | 无                       | 批次 2（子批 2f）                  | 已判定／待修复                  |
| TD-PERF-003  | 文档旧请求失败可能删除clear后同path新缓存Promise                                              | P2     | 异步缓存       | 修复 bug（若实施）       | 3c⑪仅登记／后续独立授权            | 触发/生产影响待核实             |
| TD-TEST-001  | 2 个仓储模块完全无测试，2 个近乎无覆盖                                                        | P1     | 测试           | 无                       | 阶段 5                             | 待处理                          |
| TD-TEST-002  | 无任何覆盖率配置与阈值                                                                        | P1     | 测试/门禁      | 无                       | 阶段 5                             | 待处理                          |
| TD-TEST-003  | 6 个仓储模块仅 mock 路由级测试，SQL 路径未验证                                                | P2     | 测试           | 无                       | 阶段 5                             | 待处理                          |
| TD-TEST-004  | packages/ui、packages/testing 的占位测试                                                      | P2     | 测试           | 无                       | 阶段 5（前置 D3）                  | 已完成                          |
| TD-TEST-005  | packages/types 占位测试：纯类型包的测试策略未定                                               | P2     | 测试           | 无                       | 阶段 5                             | 待处理                          |
| TD-TEST-006  | 自有CDP稳定性：旧点击/viewport历史修复；S4未分类异步失败后继候选                              | P2     | 测试可靠性     | 无（仅工具）             | 批次3/S4后继                       | 历史已修/新候选待核实           |
| TD-TEST-007  | 在线文档广源 '/submit' 实际只命中CTR旧面板，不能单独保障文档提交                              | P2     | 测试精度       | 无                       | 阶段5／另行授权                    | 仅登记，待独立补护栏            |
| TD-TEST-008  | 新增CDP客户360合成详情遗漏服务端必需字段                                                      | P2     | 测试夹具契约   | 无（工具修正）           | 3f前置独立工具                     | 已修复验证                      |
| TD-TEST-009  | 三份临时AST证明encoder返回truthy而漏比后续子节点                                              | P1     | 证明工具       | 无（工具修正）           | 3f后独立工具/证据收尾              | 已修完整重核                    |
| TD-TEST-010  | Docker owned schema信用种子缺已装public.pgcrypto可见性                                        | P2     | 测试环境       | 无（仅工具）             | Docker前置补跑                     | 环境已修/信用通过，整seed另阻断 |
| TD-TEST-011  | 冻结P1种子生产关单缺实际成本批准，HTTP500/P0001                                               | P1     | 种子业务前置   | 已修（人类另授最小本地） | Docker前置补跑                     | 本地前置已验证/补跑未完成       |
| TD-TEST-012  | 冻结文档发送PW旧header索引在额外strict tsc下类型不匹配                                        | P2     | 测试静态类型   | 未修（仅额外诊断）       | 后继独立授权                       | 待核实原门禁/运行影响           |
| TD-TEST-013  | 成本转报价原成功提示可见性PW失败，前跳转/预选成功                                             | P2     | UI/oracle边界  | 未修（非S4范围）         | Docker首轮发现/待独立裁定          | C7待裁/候选根因未干预实证       |
| TD-TEST-014  | Workspace旧PW夹具首次读取gate/360必填字段不兼容                                               | P2     | 合成测试夹具   | 等待点/字段已授验证关闭  | Docker首轮发现/5230625字段许可     | 真实变异红/还原原4例过          |
| TD-TEST-015  | Source旧合成应收游标页缺nextCursor                                                            | P2     | 合成测试夹具   | 字段实施已验证关闭       | Docker首轮发现                     | 缺字段/auth真红绿，原3例过      |
| TD-TEST-016  | P1原浏览器11例失败定位待核                                                                    | P2     | 本地浏览器回归 | C7可见性待裁             | Docker首轮发现                     | 前两例隐藏/其余不推定           |
| TD-TEST-017  | 私有reporter构造options兼容缺口                                                               | P2     | 本地回放工具   | 兼容实施验证关闭         | 原生调用形状回归发现               | unit6/PW接线实证                |
| TD-TEST-018  | 私有浏览器preview上游连接超时                                                                 | P2     | 本地回放环境   | 只登记/待核实            | 安全relay事件                      | active CONNECT_TIMEOUT          |
| TD-GATE-001  | 无 git hooks / commitlint / lint-staged，脏提交仅靠 CI 兜底                                   | P1     | 门禁           | 无                       | 阶段 3                             | 已完成                          |
| TD-GATE-002  | vitest 无配置文件，参数散落各包 scripts                                                       | P2     | 门禁           | 无                       | 阶段 3                             | 已完成                          |
| TD-GATE-003  | routes覆盖已修复；E1已撤，恢复31旧豁免                                                        | P1     | 工程门禁       | 无                       | 独立门禁任务／阶段5前复核          | 已验收                          |
| TD-DOC-001   | 无 AGENTS.md；docs/ 85+ 文档无统一索引与目标结构                                              | P1     | 文档           | 无                       | 阶段 2（前置 D4）                  | 已完成                          |
| TD-DOC-002   | 常驻文档未全量与代码核对（抽查 3 份即发现 1 处端点漂移）                                      | P2     | 文档           | 无                       | 阶段 3（文档园丁）                 | 待处理                          |
| TD-VER-001   | 版本号全部 0.0.0 占位，发布标识 = commit SHA                                                  | P2     | 依赖/版本      | 无                       | D2 已决策（保留 SHA）              | 已完成                          |
| TD-HYG-001   | 本地验收产物滞留工作区；packages/ui、testing 近空壳                                           | P2     | 文档/工程卫生  | 无                       | D3 已执行                          | 已完成                          |
| TD-HYG-002   | 旧preview Dockerfile仍COPY已删除testing/ui包                                                  | P2     | 构建/工程卫生  | 无业务变化（修复需另审） | S2只登记，后续独立处理             | 待核实/未修复                   |

---

## 重构回归

### TD-REG-001｜QTC 前六模块提前读取仓储根，违反旧求值/receiver契约

- **位置**：起点7251b08的app.ts:2618,2630,2648,2663,2681,2697,2713及qtc-base-reads、qtc-operational-reads、qtc-credit-writes、qtc-credit-approval、qtc-contract-create、qtc-contract-sign六模块，共12canonical。
- **类别**：重构回归 ｜ **严重度**：P1 ｜ **状态**：已解决（2026-10-14，f8059a8/ab0f3d4经协调复核确认，按本轮授权保留历史台账项；不关闭TD-API/TD-BOUND或其他安全债，不等于整体2b验收）。
- **解决协调证据**：固定源码CI124751ms/HEAD125573ms真实exit0/API1078852、QTC PG2/doclint103/structure0违规31豁免/build/audit绿/干净树；协调65mock-only8469/8469、独立深审七late inject/六module捕获点/refs/335固定guard及旧2389/探针限制无阻塞。51182b7以后工件零diff，before154fail181pass→after335green保持；revert f8059a8会重新暴露已固定335套件中的154回归红灯，不应改预期消红。仅directmock旧求值/receiver恢复，不当作产品决策或已证生产漏洞；本轮QTC全域文档收尾不改源码，最终文档HEAD另完整门禁。
- **恢复证据（2026-10-14）**：登记acba392、固定旧护栏51182b7、修复f8059a8单独提交。旧c7833e7/起点7251b08的12入口166场景、335契约在修复前154失败/181通过，恢复后335全绿，旧十组2389零diff；合计2724/2724、相关8659/8659、前后QTC PG2/2、独立review/byte还原/源码固定完整CI真实0（API107/8852）。范围仅七处注入/六模块repository-method捕获及receiver绑定，后四QTC/SQL/产品规则不动，directmock/非hermetic历史依赖及参数值限制见计划§4.2.7。最终状态文档HEAD另完整CI复验；回滚fix f8059a8会重现被冻结的红灯，登记/护栏/日志可独立revert，原35条及TD-BOUND/D1/TD-API/评分不扩。
- **证据**：旧c7833e7:app.ts2588–2756在授权/前置query/allow/decision校验之后才取得root-method；迁移后factory context提前读取第二次根。directmock allow ownKeys替换整个依赖根：旧credit-limit201/second receiver，7251b08当前201/first receiver；第二根getter异常还能改变错误优先级。协调与独立只读源码核验已确认，主代理可复算探针及护栏另落盘；原2389契约不覆盖该边界，不能因其绿否定差异。
- **影响边界**：仅已证directmock可变依赖注入的求值时序与接收者回归，未验证生产依赖动态替换，非已证生产权限漏洞；不改变产品、DataScope、SQL或业务算法，TD-BOUND-003/004/D1不扩。
- **修复建议**：七处注入改晚resolver，六module在旧method点取root-method并保存validated.repository，handler绑定已捕获receiver；后四QTC模块不动。
- **业务行为影响**：修复 bug（恢复旧c7833e7契约，不新增产品行为） ｜ **关联批次**：2b独立回归恢复小步，人工已授权。
- **验收方式**：固定旧基线对拍/变更前真实失败/12入口时点与root计数护栏、十旧组冻结、前后PG2、独立review、代码及文档HEAD完整CI真实0后停协调；状态不凭提取数量关闭。

## 复杂度

**批次3当前实测**：dc3697b稳定干净HEAD完整CI0/178446.705ms；root749/商业完整函数158/格式5，全web源最大文件749、完整函数191、AST5。TD-WEB001/002/003实施完成待人工验收；TD-ARCH002按首访route/权限闭包lazy收口，overview及公开load/refresh原全量兼容保留；TD-BOUND001按轻量已知schema范围收口，unknown动态透传而非任意T深证明。细节/旧问题保留/真实验证与评分见[整批验收包](../evidence/frontend-batch3-acceptance-2026-10-17.md)，下方基线原文不回写。

### TD-WEB-001｜bootstrap.ts 16,082 行巨石文件，七种职责混合

- **位置**：`apps/web/src/bootstrap.ts`（全文件）
- **类别**：复杂度 ｜ **严重度**：P1
- **证据**：度量脚本计 16,082 行（`wc -l` 同文件为 16,081，口径差异见台账头部），占全部非测试源码（48 文件 / 41,451 行）的 **38.8%**。单文件同时承担：①33 个内联 type 定义 ②2 个 API 客户端工厂（`createFetchCommercialApi`/`createFetchCrmApi`）③3 个带可变状态的 Controller 类（`CommercialController`:1427、`CrmController`:10590、`GovernanceController`:14572）④全部 DOM 构建与表单引擎（`openForm`:11932 一带）⑤路由（`setAppRoute`:12296 一带）⑥localStorage 视图/侧栏持久化（4 处 `localStorage.` 访问）⑦打印与本地化文案。
- **修复建议**：按业务域拆分为分域视图模块 + 公共 shell/form/http-client/routing 模块；配合阶段 3 的文件大小上限门禁（T1）防止回潮。
- **业务行为影响**：无（纯重构）
- **关联批次**：批次 3 ｜ **验收方式**：文件行数门禁全绿 + 启动预算断言（`check-startup-budget.mjs`）+ `bootstrap.test.ts` 70 用例全绿 + `git diff` 行为零变化抽查

### TD-WEB-002｜commercialWorkspaceStructure 单函数 ≈8,551 行

- **位置**：`apps/web/src/bootstrap.ts:1851-10401`
- **类别**：复杂度 ｜ **严重度**：P1
- **证据**：度量脚本函数跨度分析：起止行 1851→10401，跨度 ≈8,551 行；函数内一次性构建 21 个商业子域视图（`data-route-view` 属性实测清单，线索→商机→报价→订单→生产→发货全链路）。
- **修复建议**：按子域拆分为独立 view builder，每个 ≤800 行（阈值在阶段 3 定死并机械化）。
- **业务行为影响**：无 ｜ **关联批次**：批次 3 ｜ **验收方式**：同 TD-WEB-001 + 新增结构测试断言"单函数 ≤ 阈值"

### TD-WEB-003｜bootstrap.ts 深嵌套

- **位置**：`apps/web/src/bootstrap.ts`（全文件）
- **类别**：复杂度 ｜ **严重度**：P2
- **证据**：缩进直方图（脚本复算）：≥4 层 8,603 行（占 53.5%）、≥7 层 3,893 行、最深 14 层。
- **修复建议**：随批次 3 拆分自然消解大部分；残余热点用早返回/卫语句压平。
- **业务行为影响**：无 ｜ **关联批次**：批次 3 ｜ **验收方式**：嵌套直方图指标下降（脚本前后对比输出）

### TD-WEB-005｜旧在线文档历史比较后版本按钮被命令栏遮挡

- **位置**：5ec8a65 `apps/web/src/bootstrap.ts:1723` 历史版本回调与 `apps/web/src/style.css:555,625,834` 工作区/布局/历史栏；当前业务源码未改。
- **类别**：前端布局 ｜ **严重度**：P2
- **实测证据**：新未冻结CDP编辑器护栏，1440×1000、合成120段V2文档，经纸张/125%缩放/自适应→纵向/预览→编辑及V1比较后，J8ArKa的V2按钮中心命中commandbar，layout高度0、history clientHeight32、workspace868/scrollHeight2510。原33及前两新case共35绿后真实exit1，日志`/tmp/kingturf-3c10-old-cdp37-diagnostic-2026-10-16.log`；首j9qPOS同处超时但无几何，不能倒推其根因全证。两轮自有preview/root/profile均清理。
- **边界与待核实**：静态CSS为两显式grid行、比较区在第三child，存在隐式行分配候选原因，但精确因果及生产真实文档影响待独立核实。只读独立复核确认不是桌面默认history-collapsed；不据此修CSS、改click预算或强制DOM点击。
- **当前处置**：仅登记。新未提交护栏限定验证V1比较/当前V2状态与正文节点不变，随后真实关闭/重新打开恢复V2再验证译文；不再宣称覆盖同一次比较后点击V2返回。保留首失败与范围撤回记录，冻结原114/457、原CDP29及register四项不改。
- **业务行为影响**：修复 bug（若实施） ｜ **关联批次**：3c⑩仅登记，后续独立授权/提交 ｜ **验收方式**：独立最小复现与真实可达UI回归，当前未修复。

### TD-WEB-006｜部分商业读取route与controller创建门控不一致

- **位置**：b2e2a53 `apps/web/src/bootstrap.ts:150–177`（visibleAppRoutes）、`:272–325`（visibleCommercialSections）及`:936–940`（controller创建）；`commercial/permissions.ts`保留相关权限族。
- **类别**：前端门控 ｜ **严重度**：P2 ｜ **状态**：仅登记，触发/生产影响待核实。
- **静态证据**：collection/quality-plan/quality/traceability/complaint/complaint-sla/shipment/manufacturing-cost读取权限可使相关route可见，load也有对应读取源，但visibleCommercialSections没有这些族的独立布尔项；只持这些权限时Object.values(...).some(Boolean)可能为false、不创建controller。主代理直接读取与独立scout复核一致，未做真实账号/DOM复现，不认定实际生产授予或所有权限组合均失效。另payments route可由reconciliation读取可见、panel却要求bank-payment读取，属于待核实的既有门控差异，不擅改为权限放宽。
- **与旧债区别**：TD-WEB-004是合同文档三族被isCommercialPermission前缀过滤；本项相关族并未被该函数过滤，而是之后的controller创建或panel门控，不能当作同一前缀修复。
- **当前处置/业务影响**：仅登记；若实施为修复bug，需独立授权/提交与真实mount权限组合回归。3e纯store迁位及lazy保留原controller创建条件，不新增读取权限/补前缀/更改后端认证。新lazy依赖表只与已有read权限取交集，不借此修本项。

### TD-WEB-007｜旧异步工作台挂载缺会话代际复核

- **位置**：b2e2a53 `apps/web/src/entry.ts:172–199`、`bootstrap.ts:945–995`、`session.ts:9–20`。
- **类别**：异步生命周期 ｜ **严重度**：P2 ｜ **状态**：仅登记，实际触发/生产影响待核实。
- **静态证据**：entry在session校验成功后await workspace模块再mount；mount等待三域加载后直接构建并replaceChildren，未再核token/root代际。session.expireSession的token比较只阻止旧401登出新会话，不是旧成功挂载的提交检查。主代理/独立scout核验同，原route-isolation只锁路由DOM隔离/搜索值，不能冒称覆盖此场景。没有跨会话浏览器复现或生产证据，不推论数据泄露或后端会话模型缺陷。
- **当前处置/业务影响**：仅登记；若修旧entry/mount为独立行为修复，需授权/提交。3e新lazy产生的异步route任务必须自身绑定controller/shell并在销毁后不触碰其它shell；这不是修复既有顶层mount竞态，不变更token模型/storage key/登出语义，TD-SEC与D1不扩。
- **验收方式**：后续独立最小合成复现旧会话慢完成/新会话先完成及失败边界，再决策修复；本轮不以静态缺少检查当已证动态覆写。

### TD-WEB-009｜挂载冲突恢复页“返回登录”被暂停写门禁拦截

**交验核账**：bfdc4ff精确退出窄修与9新增测试/真变异、API/Web全量、原失败DOM链已验证，f114ee0实际干净HEAD完整CI0/192524.18ms含该修复；实施完成待本次整批验收，不再标待独立修复。未放宽其它写/原proof/服务端校验。下方为发现/实施时点记录。

**历史：窄修实施bfdc4ff／当时工具CI待执行**：新增9单测真红绿/实现变异、API17242/Web313及真实Chrome原失败链退出204→重登通过；后继完整DOM8/网络协议14/Node4与清理9完成，当时最后工具提交后完整CI仍待执行、SEC003未关闭。当前状态以上方交验核账为准；下方“尚未实施”为登记时点。

**后继裁定**：协调/frontier确认是既授S4退出契约内部实现矛盾，可独立窄修精确当前上下文POST logout的本地暂停检查，原current/generation/CSRF/服务端及响应归属不动，不resume/restore/replay、不放开其它unsafe。见[修复映射](../evidence/security-batch4-s4-paused-logout-2026-10-17.md)，尚未实施/验证。

- **位置**：`apps/web/src/entry.ts:243`、`startup-failure.ts:40`、`http.ts:30`。
- **类别**：会话恢复 ｜ **严重度**：P2 ｜ **业务行为影响**：修复 bug（若实施）。
- **证据**：真实隔离API/PG/自然Chrome DOM登录后，挂载employees头barrier期间invalidate触发同代复验；释放后挂载verify再次pause owner并进入失败页。点击返回登录后固定诊断logoutRequests=0、hasLoginForm=false、retryFailureVisible=true，两次同位置超时；独立只读源码因果复核一致。详情/日志/清理见[S4网络证据](../evidence/security-batch4-s4-network-2026-10-17.md)。刷新入口仍可用，不外推生产影响或会话泄露。
- **处置**：仅登记，不顺手放宽全局unsafe门禁。后续独立修复须明确退出的captured context/当前代际/Origin/CSRF与无自动重放边界，保留失败证明并验证同场景真实logout204和重登；当前未实施、未全CI。

### TD-WEB-008｜旧工作区替换后跨批次列表可能保留多个详情抽屉闭包

- **位置**：固定旧基线b210c77 `apps/web/src/bootstrap.ts` 的`replaceRouteView`、`shared/workspace-list-tools.ts` 的`installWorkspaceListTools`与`shared/register-drawer.ts`的`createRegisterDrawer`。
- **类别**：前端生命周期 ｜ **严重度**：P2 ｜ **状态**：仅登记，动态触发/生产影响待核实。
- **静态证据**：旧商业工作区替换后默认再安装列表工具，每次安装创建独立drawer闭包；仍在壳中的CRM旧列表绑定旧闭包、新商业列表绑定新闭包。分别打开详情可能产生多个`.record-detail-drawer`。协调与独立reviewer核对固定旧源码一致，未执行旧写后替换浏览器复现，不认定生产故障。
- **当前处置/业务影响**：不修改旧默认安装语义，不扩展全局抽屉修复。3e新lazy分批安装使用显式`reuseDrawer`选项复用同shell最近一次安装绑定，仅消除新首访增量触发；不能宣称全部历史列表共享唯一抽屉。旧问题修复若实施须独立授权与行为提交。

### TD-API-001｜buildApp 单函数 ≈6,442 行、230 个顺序路由分支

- **位置**：`apps/api/src/app.ts:383-6824`
- **类别**：架构/复杂度 ｜ **严重度**：P1
- **证据**：函数跨度分析 383→6824（≈6,442 行）；`grep -c 'request.method ==='` = 230 个顺序 if 分发分支；每个分支内联"校验+授权+编排+SQL 调用+DTO 组装"，本应存在的 Service 层被吞掉。现有测试保护：`app.test.ts` 35 用例（mock 注入）+ 13 个 PG 集成测试。
- **修复建议**：改为声明式路由表 + 分域 handler 文件；显式抽出 Service 层（Types→Config→Repo→Service→Runtime→UI 分层的存量适配起点，§4.1）。
- **业务行为影响**：无 ｜ **关联批次**：批次 2 ｜ **验收方式**：`pnpm test` 全绿 + 新增路由结构测试（路由表与实际行为对拍）+ 集成测试回归

### TD-API-002｜app.ts 深嵌套

- **位置**：`apps/api/src/app.ts`（全文件）
- **类别**：复杂度 ｜ **严重度**：P2
- **证据**：缩进 ≥4 层 6,392 行、≥7 层 3,202 行、最深 14 层（if 分发→try/catch→校验→事务→条件 DTO 纵向叠加）。
- **修复建议**：随批次 2 路由表化消解。
- **业务行为影响**：无 ｜ **关联批次**：批次 2 ｜ **验收方式**：嵌套直方图指标下降

## 重复

### TD-DUP-001｜数据范围(DataScope) SQL 谓词 12 份拷贝（已完成）

- **位置**：`apps/api/src/` 下 12 个文件（commercial、commission、complaint、crm、dashboard、foundation、order-360、platform、qtc、repositories、risk 各 \*-repositories.ts 及 `policy.ts`）；样例：`crm-repositories.ts:183`、`commercial-repositories.ts:76`
- **类别**：重复/安全 ｜ **严重度**：P1
- **关闭证据（2026-10-12）**：`rg -n 'organization_scope_relationships' apps/api/src --glob '*.ts'` 命中仅 `scope-sql.ts`；`rg -n 'customerScope|scopePredicate|recipientScope' apps/api/src --glob '*.ts'` 无生产 helper 定义（`repositories.ts.#scoped` 仅委托 `employeeScopedPredicate`）；所有 repository 调用均导入 `recordScopeSql`、`employeeScopedPredicate` 或 `auditScopePredicate`。完整 scope 对拍、API 全量和 `pnpm ci:local` 均通过。共享出口为 `recordScopeSql`、`employeeScopedPredicate`、`auditScopePredicate`；complaint 的 `relationshipOnly` 与 foundation 的 `actorOrganizationValidation: 'skip'` 显式语义选项保留，TD-SEC-006/007 继续待决。
- **修复结果**：已下沉到共享 `scope-sql` 模块，12 个重复定义清零；回滚点分别为 `56e6603`、`b33813c`、`809e3e8`、`61adc15`、`2540f12`、`f810229`（按子批次独立回滚）。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：PG 集成测试全绿（含 DataScope 用例）+ `grep -l` 计数降为 1 个定义文件 + 对拍（同输入同结果）

### TD-DUP-002｜审计+事件外发双写 44 处/20 文件

- **位置**：`apps/api/src/` 20 个文件；样例 `crm-repositories.ts`（auditEvent）、`commercial-repositories.ts:81-97`（evidence）
- **类别**：重复 ｜ **严重度**：P1
- **证据**：`INSERT INTO audit_events` 出现 31 处/20 文件；`INSERT INTO domain_event_outbox` 13 处；两连写模式逐 repository 复制，字段顺序略异。
- **修复建议**：统一 `writeAuditWithOutbox` 共享助手（事务内两连写一处实现）。
- **关闭证据（2026-10-13）**：生产 `INSERT INTO audit_events` 与 `INSERT INTO domain_event_outbox` 定义仅位于 `apps/api/src/audit-outbox.ts`；其余命中均为 outbox 读取/更新或业务 RETURNING。标准两连写、固定版本、next-version、显式 audit-only、business-document outbox 与 foundation enqueue 均已通过显式出口收敛。全量 API、database、web、domain、build、security audit 与 `pnpm ci:local` 通过；TD-DUP-003 不变，TD-SEC-006/007 保持待决。
- **试点进展（2026-10-12）**：qtc、manufacturing、commission 三域已收敛至 `apps/api/src/audit-outbox.ts:writeAuditOutbox`，替换 13 个调用点；其余 17 个文件保持未修改，TD-DUP-002 继续处理中。试点提交 `d47d48c`，`audit-outbox` 单测、三域集成与 `pnpm ci:local` 全部通过。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：集成测试中审计与 outbox 断言全绿 + grep 计数下降（前后数值入进度日志）

### TD-DUP-003｜幂等键查询样板 23 行重复

- **位置**：`apps/api/src/command-results.ts:13,29,62`；commercial 接入点 `apps/api/src/commercial-repositories.ts:83-90`（7 个 replay + 7 个 retain 调用）；qtc 接入点 `apps/api/src/qtc-repositories.ts:43-61`（9 个 command 调用）。
- **类别**：重复 ｜ **严重度**：P2
- **最终证据（2026-10-13）**：只读复核命令 `rg -n "pg_advisory_xact_lock|SELECT .*idempotency_key.*FROM|crm_command_results|commercial_command_results|commandLock|eventReplay" apps/api/src apps/api/test packages/database/migrations`；commercial/qtc 的同语义表为 `commercial_command_results(tenant_id,idempotency_key,command_type,subject_id,actor_id,request_hash,payload)`，统一冲突字段为 type/subject/actor/request hash，统一锁参数 `${tenantId}:${key}`，锁后 replay；`command-results.test.ts` 固定 SQL/参数、首写、payload 重放及四类冲突，commercial PostgreSQL 2/2、qtc PostgreSQL 2/2。
- **安全豁免（明确语义差异）**：CRM 仅一个 `LEAD_CLAIM` 命令（`crm-repositories.ts:443,463,504`），表字段为 `command_type/subject_id/payload/request_fingerprint`，锁为双 hash，顺序为锁→DataScope subject→replay；customer activity 是普通业务表幂等。complaint 的 `commandLock` 在 `complaint-repositories.ts:53` 被 11 个不同 namespace 调用，`eventReplay`（`:1211`）由 complaint/ncr 两个动态表调用，依赖 `canonical_hash/evidence/expected_version/state`；foundation notifications（`foundation-repositories.ts:312-342`）先 recipients DataScope，再锁→replay，冲突字段为 `normalized_recipients/semantic_payload`。这些路径没有第二个同语义、可安全共用的固定接口，保留本地实现。
- **其他域复核**：risk（2 个锁/replay）、commission（2）、business-document（2）、platform（3）、website-lead（1）及 qtc 内 4 个 customer credit-ledger 锁均是业务表/状态或资源串行化，不是 command-results 同语义；普通 `idempotency_key` 表路径不纳入共享原语。
- **修复结果**：公共 commercial/qtc lock/replay/retain 原语已收敛；CRM、complaint、foundation 及其他语义不同路径明确豁免，不再强行抽象。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：机械复核命令如上；`pnpm ci:local` 全绿（API 35 文件/260 用例、database 68、web 114、domain 14），另通过 typecheck/lint/format/structure/doc-lint/audit/build；回滚：`git revert 8dcc971`（代码）及对应计划/台账文档提交。

### TD-DUP-004｜前端日期格式化内联 12 处

**实施验证完成（2026-10-16）**：c0a549f实际稳定干净HEAD完整CI0/177552.922ms，179测试/13调用10完整文件逆AST/两实际红绿/扩展47与原29浏览器通过；全runtime locale三实现仅位于shared/business-date（date/dateTime/heading各一），保Date原位及默认时区/回退/receiver，不再以单入口grep当结项。source与完成docs回滚/最终整批人工验收边界见[日期证据](../evidence/frontend-3e-date-2026-10-16.md)；以下候选与原基线为历史，台账仍45项含解决历史项。

**3e③现时候选**：全runtime13处=原12 locale（5日期/7日期时间）+标题Intl，10消费者收敛到shared/business-date三原语，原日期构造/getter/默认时区/回退不变；完整文件逆展开AST和179契约/两真实红绿通过，浏览器及源码实际干净HEAD全CI待补后再结项。下列bootstrap历史位置与“grep为0”口径仅为原始基线，不将入口迁位误作全树收敛。台账仍45项，未实施3f边界行为；见[日期证据](../evidence/frontend-3e-date-2026-10-16.md)。

- **位置**：`apps/web/src/bootstrap.ts`（4091、4440、4498、4786 等分散各处）
- **类别**：重复 ｜ **严重度**：P2
- **证据**：`toLocaleString('zh-CN')`/`toLocaleDateString('zh-CN')` 内联 12 处，无共享 formatter。
- **修复建议**：收敛到共享 `format-date` 工具（一个语义一个实现，信条 B4/T6）。
- **业务行为影响**：无 ｜ **关联批次**：批次 3 ｜ **验收方式**：grep 计数降为 0（formatter 内 1 处实现）+ 快照对拍

## 架构与类型

### TD-ARCH-001｜foundation-repositories.ts 混装 4 仓储 + 29 处代码级 any（已完成）

- **位置**：`apps/api/src/foundation-repositories.ts` facade（当前 14 行）；拆分目标为 `event-repositories.ts`（232 行）、`notification-repositories.ts`（255 行）、`attachment-repositories.ts`（341 行）、`business-object-repositories.ts`（242 行）、`foundation-object-access.ts`（67 行）。
- **类别**：架构/类型 ｜ **严重度**：P2
- **关闭证据（2026-10-13）**：Event、Notification、Attachment、BusinessObject 四个仓储及对象访问 support 已拆出；`foundation-repositories.ts` 仅保留兼容性 re-export，app/server/既有测试 import 路径不变。机械命令 `rg -n '\\bany\\b|eslint-disable' apps/api/src --glob '*.ts' --glob '!*.test.ts'` 实测生产源码 any=0，`foundation-repositories.ts` 文件级 eslint-disable=0（目标文件中的局部 non-null invariant 注释不属于文件级禁用）。foundation API/PG、typecheck、lint、format、structure、doc-lint、build、security 与 `pnpm ci:local` 全部通过。
- **修复结果**：已完成；原始 1,029 行基线不再作为现状，当前 facade 与五个拆分文件行数以本条位置证据为准。JSONB 使用固定 SQL 投影/BusinessObjectSchema，运行时校验边界保留。
- **业务行为影响**：无 ｜ **关联批次**：批次 1 ｜ **验收方式**：文件级 eslint-disable 删除后 lint 全绿 + `foundation-postgres.integration.test.ts` 回归

### TD-ARCH-002｜CommercialController God store

- **位置**：`apps/web/src/bootstrap.ts:1427`（类定义起）
- **类别**：架构 ｜ **严重度**：P2
- **证据**：`load()` 一次并发拉取 30+ 个端点（permission→path 对列表内联），持有 `views Map`（全端点读缓存）、`order360 Map`、`costMatrixDetails Map`、`dashboard`、`revisionState` 等 10+ 可变字段。
- **修复建议**：随批次 3 按域拆分为分域 store；加载策略改为按视图惰性加载。
- **业务行为影响**：无（加载时序不变或仅减少无关请求，若涉及可观察变化需单独登记） ｜ **关联批次**：批次 3 ｜ **验收方式**：路由隔离/竞态 e2e（`workspace-route-isolation.spec.ts`）全绿

**3e②实施前的可观察变化登记（2026-10-16，基线b210c77）**：已获3a→3f连续授权的真实按视图惰性加载另独立提交，不混fc14d50纯迁位。挂载时按裁定后的initial hash读取该route完整依赖闭包与旧read权限交集；overview为保既有全域DOM洞察仍读全域，CRM/治理和独立文档模板请求不宣称仅当前route。每次商业route进入/返回重新读而非永久首访缓存；相同数据不重绘，变化的数据才更新目标组并保筛选/分页/显示设置；没有统一稳定业务键的旧行选择不能按标题猜映射，刷新确有数据变化时可安全清除并提示，不能误选另一记录。首次未加载/失败使用独立loading/error/显式retry状态，不能以空数组假作无业务数据；旧已读数据刷新失败仍明确提示旧快照。新增route异步波次仅在shell/会话/访问令牌/工作区身份及源lease有效时提交，旧public load/refresh读取进行中等待，期间失效波次作废后可重新读取；网络失败不自动重试。公开load仍全权限/refresh仍显式无权限过滤，旧写流程的刷新范围不缩；barrier只协调读取，不宣称整个写事务隔离或已修TD-WEB-007顶层挂载。成本lazy请求另携波次接受guard，原public成本计数/查询/结果规则不改。只延迟数据读取，暂仍构造各视图DOM，不声称JS/DOM code-splitting；原114/457/70及原UI断言冻结，新请求计数须分口径实测。日期/HTTP与storage畸形解析仍各后续独立步骤，本登记不改变其它债务状态。

**3e②现时范围更正（实施前独立frontier复核）**：上段首提案的“每次return重读/数据变化清选择”超出首次lazy所需，已撤回；登记不等于新增行为授权，未接入mount或写成新护栏预期。仅首次补齐未加载依赖，已加载source/route复用原快照，原公开load/refresh和写后刷新仍更新共享Map/原DOM或使已访问route采用已显式刷新的值，不另每return GET、不新增清选择策略；失败显式retry。overview因全route DOM岗位洞察仍需全域，默认overview不减少全量请求且返回复用；不称DOM/JS lazy。采购补contract-documents依赖（直接constructor也兼容），TD-WEB-004仍不修。barrier只协调新lazy与旧public读取，不串行化或取消public-public结果，不声称整写事务/成本整波原子；成本新增guard须不取消/覆盖后来的public请求。原首提案保留审查历史，以本段及3e②证据顶部现时更正为准。台账仍44，未结清本项或新增权限策略。

### TD-BOUND-001｜API 响应边界无运行时形状校验

**3f候选实测（2026-10-17）**：五轻量parser/266 Web/34工具、扩展50及原29浏览器全绿；已知schema范围及透传限制、原457完整链/70公开、真实负向与AST工具缺陷更正见[3f证据](../evidence/frontend-3f-parsers-2026-10-17.md)。源码提交后实际干净HEAD全CI待补，不预填完成；下方事前登记保留。

**3f实施前行为登记（2026-10-16）**：原§4.4已授权自研轻量HTTP及sessionStorage/localStorage parser；畸形输入拒绝为可观察变化，后续独立behavior提交，不混其它提取/旧bug修复。输入303d3d9完成docs实际稳定干净HEAD完整CI0/178202.497ms，树空。

- 通用`json<T>`继续允许合法JSON标量/null/array/object及204 undefined，不全局强制object/items；增可选同步decoder，只在非204成功body原await后执行。headers/credentials/15s全body预算/外部abort/401与credential204通知/原finally不改。错误body畸形null/非record/非string字段不再触TypeError或非string错误消息，而回退原HTTP status的RequestError；有效嵌套message优先/空字符串/correlationId保持。
- 已知auth、CRM/commercial容器/分页/cost页及文档消费族挂最小wire-shape校验；返回原对象/数组引用，不规范化/删除未知字段、不加权限、不校验任意深层业务词汇。CRM等后端按capability返回Partial DTO（customer-360.ts的projectCustomer360Item），必须允许业务字段省略甚至空record，不能照web TS id:string一律强必填。治理unknown及未知动态路径合法JSON不扩大收紧；这是显式轻量已知schema族，不宣称所有未来泛型T/深层字段都得到运行时证明。
- 文档读取同GET path固定schema，保每次真实请求前同步读原token/缺失原同步throw、原按path Promise身份及原失败cache删除；不修TD-PERF-003。已知list/reference/detail/version/send/translation/connector等schema只校验其实际固定容器与消费键；忽略返回体的活动/配置写操作不随意加业务字段必填。
- sessionStorage是原始不透明token而非JSON会话对象；畸形空值/非字符串/不符实际base64url字符族拒绝（不强43位、不改token模型/不JWT/不trim或重写），原kingturf.session与sessionExpired='1' keys/有效读写顺序保持；无效存量token不再发HTTP，按原无token分支。localStorage sidebar仅字面'true'为真保持；register JSON须record/可选已知field原类型，畸形已知field整份视图不恢复而非旧逐字段部分恢复，未知field和合法空/可选值仍容忍，原控件fallback/保存keys顺序保持。无自动删除/写回/迁移，不动任何JSON textarea。

正式实施/新定向负向/真实浏览器/预算/独立复核/实际干净HEAD全CI待随后记录，未预填完成。BOUND003/004、SEC、D1、N+1、后端/packages/依赖/workflow/评分等保护区不扩，45条台账及原历史保持。

- **位置**：`apps/web/src/http.ts:66`（`return (…) as T`）；`apps/web/src/entry.ts:174-176`（sessionStorage 会话读取直接使用）
- **类别**：架构（不变量 T4/T5） ｜ **严重度**：P1
- **证据**：前端对 API 响应一律 `as T` 断言强转（`json<SessionDto>` 等），服务端字段变化在编译期不可见、运行时直接 YOLO 探字段；localStorage/sessionStorage 读取（视图缓存、侧栏状态）同样无形状校验。仓库无 zod/valibot/ajv 任何 schema 库。
- **修复建议**：按 §1.3「允许重新实现功能子集」：引入轻量运行时校验（或自研 ~100 行 parser），在 http 封装与存储读取两处边界统一解析。
- **业务行为影响**：无（校验失败路径新增报错属健壮性提升；若涉及行为变化单独登记） ｜ **关联批次**：批次 3 ｜ **验收方式**：故意注入畸形响应的单测（解析器拒绝）+ 现有 70 用例回归

### TD-BOUND-002｜入站请求体校验无声明式 schema

- **位置**：`apps/api/src/app.ts:145-357`（手写校验器群）、230 个分支逐路由手工调用
- **类别**：架构 ｜ **严重度**：P2
- **证据**：20+ 个手写校验器（`objectBody/string/boundedString/timestamp/…`）质量高但逐路由手工调用，新增路由漏调用无机械防护。
- **修复建议**：随批次 2 路由表化，把"必须过校验器"变成路由表的结构约束（结构测试拦截无校验的路由）。
- **业务行为影响**：无 ｜ **关联批次**：批次 2 ｜ **验收方式**：结构测试——注册无校验路由必须失败（实测）

### TD-BOUND-003｜calendarDate 放行不存在的日历日期到仓储

- **位置**：`apps/api/src/app.ts` 的 `calendarDate`（登记时 205-210 行）；`apps/api/test/cost-matrix-factor-contract.test.ts` 的 `retains calendarDate shape/Date.parse normalization behavior`（登记时 356 行）。
- **类别**：边界校验 ｜ **严重度**：P2 ｜ **状态**：待核实 / 待独立人工决策。
- **事实证据**：原 helper 仅检查 `YYYY-MM-DD` 形状与 `Date.parse` 非 NaN，`2026-02-30` 因日期溢出归一化而通过；冻结的 POST/PATCH 契约证明原字符串可传给 mock 仓储。因子迁移原样保留此行为，未修复。
- **复核命令**：`pnpm --filter @kingturf/api exec vitest run test/cost-matrix-factor-contract.test.ts -t "retains calendarDate"`。此命令验证 HTTP 校验到 mock 仓储的边界，不证明真实 PostgreSQL 接收或存储了该日期。
- **未核实范围**：真实 PG 响应、存储影响、全部 helper 调用点及产品对合法日历日期的要求；不得据 mock 测试声称生产已接受非法日期。
- **后续建议**：先逐调用点和隔离测试库核实影响，再形成日历日期真实性校验的独立方案，提交人类裁决。
- **业务行为影响**：若拒绝原来被放行的输入，属于行为变更；必须获独立人工批准、单独提交，不属于当前声明式路由迁移 TD-BOUND-002 的关闭范围，也不属于 D1 四项安全加固授权。
- **关联批次**：待独立排期；不阻塞 2b 因子路由的行为守恒迁移。
- **关闭条件**：影响与语义核实、人工批准（如需收紧）、独立回归/真实 PG 证据和修复提交齐备；本次仅登记，不标已修复。

### TD-BOUND-004｜complaint batch 字符串去重放行同一 UUID 大小写变体

- **位置**：旧基线 `d17dbc9` 的 `apps/api/src/app.ts:247-254`（UUID 正则/helper）和 `:1713-1717`（batch Set 去重）；当前 `apps/api/src/app.ts:248-255` 的同一正则/helper、`apps/api/src/routes/complaint-batch-triage.ts:52`；冻结 `apps/api/test/complaint-batch-route-contract.test.ts:287-310`（旧契约提交 `d0799b6`）；仓储 `apps/api/src/complaint-repositories.ts:1043-1077`（逐项 transition）。
- **类别**：边界校验 ｜ **严重度**：P2 ｜ **状态**：待核实 / 待独立人工决策。
- **已证事实**：UUID 正则带 `i` 忽略大小写，helper 验证后返回 trim 的原字符串；旧/新 Set(items.map(id)) 均按字符串区分大小写。旧 d17dbc9 的固定 HTTP/mock 契约接受 `aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa` 与其大写变体两行，原样传给 mock 仓储；此为旧行为，路由迁移未引入。协调复核在本地 `kingturf_test` 只读执行 `SELECT 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid = 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA'::uuid AS same_uuid;`，结果 `t`，仅证明 PostgreSQL UUID 身份相等。
- **可复跑 mock 契约**：`pnpm --filter @kingturf/api exec vitest run test/complaint-batch-route-contract.test.ts -t "UUID case is preserved"`。本命令只验证 HTTP 校验到 mock 仓储的接受结果，不证明真实 batch 写入或 replay 副作用。上述 SELECT 不写数据库；本登记轮不新增真实 batch 写入实验或生产验证。
- **候选风险（推断）/未核实范围**：仓储仍逐项独立 transition，同一逻辑 UUID 可能重复处理或产生版本/幂等冲突；实际状态、部分失败、requestHash/canonical、派生幂等键、审计和重放影响均未验证。现有 PG mixed/replay 测试没有专门验证大小写变体。不得据此声称已证数据损坏、权限绕过或生产事故。
- **后续建议**：独立排期，先在隔离本地测试库核实相同逻辑 UUID 的批处理影响、幂等兼容和审计证据，再提出 UUID 规范化或逻辑身份去重拒绝方案，明确受影响调用点与存量 replay 兼容性，提交人类裁决。
- **业务行为影响/审批边界**：收紧重复拒绝或 UUID 规范化会改变旧请求接受结果及幂等 canonical 形态，必须独立人工批准、单独行为提交；不属于当前 TD-BOUND-002 声明式迁移或 D1 四项安全加固授权。当前保持 helper/Set/repository/56 oracle/header/交集语义，不修行为。
- **关联批次**：待独立排期；不阻塞 2b 行为守恒迁移，不在本轮安排生产验证。
- **关闭条件**：真实 batch 影响及幂等/审计/replay 语义核实、人工行为批准（如需收紧）、独立回归与真实 PG 证据、修复提交及兼容说明齐备；本次仅登记，不标已完成。TD-BOUND-003 日期问题保持待核实。

## 安全（全部为「变更行为」类，前置人工决策 D1，独立批次 4 提交）

**S1现时（2026-10-17）**：仅SEC004应用层三头实施完成，59f9dfa实际干净HEAD全CI0/180503.567ms，API17114/Web266；首b02ad55因旧严格头期望失败的历史及独立同步76处/65文件均保留。最终证据HEAD另完整CI，不提前称批次4已验收。SEC001/002/003尚未实施（S4先影响报告后硬停）；下方“app无安全头/尚无实施”是旧基线，非当前API三头状态。47项不新增，不改SEC006/007/BOUND003/004/N+1。[S1证据](../evidence/security-batch4-s1-headers-2026-10-17.md)。

**2026-10-17正式实施授权**：批次3已人工验收64757d4；人工授权S1→S2→S3及S4影响报告，当前只启动S1，均独立行为提交/验证。S4实施必须硬停人工确认，不提前改Cookie/CSRF/Origin、sessionStorage或会话夹具；SEC001强制生产段不在本批。此处仅登记授权，不提前关闭任何条目，详见[R7范围](../tasks/harness-batch4-authorization-2026-10-17.md)。

### TD-SEC-001｜全链路无 Content-Security-Policy

**交验核账**：RO段经2e22837人工验收、后继f114ee0全CI再次通过；全项不关闭。无生产receiver/完整一发布周期观察，强制默认false/off，未来另行人工授权，不把本地零事件当强制兼容证明。

**S3现时RO段实施完成/待批次验收（2026-10-17）**：设计10f841e→行为762e393→独立oracle a4c2ca3→工具f693ee2，后者实际稳定干净HEAD完整CI0/219878.817ms，API123/17184、Web13/266/config29；原122 API文件68/81唯一CSP头追加逆AST守恒。真实HTML RO/首次导航前脱敏collector、真实DOM合成发送202/非送达、原29、新3、工具65及四组合20本地矩阵通过，缺collector/未知写/未知启动回执反例真实失败、owned清理核验；有限正常零事件不称全业务零违例。默认强制false/off、内层直连HTML无CSP、无report接收端/生产部署，打印未覆盖、完整发布周期观察与强制需新人工授权，条目不整体关闭。完成docs另全CI后停协调，S4未实施；[S3证据/失败史/边界及回滚](../evidence/security-batch4-s3-csp-2026-10-17.md)。下列“无CSP”位置/grep为建档历史，不是当前扫描结论；总台账48、其他债务不顺手修。

**S3实施前行为登记（2026-10-17）**：S2协调通过后沿R7续派，仅Report-Only与默认off强制开关，先落[具体设计](../tasks/harness-batch4-s3-design-2026-10-17.md)。API统一complete与外层nginx代理HTML分别接线，不用JSON头/meta冒充HTML；不改内层nginx、默认无report接收端，不称生产观察已就绪。最小self仅img放品牌data，打印inline style/CSSOM先观察不盲宽放。本地首次导航前collector与精确合成发送DOM场景、旧严格oracle仅加CSP映射/逆AST、源码及最终HEAD全CI待实施，条目不关闭；强制生产段须一发布周期观察及新人工授权，S4仍硬停。

- **位置**：`infra/nginx/erp.kingturf.cn.conf`（仅 X-Content-Type-Options/X-Frame-Options/Referrer-Policy，无 CSP）；`apps/api/src/app.ts`（无安全头）；`apps/web/index.html`（无 meta CSP）
- **类别**：安全 ｜ **严重度**：P1 ｜ **业务行为影响**：**变更行为**
- **证据**：三层 grep `Content-Security-Policy` = 0 命中；bootstrap.ts 存在 17 处 `innerHTML`（已过 `sanitizeBusinessDocumentHtml` 白名单消毒，但缺 CSP 纵深防御；扫描方法见计划 §3.8）。
- **修复建议**：先 `Content-Security-Policy-Report-Only` 观察一个发布周期，再启用严格 CSP；落地位置优先 nginx（一处生效）。
- **关联批次**：批次 4 ｜ **验收方式**：e2e 断言 CSP 头存在 + Report-Only 期零违例报告 + 人工确认发布

### TD-SEC-002｜API 无限流/429

**交验核账**：已授权登录范围实施完成且经2e22837人工验收，f114ee0全CI保持绿；非登录API限流/分布式防DoS不在本批，不据此宣称全局风险已解决。原基线标题及下方历史保留。

**S2现时实施完成/待批次验收**：设计2ce5dab先登记→业务bdbda0e→必要声明身份门禁b8c1212，实际干净HEAD完整CI0/194043.303ms，API122/17175、Web266/config23；新增61 API/19 config/10门禁检查。账户/IP独立失败窗及持锁退避、成功/异常不计且不清零、429不续禁；容量/可信链问题独立503，不是提前429。首CI新端口未分类失败、纯名字分类候选初审漏报/修正、真实变异及资源/部署边界详见[S2证据](../evidence/security-batch4-s2-login-limit-2026-10-17.md)。只完成登录范围，不把其它API无限流或全DoS风险标成已解决；最终证据HEAD另全CI后停协调，S3/S4未实施。下方实施前与旧grep为历史。

**S2实施前行为登记（2026-10-17）**：S1协调确认后续派，先落[具体规则](../tasks/harness-batch4-s2-design-2026-10-17.md)。默认10实际null失败/15分钟独立账户+IP桶，第10仍401、第11前置429/Retry-After；失败渐进等待100×2^(k−1)上限1000ms、持账户→IP锁，inflight不算失败，成功不计/不清零，异常不计，429不续禁。容量不足/受信链非法独立503；默认信任空、真实socket peer或显式可信链，配置默认/校验/生产compose必要S2透传许可已确认，不猜代理。实现及验证未完成，不关闭条目，不扩S3/S4/SQL/依赖/会话夹具迁移。

- **位置**：`apps/api/src/app.ts`（全文件 `grep '429'` = 0）；对照 `apps/web/src/login-flow.ts:11`（前端已预留 429 文案）
- **类别**：安全 ｜ **严重度**：P1 ｜ **业务行为影响**：**变更行为**（超限请求将收到 429）
- **证据**：登录爆破仅有 scrypt 计算成本兜底，无按 IP/账号的速率限制；其余 API 端点同样无限流。
- **修复建议**：登录端点先行（按 IP+账号双维度，内存滑窗即可，单实例部署无需 Redis）；范围与阈值属产品决策，**纳入 D1 一并确认**。
- **关联批次**：批次 4 ｜ **验收方式**：限流单测（超限得 429）+ 集成回归 + 人工确认阈值

### TD-SEC-003｜会话 token 存 sessionStorage，XSS 可读

**实施项关闭（本次整体人工验收待交付）**：六项选型/后端/前端/真实API-PG-Chrome网络矩阵、退出窄修及f114ee0稳定干净HEAD完整CI0均完成并经协调核证，关闭的是原Web raw token载体迁移实施项，不是所有XSS/会话安全风险或整批人工验收。九旧PW的Cookie适配/每文件真实变异/完整补跑依人类裁定延期为硬前置，未执行不冒称绿；机器完整CLI未全执行、生产未部署。WEB007/PERF003只必要同文件适配，不顺带关闭全项。[行为、分层及回滚](../evidence/security-batch4-acceptance-2026-10-17.md)。

**S4后继工具检查点（2026-10-17）**：设计efae93d干净HEAD全CI0/211588.694ms经协调确认后，仅续派[隔离自然Secure Cookie HTTP/CDP预检](../evidence/security-batch4-s4-cookie-http-2026-10-17.md)。自然传输正向/自有资源负向已证，不是业务认证/签名CSRF/撤销或Web迁移；后端/config/Web源码未改，SEC003保持开放，台账仍48。工具最终CI后停协调，再续已授权后端；下文“未预检”为历史时点。

**S4开工授权现时（2026-10-17）**：2e22837六项已决、人类正式授权实施已亲核；[R7引用](../tasks/harness-batch4-s4-authorization-2026-10-17.md)先独立docs，当前仅授权/具体设计小步，协调只读复核后续后端，不重问选型，尚未改载体/夹具/代码或关闭本项。保opaque/hash/SQL/签名/事务/零依赖；WEB007/PERF003只同文件耦合必要适配且逐处登记，其他不并入。九旧Playwright专项人类回复已亲核，裁定本轮不改、适配/逐文件变异/补跑合并为阶段5前硬前置，未执行不标绿、CDP不冲抵；production/runtime/config静态分类保持。Secure预检尚未运行，不降Secure/不预批HTTPS。下列“仅报告硬停”为批准前历史；SEC001仅RO/强制另批，SEC002/004待S4最终核账，48台账不增闭。

**S4现时仅影响报告（2026-10-17）**：S1–S3协调确认，接手28197d2实际干净HEAD完整CI0/206309.018ms；当前entry.ts:149写/:185读、http.ts:38 Bearer、session.ts:15 token相等保护均未改。已落[影响报告](../tasks/harness-batch4-s4-session-impact-2026-10-17.md)：Cookie＋严格Origin-only与Cookie＋session-bound签名双提交/Origin候选，跨tab/迟到Cookie/机器Bearer和精确website canonical HMAC边界、当前测试工具库存与未来矩阵。报告最终HEAD完整CI仅验证S1–S3现有载体，不是Cookie测试通过；**报告后硬停人工确认，未实施/不关闭SEC003**。S3只是RO（不阻止违规）、无生产receiver/观察周期，不能称XSS风险已消除。下列旧位置与“当前无CSP”为建档历史；ADR0003/token哈希/事务/SQL保持，TD-WEB-007/TD-PERF-003仅既有候选交互不修，台账仍48。

- **位置**：`apps/web/src/entry.ts:129`（写入）、`entry.ts:174`（读取 `kingturf.session`）
- **类别**：安全 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（若迁移 HttpOnly cookie）
- **证据**：opaque token（服务端存 sha256 哈希，安全性本身良好）存 sessionStorage；任何 XSS 可窃取。当前无 CSP（TD-SEC-001）使风险叠加。
- **修复建议**：短期以 CSP 缓解；中期评估迁移 HttpOnly cookie（会话模型 ADR-0003 为不透明会话，迁移影响登录/登出/过期全链路，成本高，**先过 D1 决策再动**）。
- **关联批次**：批次 4 ｜ **验收方式**：若迁移：会话 e2e（`session-revocation.spec.ts` 等）全绿 + 人工验收；若仅缓解：随 TD-SEC-001 验收

### TD-SEC-004｜API 自身不设安全响应头

**交验核账**：统一API应用层三头实施完成、经2e22837人工验收，f114ee0累计CI0保持；不是所有dispatch前/代理自产响应或生产重复头数量已验证。原实现失败/严格oracle同步历史及上线待核边界保留。

**实施完成/待批次4验收**：统一应用响应三头已验证，后继59f9dfa实际稳定干净HEAD全CI0/180503.567ms。当前完成范围、15新检查/全量17114、76期望逐处D1依据、未执行浏览器及生产代理头数验证边界、大小写/代理重复头待核实风险和回滚见[S1证据](../evidence/security-batch4-s1-headers-2026-10-17.md)。不将应用收尾保证泛化到Nginx自产/dispatch前传输异常；下段“验证中”为首失败时点历史。

**S1实施验证中（2026-10-17）**：R7 bed8b40先登记，源码b02ad55统一complete加与nginx一致三头，12新应用/3 helper检查绿；首次实际干净HEAD全CI1，旧65文件6994严格响应期望拒绝新增头，非默许回归。按已授D1测试规则另独立test提交仅同步76处/65文件三header，完整AST证明其它内容同，旧→新映射见[S1清单](../evidence/security-batch4-s1-oracle-map-2026-10-17.md)。全量重新验证及最终证据待真实执行，不提前关闭。Nginx已有同值add_header，上线后可能重复；未来混合大小写同名路由头亦需关注，当前未发现producer，只登记/不顺手去重，不据本步宣称已实测代理/所有站点响应。

- **位置**：`apps/api/src/app.ts`（`setHeader('X-…')` = 0 处）；对照 `infra/nginx/erp.kingturf.cn.conf:22-24`（生产有三头）
- **类别**：安全 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（响应头新增）
- **证据**：本地 dev、预览环境、以及任何绕过 nginx 的直连路径均无 `X-Content-Type-Options`/`X-Frame-Options`/`Referrer-Policy`。
- **修复建议**：API 层统一中间件加三头（与 nginx 现值一致，双保险）。
- **关联批次**：批次 4 ｜ **验收方式**：`app.test.ts` 新增头断言 + e2e 回归

### TD-SEC-005｜动态 SQL 拼装面广，缺结构性约束

- **位置**：`apps/api/src/*-repositories.ts`（`clauses.join(' AND ')` 模式遍布）
- **类别**：安全/门禁 ｜ **严重度**：P2 ｜ **业务行为影响**：无（纯防护性约束，不改代码行为）
- **证据**：当前全部用户输入走 `pg` 参数化 `$1..$n`（未发现直拼用户输入，属现状良好）；但模板字符串拼 SQL 片段的模式面广，未来新增代码有直拼风险，无机械拦截。
- **修复建议**：阶段 3 写结构测试/linter：仓储层模板字符串中只允许出现 `$N` 占位符与代码内枚举白名单，出现其他插值即失败（错误信息附修复指令，§4.2）。
- **已完成（2026-10-12，阶段 3；经三轮迭代达标）**：
  - **第一版（黑名单制，误标完成）**：只拦 request/req/body 等开头，人工复核实测 `${input.name}`、`${foo}` 可绕过。
  - **第二版（形状白名单，仍不达标）**：枚举 apps/api/src 全部 74 种 SQL 模板插值形态并分类为结构模式/枚举标识符/枚举表索引/双字面量三元 + 存量值插值 6 处显式豁免（anchorId/actorId/companyId，到期=批次 1）。第二轮复核实测 7 个**不可信根形状样本**穿透：`${input.sql}`、`${input.predicate}`、`${input.join(' AND ')}`、`${String(input)}`、`${input[view]}`、`${foo[bar]}`、`${scope(input, 'cu', 3).sql}`——正则只限形状不限根，"白名单之外一律失败"未成立。
  - **第三版（形状 × 可信根双重约束，当前版）**：每类模式绑定显式登记的根——片段组合根 ∈ {secured,scope,s,scoped,authorized,leadScope,opportunityScope}；子句拼接根 ∈ {clauses,where}；枚举表索引 = 精确对 {definitions[view]}；调用式钉死 `scope(context, '<字面量>', <数字>).sql`；占位符构造参数 token ∈ {offset, values.length, values.push(<标识符链>), 整数}；三元整条禁止反引号（防嵌套模板）且分支为纯字面量。**实测：第二轮 7 样本注入全部退出码 1（7/7 命中）**；第一轮 2 样本维持退出码 1；自测 14 用例（含不可信根回归 9 样本与可信根对照 6 样本）全过；真实代码 0 强制违规、39 条豁免全部显式登记。
- **关联批次**：阶段 3 ｜ **验收方式**：故意注入直拼 SQL 的测试提交必须被门禁拦截（实测）✓（三轮样本共 11 个，全部退出码 1）

## 测试

### TD-TEST-018｜私有浏览器 preview 上游连接超时

- **事实**：p1-safe-location-2与p1-dom-location-1均有4173/upstream/CONNECT_TIMEOUT/closing=false；最新PW null/SIGTERM、host1/27929ms、仅3 completed/complete=false、owned全清。非RESET证据；旧无观测SIGTERM仍原因未知。
- **状态/边界**：只登记环境连接故障，具体pre-connect卡顿成因待核，未放宽转发器原timeout/失败条件、不改监听/网络/产品。与P1旧可见性oracle问题分开，不充当全部11例失败共同解释。[原事实](../tasks/playwright-p1-replay-blocker-2026-10-17.md)。

### TD-TEST-017｜私有reporter构造options兼容缺口

- **实际接线验证收口**：6fe9ef5窄修后原runtime PW完整1例实际过、真实onBegin/安全summary/onEnd均已加载/落盘，Cookie omit真红→还原绿，最后独立匿名context原case再过；unit6/原门禁0。仅该reporter兼容缺口实施关闭，不表示P1/全部B绿；57顶层项保历史。[实际命令/结果](../evidence/playwright-local-private-runner-2026-10-17.md)。

- **后继窄修候选**：ed614ba原生构造红例后，仅options首参和unit writer第二参分离，回归6/6/原lint/format0，原安全字段/完整性/网络失败规则保持；真实PW接线待实跑，不以unit提前关闭。[映射/结果](../evidence/playwright-local-private-runner-2026-10-17.md)。

- **事实**：本轮43047ec新增同步partial writer构造参数误把PW传入options对象当函数；本地官方runner:4917/4926明确new reporterConstructor(options)，新直接调用形状unit实际1/5过1败。43047ec诊断partial0不证明没有执行case，旧f56365c完整11败有效，raw均按R7清理。
- **范围/状态**：仅本轮已授B工具自身兼容回归，已登记待分离options与unit writer参数/独立修复，原配置/业务assert/网络失败规则不改；[真实故障/红例](../evidence/playwright-local-private-runner-2026-10-17.md)。不计B绿或扩大原待裁问题。

### TD-TEST-016｜P1原浏览器11例失败定位待核

- **显示许可后实际部分结果**：fb13ba3直接人类R7后，候选仅显示/定位与Order360自然展开，原五计数/18时间线/10事件身份行可见，所有原数值保持。真实发现11/9完成，7过（含mobile/Order360/commission/risk/制造/采购），credit450000和dashboard原bookedRevenue两败后TD018中断；host1/39336ms/owned全清，另两例未完成。非完整11/不关本条/不开第二轮，[完整失败史](../evidence/harness-stage5-browser-rulings-2026-10-17.md)。

- **已授固定诊断真实后继**：七类bool/计数观察完整，host0/10470ms/owned全清，非原P1运行。拒绝/过期敞口450000不匹配而0匹配、dashboard四原数值全不匹配，保持数据C7/不改原数值或seed；其余本地化/生产class双匹配与Order360自然展开有固定事实，待另裁显示适配。[全部观察与保守提案](../evidence/harness-stage5-browser-rulings-2026-10-17.md)。TD018原失败史保留，通道本轮无relay失败不当作根因消除。

- **金额许可后实际部分失败**：1068b94人类R7只改9行固定货币词面，原状态/值/计数/seed不变。新跑发现11/仅9完成：order/AR/payment1过，其余8败（credit原拒绝敞口、mobile生产块、Order360状态、佣金政策pin、风险、dashboard原指标、制造版本计数、采购菜单挂载），最后TD018两次CONNECT_TIMEOUT中断；原因未全部诊断，不泛改期待。host1/62186ms且owned全清；每文件变异/全11绿未完成。[固定行号与完整失败史](../evidence/harness-stage5-browser-rulings-2026-10-17.md)。只读诊断产物最小扩展已询问用户，不阻塞独立A–F；无新债务重复编号，仍58项。

- **阶段5后继**：main单页设计d4e9dbd考古后，人类已批准逐路由（R7 f4b54c2）。首候选11失败/其中10timeout，独立review指出测试helper先即时isVisible竞态，完整结束后只补parent attached。第二候选仅原credit count3/订单CNY950000断言失败后TD018中断；非完整11。main af0de8f已明确货币本地化，当前固定formatter输入950000→¥950,000，与旧词面不符；币种/数值文案新C7未擅改，保原断言/产品/seed。逐路由候选部分检查点不算P1文件适配/真实红绿完成。[全部事实/建议](../evidence/harness-stage5-browser-rulings-2026-10-17.md)。以下待路由许可/未定位为前时点。

- **最新C7**：只读phase部分诊断前两例failureLine19/overview-board-hidden，第三同断言但unclassified；随后通道超时使complete=false。仅前两例原helper可见性期待与非当前workspace隐藏冲突有实际快照支持，其余不归因。候选封存精确恢复原spec；路由访问/逐页可见性方案属非S4期待变化，未获授权不实施。以下未定位文字为此前时点。

- **事实**：f56365c私有执行器，原seed实际0且成本/关单检查过，P1自然DOM会话候选保原11个test正文；完整11发现/完成、全部failed，PW1/65088ms、host1/73640ms，owned全清。raw按人裁仅tmpfs已清，未导图/未视觉验收，不称拥有原始错误证据。
- **状态/边界**：安全结果仅case起始行，根因待核；只新增精确固定spec整数failureLine、未知0，不导出错误/stack/路径或改原assert。auth适配未完成真变异，不以种子绿冲抵PW失败；必要C7待事实，不顺手修产品/导航/业务期待。[结果/诊断界线](../tasks/playwright-p1-replay-blocker-2026-10-17.md)。

### TD-TEST-015｜Source授权旧合成应收页缺cursor字段

- **实施验证收口**：ea2a647字段独立真红绿后，auth旧token真源变异三红→完整清理还原原3例全绿PW0/3361ms、host0/8382ms；PG样本SHA前后同，原动作/权限/断言不变。仅该旧合成字段缺口实施项关闭，整批/全部A+B仍未验收；55顶层ID含历史不删，以下待实施/待auth变异为历史。

- **后继字段实施验证**：f646958恢复同一auth候选后，只/api/v1/ar-open-items空stub补nextCursor:null，原样本/权限/业务动作断言不动；原3例绿→实际删字段authorized隐藏红/2过1败→立即还原3绿，owned全清。[命令/真实耗时](../tasks/playwright-source-fixture-ruling-2026-10-17.md)。该字段缺口实施验证完成，整文件auth真变异待完成，不称全部A/B绿；下方待实施为历史。

- **事实**：原真实PG producer19/19，auth-only浏览器候选两次均2过1败；authorized原催收卡存在但hidden，旧应收stub缺parseCursorPage必填nextCursor，authorized有ar:read且collections依赖应收ready。owned全清，失败附件保留，候选已精确还原/补丁封存。
- **裁定/状态**：直接人类call_7652a1df412c4d42b66e572bb09ebeb7仅准该合成endpoint补nextCursor:null，原PG业务样本/权限/断言/其它响应保持；已授未实施，不认定产品缺陷或提前关闭。独立修正/缺字段真红绿及auth真变异待验，[完整事实/R7](../tasks/playwright-source-fixture-ruling-2026-10-17.md)。不阻独立B首轮，第二轮须全部绿，成本/Workspace未扩许可。

### TD-TEST-014｜Workspace旧夹具gate与360字段

- **阶段5实施验证关闭**：5230625新授权＋28215b0 R7后，只360 tuple补真实orders/finance；positive4过、缺字段原第三case红/还原4过、旧恢复DTO四红/还原4过PW0/3930ms、host0/9389ms，owned全清。原16expect/主步骤守恒；本夹具及整个文件会话适配真实红绿完成，不代全部浏览器/第二轮。[映射/全部结果](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)。以下字段待裁均历史。

- **等待点已授后实测**：0c9a886后仅q=慢请求requested/awaitgate，首次原JSON照回，主切页/RAF/16assert同；positive1和restored1均3过1败，迟到成本目标过/唯一release hash=#/quotes；广路径真变异使成本再超时，2过2败，立即还原目标再绿，owned全清。只关闭等待点实施，360字段仍独立待裁/原失败、全文件真变异未完成，不写整文件通过。[精确结果](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)。

- **实证**：原16expect同的auth/void候选PW1/38957ms、host1/44429ms，2过2败；第二input不可见30s、第三360 h2缺5s。原trace非auth初次cost GET q=null/status=-1，旧fixture全cost路径awaitgate；parser须string[]而mock缺，实际API有字段。owned全清、原HTML/截图/trace保留。
- **边界/裁定**：只读支持旧合成夹具失配，非产品已证；本会话人类call_2a13b5991a4b4354ae99d03ff621b2b7准仅等待q=慢请求、首次原payload返回、原切页/RAF/assert不动。360字段本轮另待裁，不套CDP旧授权；全文件真变异/还原绿未完成。[原话/事实](../tasks/playwright-workspace-fixture-rulings-2026-10-17.md)。

### TD-TEST-013｜成本转报价成功提示可见性失配

- **事实**：f3882a3干净HEAD全CI0/201874.74ms后，成本临时仅auth候选PW1/12294ms、host1/17663ms，1过1败；前quotes/dialog/decisionId过，原末提示element not found（候选486/还原原501）。原trace只读核201→报价GET200和after@call@305 commercial-status空文本，未输出auth元数据，owned全清、HTML/截图/trace保留。
- **候选/待裁**：cost-matrix-detail:560–578赋提示→切route，route-navigation:64–79/load→route-read:81–84写已加载→bootstrap:366–368转空，支持lazy覆盖候选，不称干预根因/生产bug/不同store。需确定持续提示合同，另授产品窄修或旧非会话oracle变更，当前只登记不修/不删assert。
- **边界**：临时成本auth已精确还原与f3882a3字节同，不算适配/变异完成；原失败不消除、不跳过。阻塞成本绿及第二轮，不永久冻结其它独立首轮。[完整事实/候选/待裁](../tasks/playwright-cost-handoff-blocker-2026-10-17.md)。

### TD-TEST-012｜冻结文档发送PW旧header索引严格类型诊断

- **后继原门禁/人裁**：auth候选原ESLint实际1/8旧错误，baseline内存lint1/9（旧storage void另被auth消除）；本会话人类call_35cccddbc8024f6f890813be80e44491批准仅8处机械兼容，R7 ba294ae。类型投影/去6个!与仅未用void回调块体，47expect参数同、除void例外擦除JS全字节同，三类真实lint源变异1→还原0，机械后原7 PW通过。**旧header keys额外tsc诊断仍2/现162，未修/不关闭本项**；其它文件不扩授。[逐处/全部失败史](../evidence/playwright-docker-spec-replay-2026-10-17.md)。

- **事实/范围**：新增A8精确tsconfig供原ESLint project service归属；额外手动全A `pnpm exec tsc -p tests/e2e/tsconfig.json --noEmit`实际2，`tests/e2e/document-send-product-quality.spec.ts:152–154`的string[]接收headers索引string|undefined，继承原browser/base strict/noUncheckedIndexedAccess。原根lint/typecheck未包含该手动全A命令，PW尚未执行，不能称运行bug或原CI失败。
- **边界**：仅登记，不修冻结业务断言/加默认值/非空断言，不放宽规则。独立只读建议保留窄TS接线，原login ESLint已0；如实际阻断hook/授权PW或要求新全A tsc为必须验收项，再C7带实证求裁。[执行证据](../evidence/playwright-docker-spec-replay-2026-10-17.md)。

### TD-TEST-011｜冻结P1种子缺关单实际成本审批前置

- **后继授权/结果**：bea9a76独立R7批准已审最小本地成本准备。新增helper/调用后移除该块与父seed全字节相等，原close/其它业务/断言不变；真实API完整seed同schema两遍0、政策1/费率2/运行1/事件2/异人/closed计数不变，缺料及自批真实源变异均HTTP500/非零后立即还原双遍绿。仅本地前置实施完成；最终HEAD全CI及A/B后继另验证，不改SQL/产品源码/PW配置。详见[独立验证证据](../evidence/playwright-p1-cost-seed-2026-10-17.md)。下列待决/未绿是批准前历史。

- **实证**：TD-TEST-010只修本轮API search_path后，完整原seed推进到`seed_p1_demo.mjs:1165–1174` POST `/api/v1/production-orders/:synthetic-id/close`→500；最后安全诊断日志`/tmp/kingturf-docker-seed-production-category-2026-10-17.log`，seed1/2526ms、host1/7117ms，SQLSTATE P0001、production-repositories.ts:130、trigger require_approved_cost_before_close line3，所有owned资源随后清理。无SQL/values/body/身份/秘密输出。
- **独立静态依据**：0048_actual_manufacturing_cost.sql:62–67明确CLOSED需同tenant/order effective APPROVED cost run，50–57不许计算者自批；全seed搜索`actual-cost|actual_cost|production-cost|production_cost|cost.*approv|cost-close`无对应成本政策/计算/批准调用。production-repositories.ts:113–145在事务插事件，触发器拒绝与所观测链一致；不推断产品触发器应放宽或500所有根因已排除。
- **边界/待决**：需新成本policy→calculate→独立身份approve业务种子步骤、权限/状态选择，超出本轮仅login URL/环境准备；禁止插SQL结果、绕触发器、删除关单、改P1断言/业务源码。具体补齐是否足够尚未实跑；需人类新范围裁定后再最小实施，当前仅登记不修。
- **影响**：完整P1 seed未绿，A8/B2 spec适配/逐文件变异/首轮第二轮均未执行，原九旧PW硬前置未履行；C生产spec未跑。P1前置阻断不等于生产故障证据，不抬质量分或宣称Harness完成。详见[种子认证及完整失败史](../evidence/playwright-docker-seed-auth-2026-10-17.md)。

### TD-TEST-010｜Docker owned schema P1信用种子500

- **初登记/范围**：已guard本地kingturf*test、随机runtime_web* schema、host marker→container READ ONLY同实例核证后，完整冻结seed只换机器认证URL，POST `/api/v1/credit-decisions`真实500；child1/680ms、host1/5050ms，schema/container/API全清。认证绑定两身份真实红绿已证，审批/后继及spec未到达，不写成产品bug。
- **安全诊断补记**：仅owned API临时观察真实pg.Client.query失败且原SQL/结果不改，`/tmp/kingturf-docker-seed-safe-diagnostic-2026-10-17.log`得到SQLSTATE42883、qtc-repositories.ts:267信用exposure snapshot插入，未输出query/values/body/秘密；迁移0026:79触发器用未限定digest，原authz HTTP fixture:135–140在迁移后把API search_path扩为owned,public。宿主实际owned schema只读to_regprocedure核未限定digest不可见、public.digest可见、pgcrypto extnamespace为public。指向本轮环境少了已安装扩展可见性；后继还须环境修正后完整seed验证，不先称500根因闭环或全seed绿。
- **候选/边界**：只在owned迁移完成且只读核pgcrypto确在public后，为本轮API运行连接加既有public函数可见性，owned schema仍第一/current_schema与marker同一；不改public数据/创建扩展/迁移/业务SQL/seed语义。由实测决定是否可继续既授补跑，不借500扩大业务修复。
- **环境验证结果**：仅fixture迁移后只读核pgcrypto extnamespace=public，再为本轮API连接设置owned,public（owned仍第一）；原seed未改业务，信用创建及后继已通过，推进到更后的生产关单成本审批前置失败。`/tmp/kingturf-docker-seed-public-extension-2026-10-17.log`信用不再500，整体seed仍1，不能写成全seed绿。此项环境可见性已修/信用段通过，不改产品SQL/创建扩展；后继生产关单另行登记，不由本环境修正覆盖。前文“待验证”为初登记时点，保护边界见[回环通道证据](../evidence/playwright-docker-loopback-2026-10-17.md)。

### TD-TEST-006｜自有CDP后继未分类异步失败候选（旧解决历史保留）

- **位置**：`scripts/e2e-cdp/session-network-browser.mjs` CDP异步失败门及 `session-network-dom.mjs` 第9项身份换代场景。
- **类别/严重度/行为影响**：测试可靠性/P2/无（只登记，未改业务或工具失败分类）。
- **新事实**：`/tmp/kingturf-s4-network-final-bound-chrome-2026-10-17.log` 第8项通过后，第9项因未分类CDP异步失败中止，gateway/Chrome/profile/API/schema均清理；当时未定位具体原因。后续最终strict26正常、f114ee0全CI0，只证明后继具体运行绿，不证明旧根因或风险消失。
- **历史边界**：3f3aae7/830d1fb原点击/viewport修复与当时真实变异、回归/CI结论不回写。此后继子候选复开待核实，不新加顶层ID/不改49总数；不推断业务回归或生产事故。
- **后续/关闭条件**：独立复现并收集固定类别的CDP命令/导航/取消时序证据（不得输出token/proof/Cookie/DSN），区分平台/工具/预期取消；必要修复须单独授权、真实变异与完整还原回归，保严格未知请求/写失败门和owned清理。当前不顺手放宽错误分类、不新增运行；见[完整失败史](../evidence/security-batch4-s4-network-2026-10-17.md)。

### TD-TEST-009｜三份临时AST证明漏比较后续子节点

- **发现/事前登记**：2026-10-17协调逐读3f临时proof，表达式回调返回push长度，TypeScript.forEachChild遇truthy早退，导致旧3e-lazy/date/3f的AST内容相等证明不足。发现后先更正披露、修临时诊断并复算；本条在独立版本化工具提交前登记，不混dc3697b业务行为。
- **范围**：独立扫描本批15份proof，协调另核16脚本，只确证三份；旧字节比较、数量walker、实际测试/CI不一概失效，不据此推断业务回归。
- **修复**：void块体完整遍历，第二声明/函数尾/expect实参三类差异自检，固定580cc72/c0a549f/dc3697b完整重核0；lazy仅归一化if.then单ExpressionStatement花括号，条件/表达式/else仍完整比较。三脚本版本化scripts/analysis/proofs，旧两证据顶部追加更正，失败日志保留。
- **验证边界**：源码提交固定SHA3f证明0；版本化工具已实际三份运行0；工具/收尾docs实际干净HEAD全CI提交后执行。精确日志与首轮计数/括号差异、诊断复现错误见[3f更正](../evidence/frontend-3f-parsers-2026-10-17.md)。不代表全仓所有证明工具已审。

### TD-TEST-001｜2 个仓储模块完全无测试，2 个近乎无覆盖

- **位置**：`apps/api/src/business-document-repositories.ts`（775 行，任何层 0 引用）、`production-cost-repositories.ts`（290 行，0 引用）；`quality-repositories.ts`（app.test.ts 仅 1 处引用）、`order-360-repositories.ts`（仅 2 处）
- **类别**：测试 ｜ **严重度**：P1
- **证据**：交叉验证：`grep -ci <module> apps/api/test/app.test.ts` 依次为 0/0/1/2，且 `apps/api/test/` 无对应测试文件（对比：commercial/crm/qtc/foundation 等 9 个域均有 `*-postgres.integration.test.ts`）。
- **修复建议**：阶段 5 按现有集成测试范式补齐（business-document 优先，行数最多）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：新增测试文件 + 注入缺陷实测必须失败（防假测试）

### TD-TEST-002｜无覆盖率配置与阈值

- **阶段5实际进展，未关闭**：真实六包B已冻结、278f22a实际check三目标未达exit1；后继domain单包629/671≥90，不能代整体/仓储达标或最终CI。双写/到期scanner已接（15工具例/真实全仓active0），其余真实缺口和最终达标/CI仍待，[固定B和失败证据](../evidence/harness-stage5-coverage-protocol-2026-10-17.md)。下方“无配置”等为原发现时点。

- **位置**：全仓（package.json 无 coverage 脚本；无 vitest coverage 配置；lockfile 无 `@vitest/coverage-*`）
- **类别**：测试/门禁 ｜ **严重度**：P1
- **证据**：`.gitignore:4` 有 `coverage/` 条目但目录从未生成过；现状无法回答"覆盖率多少"。
- **修复建议**：阶段 5 接入 `@vitest/coverage-v8`，整体下限 + 关键模块（apps/api 仓储层、packages/domain）单独下限，进 `ci:local`。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：覆盖率报告产出 + 低于阈值实测拦截

### TD-TEST-003｜6 个仓储模块仅 mock 路由级测试，SQL 路径未验证

- **阶段5实际进展，未关闭**：制造专项6项真实PG0、租户SQL实现真注入1败4过→还原5绿→补强最终6绿；源码恢复SHA/diff0及事件回滚证据见[测试地图](../evidence/harness-stage5-test-map-2026-10-17.md)。该域公司/GROUP限定并非recordScopeSql接口，也无幂等命令；其余五域专项未完成。原“六个无专项”保留为发现时点，佣金/风险旧HTTP间接证据不漏记。

- **位置**：`commission`/`dashboard`/`manufacturing`/`mrp`/`procurement`/`risk` 六个 `*-repositories.ts`
- **类别**：测试 ｜ **严重度**：P2
- **证据**：app.test.ts 引用计数 24/8/31/37/43/30（编排层有覆盖、仓储以 vi.mock 注入）；`apps/api/test/` 无这六个域的 `*-postgres.integration.test.ts`，真实 SQL 与 DataScope 谓词未验证。
- **修复建议**：阶段 5 补 PG 集成测试（复用现有集成测试范式与 fixtures）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：6 个域各有集成测试文件且全绿

### TD-TEST-004｜packages/ui、packages/testing 的占位测试（已完成）

- **位置（历史）**：`packages/ui/src/index.test.ts`、`packages/testing/src/index.test.ts`（D3 执行前各 1 用例；现已删除）
- **类别**：测试 ｜ **严重度**：P2
- **关闭证据（2026-10-13）**：全仓 `rg` 确认 `createBootstrapView`、`parseJson`、`@kingturf/ui`、`@kingturf/testing` 无生产消费者；两个 workspace 包及占位测试已删除，web 依赖与 lockfile importer 已同步移除。
- **修复结果**：D3 删除方案已执行，不再保留无消费者空壳测试。
- **业务行为影响**：无 ｜ **关联批次**：D3 ｜ **验收方式**：依赖清理 + format/typecheck/lint/build/doc-lint/structure/`pnpm ci:local` 全绿

### TD-TEST-005｜packages/types 占位测试：纯类型包的测试策略未定

- **位置**：`packages/types/src/index.test.ts`（1 用例）；对照 `packages/types/src/index.ts`（约 537 行纯 DTO/枚举/ErrorEnvelope 类型）
- **类别**：测试 ｜ **严重度**：P2
- **证据**：纯类型包的运行时测试意义有限（无逻辑可断言）；现状为占位用例，策略未定。**本条不依赖 D3**（types 是被全部包引用的活跃共享包，无去留问题，与空壳包性质不同）。
- **修复建议**：阶段 5 二选一并记录：①以类型级断言（`asserts`/`tsd` 风格或 `expectTypeOf`）替代运行时占位测试；②豁免并登记（豁免格式见计划 §5 阶段 5 阈值表）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 5 ｜ **验收方式**：策略落盘且占位测试被替换或豁免登记

### TD-SEC-006｜complaint 锚点谓词语义弱于其他域

- **位置**：原 complaint-repositories.ts:42-58（批次 1b 迁移后由 scope-sql.ts 的 `anchorPredicate='relationshipOnly'` 显式表达）；对照其余 11 域的 organizationJoin 形态
- **类别**：安全/一致性 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（若统一为 organizationJoin 形态）
- **证据**：批次 1b-complaint 迁移时发现并经特征化测试固定（test/scope-sql-complaint.test.ts）：complaint 的锚点 EXISTS 只查 organization_scope_relationships 单表——无 organizations JOIN、无组织 active/deleted 与 organization_type 校验、TEAM 无 depth<=1 限制；租户校验在 osr.tenant_id 上、类型匹配用 osr.scope 列。其余 11 域均为 JOIN organizations + 类型/租户/有效性校验 + TEAM depth。行为已按原样守恒迁移，未修改。
- **修复建议**：批次 1 完成后决策：①统一为 organizationJoin 形态（属行为变更，需单独提交+人工批准+集成测试补 DataScope 用例）；或②确认 osr 行的维护约束（触发器/迁移）已足以替代组织有效性校验并记录决策依据。
- **业务行为影响**：无（当前为登记；统一时为变更行为） ｜ **关联批次**：待决策（批次 1 后） ｜ **验收方式**：决策落盘；若统一，complaint 集成测试补锚点 DataScope 用例（含 deleted anchor 组织负例）

### TD-SEC-007｜foundation 通知收件人谓词缺省省略组织有效性 JOIN

- **位置**：原 foundation-repositories.ts recipientScope（批次 1b 迁移后由 scope-sql.ts 的 `employeeScopedPredicate(..., { actorOrganizationValidation: 'skip' })` 表达）；对照 repositories 员工域变体（缺省 'validate'）
- **类别**：安全/一致性 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（若统一为 validate 形态）
- **证据**：批次 1b-foundation 迁移时发现并经特征化测试固定（test/scope-sql-foundation.test.ts）：foundation 变体的隐式类型锚点 EXISTS 不 JOIN `actor_org`（不校验 actor 自身组织的有效性/归属），actorExists 不 JOIN `authorized_org`（不校验 actor 组织属于其公司且有效）——与 repositories 员工域变体（两处 JOIN 均在位）是真实语义差异。行为已按原样守恒迁移。另更正：原 GRANDFATHERED_VALUE_INTERPS 中 foundation 的 5 条（actorId/companyId/anchorId）经代码核实为**预构建 $N 占位符变量**而非值直插（当时分类保守），随迁移自然消失（豁免 38→33）。
- **修复建议**：批次 1 完成后与 TD-SEC-006 一并决策：统一为 validate 形态（行为变更，需单独提交+人工批准+集成测试补组织失效负例）；或确认无需组织有效性校验并记录依据。
- **业务行为影响**：无（当前为登记；统一时为变更行为） ｜ **关联批次**：待决策（批次 1 后） ｜ **验收方式**：决策落盘；若统一，foundation 集成测试补失效组织负例

### TD-TEST-007｜在线文档广源提交关键词实际只命中 CTR 旧面板

- **位置**：固定eb86107 `apps/web/src/bootstrap.test.ts:1000–1049`，其中1018的`expect(source).toContain('/submit')`；旧bootstrap2197唯一匹配，真实迁移目标`commercial/workspace-legacy-panels.ts`。
- **类别**：测试精度 ｜ **严重度**：P2
- **证据**：主代理及独立只读复核以固定git原文检索`/submit`：bootstrap唯一CTR版本提交路径，contextual-documents/document-library均无命中；迁移后未适配三项失败111通过，仅读源路径组织适配、不改旧期待。该关键词原本只保证广源存在，不绑定在线文档submit。
- **修复建议**：另行设计绑定真实文档动作/receiver/版本payload的行为护栏；是否调整冻结断言语义须单独决策，当前不实施。
- **业务行为影响**：无（本轮仅登记） ｜ **关联批次**：阶段5／后续独立授权 ｜ **状态**：仅登记，真实文档行为与其他覆盖待核实，不宣称产品缺陷。

## 性能与可靠性

### TD-TEST-008｜新增CDP客户360合成详情遗漏服务端固定字段

**完成补记**：独立工具2f9d316实际稳定干净HEAD全CI0/191524.069ms，原29/工具33及旧红齐，业务WIP隔离；详见[工具完成证据](../evidence/frontend-3f-cdp-fixture-2026-10-16.md)。下方待补保留历史。

**用户后续明确确认**：异步澄清回复选择“允许独立修正该夹具（推荐）”。最初问题拟补空数组；随后直接核对真实仓储/共享类型固定orders/finance，已向用户说明采用实际值，范围仍仅此合成字段，原UI断言/硬闸不动。

- **位置**：303d3d9 `scripts/e2e-cdp/fixtures.mjs:624–631`；对照`apps/api/src/routes/customer-360.ts:89`、`apps/api/src/crm-repositories.ts:869`及`packages/types/src/index.ts:371`。
- **类别**：测试夹具契约 ｜ **严重度**：P2 ｜ **状态**：已复现，独立工具修正中。
- **事实**：服务端固定回传`unavailableSections: ['orders', 'finance']`，合成detail缺字段；新增独立Node契约在旧fixture真实失败（Array.isArray为false）。这是本批新增harness的schema遗漏，不是生产缺字段或业务UI回归，不改后端/原114断言及夹具/Playwright9spec/config。
- **授权边界**：原人类冻结仅现有Web114断言/夹具及Playwright；CDP是本批另获授权创建扩展的工具。协调解释既有授权可维护这个synthetic字段，非新增人类裁定；主代理初误把历史byte对拍纪律当冻结，已向用户纠正，不反复索许可。若用户随后明确要求保持，则遵从最新选择。
- **修复范围**：只补该合成字段并新增精确契约，不改原UI断言/driver预算/物理命中/GET allowlist/网络硬闸。此次不再宣称CDP fixture字节同；web轻量parser只要求string[]，不强业务tuple词汇。独立工具提交/红绿/原29/CDP清理/实际干净HEAD完整CI待真实补记。3f业务WIP以明确路径暂存，工具验证时不混入。

### TD-PERF-003｜文档读缓存旧失败回调可能删除新代缓存

- **位置**：9fdcaf0 `apps/web/src/bootstrap.ts:1081–1094`；候选同体迁位`apps/web/src/shared/document-read-service.ts:8–20`。原逻辑与candidate逐声明AST相等，非迁移引入。
- **类别**：异步缓存/性能 ｜ **严重度**：P2
- **静态事实**：缓存命中按path复用Promise，clear直接清Map；请求catch只按path无条件delete，不检查Map当前仍为该请求。独立只读review提醒，主代理复读旧新源码确认，未新增复现实验/测试。
- **待核实推断**：若A在途→clear→同path新B写入→旧A较晚reject，旧catch可删B条目，后续读取可能再发重复GET。实际触发时序、网络故障条件与生产影响待核实；不把该序列推论为旧值覆盖、越权或跨账号数据泄露。
- **当前处置**：仅登记，保持原catch/clear语义，不加generation guard或Promise身份判断，不扩本次行为范围/测试。不混进3c守恒、3e惰性加载或3f解析收紧；修复需独立授权/提交。
- **已有台账搜索**：`rg -n -i 'cache|promise|缓存|代际|旧请求' docs/exec-plans/tech-debt-tracker.md`命中God store、边界类型及旧请求说明，未见该catch-delete代际条目；结论仅限该文件搜索范围。
- **业务行为影响**：修复 bug（若实施） ｜ **验收方式**：独立可控异步复现/身份及clear语义核验，当前未实施修复或生产验证。

### TD-PERF-001｜前端无自动重试/断路，失败依赖人工重试按钮

- **位置**：`apps/web/src/http.ts`（封装内有 15s 超时与中止，无重试）；对照 `entry.ts:66-68`（"重新加载工作台"人工重试按钮）
- **类别**：性能 ｜ **严重度**：P2 ｜ **业务行为影响**：**变更行为**（仅实施时——引入自动重试会改变失败路径的表现与请求次数）
- **证据**：`node scripts/analysis/audit-scan.mjs` S9 节：17 行命中（app.ts 1、foundation 5、bootstrap 5、document-send 1、entry 5），人工判定全部为人工重试按钮与幂等命令语义，自动重试/断路 0 处；网络失败目前靠登录页/启动失败视图的手动重试兜底（方法与限制见计划 §3.8）。
- **修复建议**：**待排期**：若实施，仅对幂等 GET 加单次自动重试（指数退避可选），并在实施前按行为变更登记、单独提交。
- **关联批次**：待排期（P2，登记不丢） ｜ **验收方式**：若实施：重试/放弃行为单测 + 请求次数断言

### TD-PERF-002｜13 处 N+1 查询候选点未判定

- **位置**：`contract-document-repositories.ts:188`、`foundation-repositories.ts:{142,276,434,995}`、`procurement-repositories.ts:{259,436}`、`manufacturing-repositories.ts:{207,295}`、`qtc-repositories.ts:{890,932}`、`complaint-repositories.ts:1063`、`production-cost-repositories.ts:85`
- **类别**：性能 ｜ **严重度**：P2
- **证据**：`node scripts/analysis/audit-scan.mjs` S6 节（for-of 循环块内含 `await` 的语法级检测，方法与限制见计划 §3.8）命中 13 处；是否构成真 N+1 取决于调用频次与数据量，**未判定**（当前无慢查询故障报告）。
- **修复建议**：批次 2 子批 2f 迁移路由时逐个判定：确证者（循环次数受用户输入影响）登记修复子任务并单独处理；误报者在本条标注关闭。
- **业务行为影响**：无（判定阶段零代码改动；确证修复另登记） ｜ **关联批次**：批次 2（子批 2f） ｜ **验收方式**：13 处全部有判定结论（确证/误报）记录于本条

**原始登记快照说明**：上列位置/未判定是779dea3扫描时点的历史证据，保留不回写；该提交树中尚无本台账文件，历史13由后续台账固定清单及git show 779dea3的循环上下文重建，不冒称当时已有台账文件。以下为本轮2f判定，不替换为现时扫描新总数。

**2f本轮判定（授权c75dd7b；业务源码基线7e94bbe）**：13/13完成，7个确证逐项SQL扇出、6个误报/有界点，判定任务完成、确证修复未实施/待独立授权，不等于性能风险清零。仓储文件相对7e94bbe零变动。按用户判准区分“每次循环”和“整请求累计”：事务不是集合上界；明确HTTP sequence范围＋立即UNIQUE失败中止可构成业务硬界，不能把routing的大界主观说成无界；普通SQL integer/UUID有限值域或服务器35MB请求体不是业务条目配额。所有频次是静态调用机制，生产QPS/行数分布/耗时未测，无新增判定SQL探针或性能基准。

下表旧文件均位于779dea3的apps/api/src，当前文件均位于7e94bbe的apps/api/src；每条以循环集合及所在符号关联，不按相近行号猜测。q只计所述循环SQL（固定前置/审计/事务常数另计），n为集合长度，m为实际生成allocation数，t为访问候选次数。

| ID  | 固定历史位置 → 当前位置/符号与每次触发机制                                                                        | 上界来源、SQL频次与判定证据                                                                                                                                                                                                                                                                      | 结论/后续                                                                               |
| --- | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| H01 | contract-document-repositories.ts:188 → 同文件:176 createEnvelope/input.signers；每签署请求一次                   | app.ts:2209强制sequence 1..20；DB0061:41–46立即UNIQUE(tenant_id,envelope_id,sequence)，串行无逐项catch，首次重复失败后事务退出；q≤min(n,21)，成功≤20。仅当前HTTP路径上界，不外推任意repo直调                                                                                                     | 误报，关闭无界N+1候选；保留20成功/21尝试的失败时点证据                                  |
| H02 | foundation-repositories.ts:142 → event-repositories.ts:91 claimInTransaction/rows；每claim调用一次                | event-repositories.ts:47–64在repo校验limit默认20、1..100，CLAIM_SQL带LIMIT；n≤100，每行一次operationalAudit（共享helper固定SQL）；不是无界DB rows审计                                                                                                                                            | 误报，有界审计，关闭此候选；不是证明审计成本为零                                        |
| H03 | foundation-repositories.ts:276 → event-repositories.ts:224 InProcessEventDispatcher.pollOnce/claimed；每轮poll    | 此调用省略limit，默认20（claim通用上限100）；每event调用handler并complete或fail；只证明本轮枚举≤20，用户注入handler内部工作不在本判定。限定检索apps/api/src的InProcessEventDispatcher及.pollOnce(，未找到生产调用，定义/测试不当实际生产频次                                                     | 误报，有限后台轮询，关闭此候选；不外推无限poll总运行期或handler无SQL                    |
| H04 | foundation-repositories.ts:434 → notification-repositories.ts:175 insertRecipients/去重recipients；每通知创建一次 | app.ts:404–408 strings无条数配额；notification-repositories.ts:65–73、109–116只要求非空UUID及scope查询全部合法。每recipient两INSERT，q=2n；合格租户员工集合可增长，不是固定权限条目枚举；35MB不作业务上界                                                                                        | 确证，纯写型逐项扇出（非典型读N+1），修复R1                                             |
| H05 | foundation-repositories.ts:995 → business-object-repositories.ts:132 relationships/schema.fields；每定义/版本一次 | domain/src/index.ts:103–112的validateBusinessObjectSchema限制fields≤100；关系字段为子集；每关系一INSERT、q≤100                                                                                                                                                                                   | 误报，有界schema步骤，关闭此候选                                                        |
| H06 | procurement-repositories.ts:259 → 同文件:226 createSupplierQuote/input.lines；每报价创建一次                      | routes/procurement-supplier-quote-create.ts:62–80仅非空数组，无条数配额；每行一个INSERT…SELECT含RFQ/资格关联，q=n；已issued RFQ与qualification只限定每项有效性，RFQ行数无固定配额                                                                                                                | 确证，读写混合INSERTSELECT扇出，修复R2                                                  |
| H07 | procurement-repositories.ts:436 → 同文件:403 receive/input.lines；每收货请求一次                                  | routes/procurement-receipt-create.ts:61–93非空但无条数配额；403–468每有效行查PO line/查location/插lot/插receipt-line/插movement，成功q=5n，出错可提前终止；PO/tenant/剩余数量校验非固定集合配额                                                                                                  | 确证，逐行读取型并伴写入，修复R3                                                        |
| H08 | manufacturing-repositories.ts:207 → 同文件:180 createBom/line.substitutes（外层:165 input.lines.entries）         | priority在routes/manufacturing-bom-create.ts:101限定1..1000，DB0036 per-line UNIQUE priority；每line最多1000成功/第1001次失败。内层有界，但外层lines无业务条数配额（route:64–110，line_number=index+1）；整请求成功q=n+Σs_i≤1001n，没有固定n界。历史简单for-of正则未命中解构外层，不能漏掉上下文 | 确证，嵌套纯写扇出，修复R4；不把内层称严格无界                                          |
| H09 | manufacturing-repositories.ts:295 → 同文件:268 createRouting/input.operations；每工艺创建一次                     | routes/manufacturing-routing-create.ts:84 sequence 1..100000；DB0036:56–61立即UNIQUE(tenant_id,routing_version_id,sequence)，串行无逐项catch、失败rollback/rethrow；q≤min(n,100001)，成功≤100000                                                                                                 | 误报，按明确硬界关闭无界候选；高上界写扇出风险保留，独立授权评估，不与低界20/50/100等价 |
| H10 | qtc-repositories.ts:890 → 同文件:849 reconcile/items；每核销run一次                                               | :841–846查tenant/customer/currency下未结INVOICE，无LIMIT；逐访问item SELECT least，正额allocation再SELECT subtraction，余额耗尽后下一轮可break；q=t+m≤2n、t≤n，余额/金额不提供固定条数配额                                                                                                       | 确证，DB结果驱动读取/算术查询型，修复R5                                                 |
| H11 | qtc-repositories.ts:932 → 同文件:891 reconcile/allocations；同一run第二循环                                       | m≤n但n来自H10无LIMIT集合；每allocation一个INSERT，q=m，不能把生成数组称固定事务步骤                                                                                                                                                                                                              | 确证，纯写型扇出，修复R6（与R5共享输入、分别核验）                                      |
| H12 | complaint-repositories.ts:1063 → 同文件:1044 batchTriage/input.items；每batch请求一次                             | routes/complaint-batch-triage.ts:34–53 HTTP限制1..50且拒绝重复ID；每项transitionComplaint有意分项成功/失败，≤50次调用，内部SQL成本不在此逐行DB读取判定                                                                                                                                           | 误报，有界业务batch，关闭此候选；BOUND004大小写既有状态不动                             |
| H13 | production-cost-repositories.ts:85 → 同文件:86 createPolicy/input.materialRates；每策略创建一次                   | routes/production-cost-policy.ts:64–76只要求非空数组，DB0048:11–14的policy/itemVersion唯一与tenant FK只限定合法性；item versions集合无业务条数配额；每rate INSERT，q=n                                                                                                                           | 确证，纯写型扇出，修复R7                                                                |

**确证关联修复子任务（仅登记，均未授权实施）**：

下列“风险评级”指未来实施修复时改变既有锁/错误顺序/授权/金额/幂等的变更风险，不是已实测事故严重度或生产性能评分。R1/R7属相对局部批量写入评为中；R2–R6涉及资格、库存/父子映射或财务账务一致性评为高，仍须独立方案与验证，不以评级替代授权。

- TD-PERF-002-R1（H04）：未来修复变更风险评级＝中；评估批量recipients及delivery INSERT；风险为授权集合、去重、审计、生成ID与错误顺序守恒。
- TD-PERF-002-R2（H06）：未来修复变更风险评级＝高；评估集合式RFQ/qualification验证和批量INSERTSELECT；风险为无效行不得悄悄丢弃、首错/行映射/幂等。
- TD-PERF-002-R3（H07）：未来修复变更风险评级＝高；评估批量读取PO/location和集合写入；风险为FOR UPDATE锁序/死锁、部分数量冲突、lot/receipt/movement引用与事务证据。
- TD-PERF-002-R4（H08）：未来修复变更风险评级＝高；评估BOM lines/substitutes批量写入RETURNING映射；风险为line ID/priority唯一、顺序、首次冲突与整体回滚。
- TD-PERF-002-R5（H10）：未来修复变更风险评级＝高；评估精确numeric集合计算/减少逐项算术往返；禁止直接用JS浮点替换PG numeric，需保持due_at/created_at/id顺序、锁、金额、trace/resultHash及幂等。
- TD-PERF-002-R6（H11）：未来修复变更风险评级＝高；评估allocation_entries批量INSERT；风险为allocation_order、派生key/canonical_hash、审计与R5联动，不借本登记修改算法。
- TD-PERF-002-R7（H13）：未来修复变更风险评级＝中；评估materialRates批量INSERT；风险为FK/重复项首错、策略版本、成本精度、审计/幂等。
- H09高上界风险：另行评估业务条目配额或集合式写入（改变接受域或SQL锁/错误顺序均须独立授权），本轮不降现有100000序号上界、不修代码。

**覆盖与关闭口径**：6个误报仅关闭“该历史点属于无界N+1”候选，不关闭其他性能/安全债；7个确证仅源码级机制证实，不声称生产已有慢查询事故或已实测吞吐。13点由主代理与只读独立核验交叉确认；未新增PG/SQL判定探针、性能测试或E2E，既有13PG回归不替代上述性能基准。台账仍37顶层条，R1–R7与GATE003-E1为父项关联子任务，不冒算新顶层债。当前A判定完成、业务修复零；待本线稳定HEAD全CI及最终人工验收。

## 门禁

### TD-GATE-001｜无 git hooks / commitlint / lint-staged

- **位置**：仓库根（`.husky/` 不存在；`.git/hooks/` 仅默认 `*.sample`；package.json 无相关字段）
- **类别**：门禁 ｜ **严重度**：P1
- **证据**：提交规范仅靠 PR 标题约定（历史均为 conventional commits 风格但无机械校验）；脏提交（lint 不过/格式错）只有 push 后 CI 兜底。
- **修复建议**：阶段 3 接入 lefthook 或 husky + commitlint + lint-staged，`pnpm ci:local` 的子集本地化；错误信息附修复指令。
- **已完成（2026-10-12，阶段 3）**：采用**零依赖方案**替代 husky/commitlint/lint-staged（选型理由：与仓库零依赖哲学一致，core-beliefs「偏好可内化技术」；行为等效）。`.githooks/{pre-commit,commit-msg}` 经 `core.hooksPath` 接线，`prepare` 脚本在 `pnpm install` 时激活（对无 .git 的 Docker 构建容错）。实测：坏提交信息（退出码 1+修复示例）、暂存坏格式文件（退出码 1+修复指令）均被拦截，好样本放行。清单见 docs/GATES.md。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3 ｜ **验收方式**：非 conventional 提交信息、含 lint 错误的提交在本地被实测拦截 ✓

### TD-GATE-002｜vitest 无配置文件

- **位置**：全仓 0 个 `vitest.config.*`；`apps/api` 的 `--maxWorkers=1` 只写在 package.json scripts
- **类别**：门禁 ｜ **严重度**：P2
- **证据**：集成测试串行要求（共享 PG schema）仅靠 CLI 参数记忆，无集中配置；覆盖率配置（TD-TEST-002）也无落点。
- **修复建议**：阶段 3 与覆盖率接入一并统一到 vitest 配置。
- **已完成（2026-10-12，阶段 3）**：新增 `apps/api/vitest.config.ts`（`test.maxWorkers: 1`，集成测试共享 PG schema 必须串行），CLI 参数已从 test 脚本移除；配置文件纳入 typecheck（tsconfig include）并排除出构建（tsconfig.build exclude，rootDir=src 不受影响）。验证：本地 PG（kingturf_test）上 API 全量 22 文件/184 用例全绿（45s），串行语义保持。覆盖率配置落点将在阶段 5 加入同文件（TD-TEST-002）。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3 ｜ **验收方式**：配置文件存在且各包 scripts 引用一致 ✓

### TD-GATE-003｜routes 目录未纳入 G1/G2/G3 扫描

- **位置**：`scripts/analysis/structure-gate.mjs:55–63` 的 `walk`；`runChecks:235–244` 共用 sourceFiles 循环、245–250 的独立 G4；`scripts/analysis/structure-gate.test.mjs:147–179` 的真实进程自测目录。
- **类别**：工程门禁覆盖缺口 ｜ **严重度**：P1 ｜ **状态**：未修复／待核实（静态遗漏已证，真实 routes 注入逃逸及全量影响待独立核实）。
- **证据（2026-10-16，发现基线2761b0a／登记前文档2c7b174）**：`walk` 对目录名 `routes` 直接 continue；G1 文件、G2 缩进和 G3 SQL 插值检查均只运行于该 walk 产生的 sourceFiles。随后 routes 仅单独执行 `routeValidatorViolations`（G4），不会补回 G1/G2/G3。首版 `7dd2ff7` 已有这一跳过，主代理亲读、协调及 readonly reviewer 独立核同；旧真实进程超限样本放在 `apps/.structure-gate-selftest-*/src`，不是 routes。该静态遗漏并非 G1/G2 白名单的显式例外，也不是 G3 可信根豁免；协调限定检索6ba55c4的GATES/台账/active历史未找到人工批准例外或等效TD，此否定结论限所列文档范围。
- **影响与核实边界**：CI 绿不能证明 routes 已受三类机械拦截；这不是已证生产漏洞，不推翻既有人工验收或2d行为守恒。本批九模块无SQL，文件/完整函数/明确词法函数与控制流预算已独立核验，但该手工口径不等于现G2格式缩进算法扫入后必然通过（格式缩进可至9）。本轮**未执行真实 routes 目录三类违规注入／逃逸用例**，未审完所有存量 routes 引入扫描后的影响，不能宣称动态复现、修复或门禁全覆盖已完成。
- **修复候选／前置决策**：后续独立门禁任务先审现有 routes 全量影响与潜在新增违规；评审 G1/G2/G3 覆盖 routes 且保留 G4 逐定义校验的改法，再补真实进程 routes 文件过长／嵌套超限／白名单外SQL插值三类样本的失败拦截及合法样本、清理后回归测试。禁止直接改 walk 触发海量违规后临时加豁免，禁止扩大 G3 可信根。候选不是本轮实施授权，修复须独立决策、独立源码/测试提交及复核；阶段5接入前复核该债。
- **业务行为影响**：无（本轮仅文档登记；不改变API/SQL/权限或产品行为） ｜ **关联批次**：后续独立门禁任务决策／阶段5接入前复核。
- **验收方式（尚未执行）**：批准范围内真实 routes 三类违规进程退出非0、有效样本通过、G4逐定义继续生效；全量存量影响清单/批准处置、无新绕过或未授权豁免；完整 `pnpm ci:local` 与独立复核通过后才可置已修复。本次完整CI仅登记回归，不是该缺口修复验收。

## 文档与工程卫生

**TD-GATE-003-E1关闭证据（2026-10-16，父项已人工验收b575b9c）**：授权310c1e2下，源码d9f43f6仅去掉冗余roles分支，原模板method读取/授权getter/receiver/首错保留；固定旧新773及协调独立复跑一致。撤例外3231964移除path/hash/date条与旧失效自测，换为当前AST5及同路径合法6/7强制拒绝；36结构自测、稳定HEAD全CI真实0/173.927秒，API117/17099、原13PG通过，0硬/31软，原31逐条保持。E1已消除不是延期，不再挂2026-10-23临时豁免；旧32/期限/待授权原文保留历史。其他债务/7个N+1修复/D1/BOUND/SEC均不实施；函数200缺口和前端问题不在本关闭范围。

**TD-GATE-003最终工程验证（待人工验收）**：bd48b5a已提交稳定干净HEAD完整CI实际退出0（171.698秒）；36结构自测及协调独立8个AST/expiry样本通过，G3/G4字节不变，原31逐条无增删＋E1＝32，源码/旧业务测试无改。E1的2026-10-23 Singapore零时由代码机械失效；若批次2提前最终验收，必须先移除/另行人工裁决，是人工验收前置条件，代码不解析批次状态。该例外及函数200未强制边界仍开放（870函数节点/最大foundationRoutes522行），不以覆盖修复冒称所有复杂度债已清；不得借此改业务或静默续期。旧发现/候选记录均保留时点。

**TD-GATE-003本轮实现更新（2026-10-16，授权c75dd7b；旧登记原文保留）**：routes纳入G1/G2/G3同一sourceFiles扫描，G4仍单独逐定义一次。仅API routes的G2采用明确AST词法函数/控制流规则；非routes保留原缩进算法，G3实现/形状/可信根及G4校验函数相对7e94bbe逐字节不变。原116文件G1/G2格式/G3＝0/93/0、maxIndent10，AST分布2×1/3×93/4×20/5×1/6×1，完整逐file基线与定义见[evidence/routes-structure-baseline-2026-10-16.md](../evidence/routes-structure-baseline-2026-10-16.md)。36结构自测真实退出0，routes超800/AST超5/SQL直插/G4缺validate均真实CLI退出1，合法深格式退出0，清理后全仓0硬违规/32信息豁免。最终稳定HEAD全CI和独立复核尚待本线收口，不把局部成功当人工验收。

**TD-GATE-003-E1（新增精确限期例外，不是目录豁免）**：authorization.ts:236–245既有atomicCapability fallback为1函数＋4层资源三元＋1叶三元＝6；本批禁止业务源码改动，故仅`apps/api/src/routes/authorization.ts`整内容SHA256 `d380d23327db8d1751a793d2bdef0a2c62948cf17420a8da25723edc6103daf1`、maxDepth恰为6可信息豁免。明确到期日2026-10-23 Asia/Singapore 00:00，或批次2最终验收前取先；只预留后续独立授权去嵌套/裁决，不授权本批改该源文件。日期到期、内容变化、深度增长或换文件任一条件均强制失败，确定性测试覆盖日期临界/内容变更/更深/异路径。阈值5没有改变，31旧条按rule/path完全保留、无移除（现时原构成9G1＋22G2，不回写旧7/24历史），仅新增此条：总32＝9G1＋23G2。残余例外未消除，函数200仍无新增AST强制，不能宣称复杂度债务清零。业务行为影响无；后续处置独立排期、不得静默续期。

### TD-DOC-001｜无 AGENTS.md；docs/ 85+ 文档无统一索引与目标结构

- **位置**：仓库根（无 AGENTS.md/CLAUDE.md）；`docs/`（adr 10、agent-memory 11、engineering 26+、evidence 14+、tasks 22+、deployment 2，另散文件）
- **类别**：文档 ｜ **严重度**：P1
- **证据**：规则要求的 `docs/exec-plans/`、`docs/design-docs/`、`AGENTS.md` 均不存在；现有 85+ 文档质量高但无 index、无新鲜度标注、无交叉链接校验，智能体无法判断哪份仍有效（B3/B5 违背）。
- **修复建议**：阶段 2 按 §2.1 建目标结构 + AGENTS.md（目标 ≤100 行，机械上限 200 行）+ docs/index.md；现有文档归并策略属 D4 决策。
- **处理中（2026-10-12，阶段 2a）**：AGENTS.md（53 行）、ARCHITECTURE.md、docs/index.md（101 文件全量索引 + doc-lint 链接校验实测通过）、core-beliefs/QUALITY_SCORE/RELIABILITY 已建立。剩余：2b 归并（阻塞 D4）+ 阶段 3 doc-lint 接入 `ci:local` 后关闭。
- **已完成（2026-10-12，阶段 2b）**：D4 已决策（方案 A 轻触式 + agent-memory 保留常驻；ROADMAP 与长任务计划均常驻）；index 状态列全量归并（**常驻 50 / 已归档-只读 54**，零文件移动、零死链）；抽样 3 份旧文档比对代码，发现并修正 IDENTITY_AUTHORIZATION.md 授权管理端点漂移（旧的 5 端点已被 `user-access-profiles` / `identities/{id}/state` / `audit-events` 三端点取代）。doc-lint 持续绿；其接入 `ci:local` 的持续强制属阶段 3（TD-GATE 范畴），本条按验收方式（lint 通过 + AGENTS ≤200 行）关闭。

### TD-DOC-002｜常驻文档未全量与代码核对

- **位置**：docs/ 常驻文档 50 份（阶段 2 按验收要求仅抽查 3 份）
- **类别**：文档 ｜ **严重度**：P2
- **证据**：抽查 3 份即命中 1 处漂移——IDENTITY_AUTHORIZATION.md 声明的 roles/permissions/grants/assignments/scope-grants 五端点在代码中不存在，实际为 `GET/PATCH /api/v1/user-access-profiles`（`identity:read|authorization:read` / `identity:manage|authorization:manage`）+ `GET /api/v1/audit-events`（`audit:read`），已于阶段 2b 修正（app.ts:5329-5356、aggregate-authorization.ts）。其余 47 份常驻文档未逐份核对，存在同类漂移风险。
- **修复建议**：阶段 3 建立文档园丁任务（规则 §2.4）：按目录分批核对常驻文档与代码一致性，被 README/AGENTS/ARCHITECTURE 引用者优先；发现漂移登记并修复。
- **业务行为影响**：无 ｜ **关联批次**：阶段 3（文档园丁） ｜ **验收方式**：50 份常驻文档完成一轮核对并有记录；后续由定期园丁任务维持
- **业务行为影响**：无 ｜ **关联批次**：阶段 2（前置 D4） ｜ **验收方式**：文档 lint（链接可解析、必填节）通过 + AGENTS.md ≤200 行

### TD-VER-001｜版本号全部 0.0.0 占位，发布标识 = commit SHA

- **位置**：根及 8 个子包 `package.json` 的 `version` 字段；`apps/api/src/server.ts`（读取 `KINGTURF_RELEASE_SHA`）
- **类别**：依赖/版本 ｜ **严重度**：P2
- **证据**：全部 version = `0.0.0`；发布链路用 commit SHA 校验（`/version` 端点 + 部署后探针），该链路完整可靠。规则 §6.1 的"版本声明一致性"规范在此现状下无从落地，但也非缺陷。
- **修复建议**：**待人工决策 D2**：维持 SHA 标识（在 docs/CI.md 记录决定，规则 §6.1 标注不适用）或引入语义化版本（需一次 bump + guard）。
- **业务行为影响**：无 ｜ **关联批次**：待决策 ｜ **验收方式**：决策落盘 docs/CI.md

### TD-HYG-001｜本地验收产物滞留；近空壳包（已完成）

- **位置**：`.local-acceptance/`（**10 个目录、36 个条目**，已被 .gitignore 忽略；复核命令 `find .local-acceptance -maxdepth 1 -type d | wc -l`）、`.test-results/`；空壳包路径为 D3 执行前历史位置。
- **类别**：文档/工程卫生 ｜ **严重度**：P2
- **关闭证据（2026-10-13）**：D3 已批准并执行；两个空壳包已删除，web workspace 依赖及 lockfile importer 已清理；`.local-acceptance/` 继续被 `.gitignore` 忽略，新增 `docs/local-acceptance-cleanup.md` 与不自动执行、目标路径严格校验的 `scripts/analysis/clean-local-acceptance.mjs`（本轮未运行清理脚本）。
- **修复结果**：空壳包已移除，本地验收目录保留为显式本地卫生边界。
- **业务行为影响**：无 ｜ **关联批次**：D3 ｜ **验收方式**：依赖清理 + 门禁全绿

---

### TD-HYG-002｜旧preview Dockerfile引用已删除包

- **位置/证据**：`infra/docker/Dockerfile.api-preview:16,18`仍COPY `packages/testing/package.json`、`packages/ui/package.json`，工作树目标均不存在；此Dockerfile相对S1最终00ed10d零diff，是旧D3删除包后的遗留引用，不是本次S2修改。
- **类别**：构建/工程卫生 ｜ **严重度**：P2 ｜ **业务行为影响**：目前仅登记无变化，后续修复须独立审查。
- **事实/推断边界**：静态路径缺失已证；疑似preview镜像构建失败，未执行Docker构建/部署，未证明生产运行或发布失败。
- **建议/停点**：后续独立核preview构建依赖并修引用，保生产与workflow边界；S2不顺手修、不构建、不新增依赖。台账48含历史，原D3关闭保留。

## 处置记录

2026-10-16，3e②现时45项：新增TD-WEB-008，旧工作区替换后跨安装批次的详情抽屉闭包候选仅静态登记，未做旧写入/生产复现，不修默认语义。原44项及历史原文保留；新lazy首访显式复用最近安装绑定，不外推全部历史列表唯一实例。

2026-10-16，TD-GATE-003独立登记：协调与readonly reviewer确认walk自7dd2ff7跳过routes，runChecks共用sourceFiles使G1/G2/G3皆漏扫，G4独立扫描；静态遗漏已证，真实routes违规注入逃逸与全量影响未执行，P1／业务行为影响无／未修复待核实。仅新增本条正文、索引与处置记录，旧36条历史字节保留，当前37；后续独立门禁任务决策、阶段5前复核，本轮不改脚本/旧tests/白名单/G3可信根。登记前2c7b174完整CI真实0/147.709s与源码2761b0a真实0/151.592s只为既有回归，不是本缺口修复验收；本登记新实际HEAD另完整CI真实0/干净后交回，回滚仅本登记docs提交需先核授权及后继冲突。

2026-10-13，TD-BOUND-004 登记：④batch 代码 bfc1c06 守恒协调复核通过，旧56契约d0799b6无diff；协调独立21文件1167/1167、最终fe4b76c完整CI退出码0（API1550/complaint PG4/4）。大小写变体 HTTP/mock 接受与 PG 只读 UUID 身份相等已证，真实批处理/幂等/审计/replay 副作用待核实；仅独立文档登记，保持业务和oracle，不阻塞2b守恒迁移。当前索引/正文35条，历史计数保留；本登记提交可独立revert。

| 日期       | 条目         | 动作                                                                                                                                                                                                             | 关联 commit                                      |
| ---------- | ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ----------------------------------------------------------- |
| 2026-10-12 | 全部 27 条   | 阶段 1 全量扫描登记（基线 779dea3）                                                                                                                                                                              | 本分支首次提交                                   |
| 2026-10-12 | 30 条        | 审核修订：TD-TEST-004 拆出 types 为 TD-TEST-005（脱离 D3）；新增 TD-PERF-001/002（§3.8 性能扫描落盘）；修正度量口径表述（脚本 vs `wc -l`）、`.local-acceptance` 计数（10 目录）、innerHTML 17 处、商业子域 21 个 | 本分支修订提交                                   |
| 2026-10-12 | TD-DOC-001   | 状态置「处理中」：阶段 2a 完成入口地图/架构总览/全量索引/doc-lint/核心信念/质量评分/runbook 六件                                                                                                                 | harnessing 分支 2a 系列提交                      | 剩余 2b 归并（阻塞 D4）+ 阶段 3 doc-lint 进 ci:local 后关闭 |
| 2026-10-12 | TD-DOC-001   | 已完成（阶段 2b：D4 决策执行 + 抽查修正 1 处漂移）                                                                                                                                                               | harnessing 分支 2b 提交                          |
| 2026-10-12 | TD-DOC-002   | 新登记：常驻文档未全量核对，抽查 3 份即发现 1 处端点漂移（已修）                                                                                                                                                 | 同上                                             |
| 2026-10-12 | TD-DOC-001   | 复核修正：归并计数口径更正（常驻 50/归档 54）；ID_AUTH 三端点表述更正                                                                                                                                            | 阶段 2 复核提交                                  |
| 2026-10-12 | TD-SEC-005   | 已完成：structure-gate G3 强制拦截 + 实测注入样本退出码 1                                                                                                                                                        | 阶段 3 提交                                      |
| 2026-10-12 | TD-GATE-001  | 已完成：零依赖 hooks 实测拦截坏信息/坏格式提交                                                                                                                                                                   | 阶段 3 提交                                      |
| 2026-10-12 | TD-GATE-002  | 已完成：vitest 配置统一，API 184 用例全绿验证                                                                                                                                                                    | 阶段 3 提交                                      |
| 2026-10-12 | TD-SEC-005   | 复核返工：G3 黑名单制被实测绕过（input.name/foo），返工为白名单制后重新达标                                                                                                                                      | 阶段 3 复核提交                                  |
| 2026-10-12 | TD-SEC-005   | 二轮返工：形状×可信根双重约束，评审 7 样本注入全部退出码 1                                                                                                                                                       | 阶段 3 复核2 提交                                |
| 2026-10-12 | TD-SEC-006   | 新登记（批次 1b-complaint 迁移时发现的域间语义差异，原样守恒并固定特征化测试）                                                                                                                                   | 阶段 4 批次 1b 提交                              |
| 2026-10-12 | TD-SEC-007   | 新登记（批次 1b-foundation 迁移时发现的员工域第二变体语义差异，原样守恒并固定特征化测试；附带更正 5 条存量豁免的机制认知——实为预构建占位符而非值直插）                                                           | 阶段 4 批次 1b 提交                              |
| 2026-10-12 | TD-DUP-001   | 已完成：DataScope SQL 统一由 `scope-sql.ts` 的三项共享出口提供；repositories 无本地 scope helper，关系表生产 SQL 仅保留在共享模块；全部 scope 对拍、API 全量与 `pnpm ci:local` 通过；TD-SEC-006/007 保持待决     | `f810229` 及后续收尾文档提交                     |
| 2026-10-13 | TD-BOUND-003 | 因子旧契约复核新增日期真实性边界问题；原样迁移，真实 PG 影响与收紧方案待独立核实/人工决策，不修行为。                                                                                                            | 旧契约 `fc54c8d`；因子代码 `839bf84`；本登记提交 |

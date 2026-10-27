# docs/index.md（全部文档索引）

[V1.0 Batch4交付](productization/batch4-delivery-2026-10-26.md)：G5应用工厂/总分发收口、最终同SHA回执及独立复核边界。

[V1.0 Batch5交付](productization/batch5-delivery-2026-10-27.md)：TD-SEC-010本地修复、TD-COST-003/TD-CONN-001复现与五类业务审批契约。

[V1.0 Batch6交付](productization/batch6-delivery-2026-10-27.md)：成本重复归集与connector CAS修复、CI接线核账和岗位验收准备。

[V1.0 Batch6业务审批](productization/batch6-decisions.md)：五项业务规则的最小审批契约。

[V1.0 Batch6岗位验收计划](productization/batch6-pilot-acceptance-plan.md)：十类岗位的场景、拒绝、对账和签署字段。

[V1.0 Batch6本地集成审查](productization/batch6-integration-review-2026-10-27.md)：提交链、迁移兼容、回滚与未完成事项。

[V1.0 Batch6验证证据](productization/evidence/batch6-2026-10-27/README.md)：专项 PostgreSQL、完整 CI 和浏览器双轮摘要。

[V1.0 Batch7准备交付](productization/batch7-delivery-2026-10-27.md)：业务审批、累计集成风险、bundle 恢复和岗位/运维准入状态。

[V1.0 Batch7业务审批表](productization/batch7-business-approval.md)：A1–A5 五项规则的最终待批契约。

[V1.0 Batch7集成风险矩阵](productization/batch7-integration-risk.md)：本地累计差异、迁移兼容和远程发布停止条件。

[V1.0 Batch7岗位与运维准入](productization/batch7-uat-ops-readiness.md)：十岗位隔离验收、性能基线、备份恢复和监控准备。

[V1.0 Batch5安全整改](productization/batch5-security.md)：TD-SEC-010三条幂等重放路径的当前授权修复与验证边界。

[V1.0 Batch5成本复现](productization/batch5-cost003.md)：重复BOM组件实际成本重复归集的隔离PG证据和待裁方案。

[V1.0 Batch5连接复现](productization/batch5-conn001.md)：连接器CAS更新SQL缺陷的复现和最小候选。

[V1.0 Batch5审批契约](productization/batch5-decisions.md)：金额、成本、发运、BOM和利润的待批准规则。

[V1.0 Batch5岗位差距矩阵](productization/batch5-pilot-gap-matrix.md)：十类岗位的自动证据、人工验收缺口和试运行阻断。

[V1.0 Batch4安全影响](productization/batch4-sec010-assessment.md)：TD-SEC-010的PG/HTTP复现和当前授权前重放最小整改建议，正式未修。

[V1.0 Batch4业务裁定](productization/batch4-decisions.md)：稳定编号/历史映射和最小待决项；[成本契约](productization/batch4-cost-contract.md)、[仓库发运契约](productization/batch4-shipping-contract.md)、[BOM/实际利润契约](productization/batch4-bom-profit-contract.md)均DESIGN_ONLY。

[V1.0 Batch4证据索引](productization/evidence/batch4-2026-10-26/README.md)：逐组与失败记录、原始脱敏日志、固定SHA最终机器回执读取方式。

[ADR0012 惰性路由尝试与同步投影](adr/0012_lazy_route_attempts.md)：Batch4 G5拆分决策，保持原Promise等待、null续走和权限/错误顺序，不引入通用协程或业务规则变更。

[V1.0 Batch4 执行计划](productization/batch4-execution-2026-10-26.md)：从f3稳定基线进行G5收口、SEC010隔离核查与业务规则定稿；不改未批准业务语义、不操作远程/生产。

[V1.0 Batch3 定向证据](productization/evidence/batch3-2026-10-26/README.md)：目标红绿、失败修正、隔离模型和独立源码复核，最终CI/双轮另据固定SHA本地回执。

[V1.0 Batch3 验证与交付](productization/batch3-verification-2026-10-26.md)：库存并发非负、风险重放与读取范围本地修复；G5两项消除、两项仍开放；最终CI/浏览器看精确SHA回执。

[V1.0 Batch3 业务设计增量](productization/batch3-business-design.md)：成本舍入/修订、仓库出库、BOM pin与实际利润最小待决项，原型独立分支未合入正式候选。

[V1.0产品化接管入口](productization/README.md)：2026-10-26，基线b1ef7a9；当前真实状态、行业/业务/架构审计、十二工作包及No-Go准入草稿。本轮仅本地文档和隔离验证，未授权业务实施或生产变更。同日再次核验主线、开放PR/Issue和证据哈希一致；补充技术层分别选型及管理员/运维场景。

[Harness施工图竣工归档](exec-plans/completed/harness-2026-10-21.md)：阶段1–5与§14迁移记录；常驻规则以AGENTS、核心信念、架构、CI和门禁文档为准。
[Harness竣工收官报告](evidence/harness-final-closeout-report-2026-10-21.md)：五阶段摘要、开放项承接、母模板反馈与归档后合同。
[Harness常驻契约自检](evidence/harness-final-closeout-self-check-2026-10-21.md)：无施工图依赖的机械自检结果与证据入口。
[Harness归档授权](tasks/harness-final-closeout-archive-authorization-2026-10-21.md)：§14 归档范围、停止边界与最终验证授权。

[TD018受控收口实际证据](evidence/harness-final-channel-controlled-2026-10-20.md)：S1完成驱动15秒绝对cap、13纯测/lint/格式过，非relay5秒；S2/S3真实canary/原生清理与后续P1/两完整轮仍待，不预填绿。

[TD018 S1–S3设计与门槛](tasks/harness-final-channel-s1-s3-design-2026-10-20.md)：完成驱动15秒采集cap独立原relay5秒；原生私有PID/创建身份/ACK与自主lease，真实canary和三故障精确消亡分别证明，未实跑不填绿。只受控链路激活，不进入默认系统采集/产品。

[TD018受控收口正式新授权R7](tasks/harness-final-channel-closeout-authorization-2026-10-20.md)：亲核人类原始授权，先完成驱动有界采集窗及Windows精确原生清理现场证据/独立审，再P1认证红→还原绿及同状态两完整轮。原relay5秒/失败硬闸不改，超时数据不足即停、不重试粉饰；最终新HEAD全CI另验、不§14。

[TD018环境重建复现与分支收口R7](tasks/harness-final-channel-reconstruction-authorization-2026-10-21.md)：仅授权一次 S4a 同状态冒烟与必要的 S4b 环境重建、完整白名单观测及 X/Y 分支收口；原 relay/失败合同、产品/测试正文和网络配置不改，S4a 上报即停，最终全 CI 与人工终验仍为硬前提。

[TD018 S4a 对比结果](evidence/harness-final-channel-controlled-2026-10-20.md)：认证撤销负例首个 upstream CONNECT_TIMEOUT；紧随无负例 runtime 单例1/1通过，形成测试侧路径线索。按授权停止 S4b/S5，不据此归因网络或产品。

[TD018归因收口与两轮启动R7](tasks/harness-final-channel-attribution-authorization-2026-10-21.md)：授权一次无害片段对照、静态机制推演、明确 M1/M2/T2 分支及随后两轮正常态 A8+B2；正式测试正文逐字恢复，原 relay/失败硬闸和产品不改。

[TD018 T1/T2 结果](evidence/harness-final-channel-controlled-2026-10-20.md)：同位置无害注释同样触发首个 upstream CONNECT_TIMEOUT，判定 M1；T2 将边界限定为 spec 文件变更/挂载同步/runner 加载与 relay 时序耦合，不归因认证语义、产品或具体网络层。

[TD018 两轮结果与等价证明](evidence/harness-final-browser-evidence-2026-10-20.md)：第一轮 A8+B2 全绿；第二轮 A8/Source/runtime 全绿但 P1 首个 upstream CONNECT_TIMEOUT，按 M1/T2 停止重试，认证拒绝/撤销由 mock、PG/HTTP 与真实红记录形成等价证明。

[TD018终局双轮与终验材料R7](tasks/harness-final-channel-terminal-rounds-authorization-2026-10-21.md)：授权新增 P2 M1 债务登记、清理后同 SHA 连续两轮协议、替代口径和终验材料定稿；正式 spec/relay/失败硬闸/产品不改，最终全 CI 与人工终验仍为硬前提。

[TD-TEST-020 M1债务登记](exec-plans/tech-debt-tracker.md)：新增测试基础设施 P2，记录 spec 挂载字节变更后首跑 relay 超时；本轮只登记，候选修复方向为挂载同步或建连重试，维护批次后继处理。

[TD018 D2终局轮结果](evidence/harness-final-channel-controlled-2026-10-20.md)：清理后第一轮 A8/Source/runtime 全通过，P1 首个 upstream CONNECT_TIMEOUT 停止；按授权不启动第二轮，连续双轮字面条件未达成。

[TD018专项结果与未激活工具](evidence/harness-final-network-diagnostics-2026-10-20.md)：WSL mirrored/版本及空闲计数不证明历史根因，暂不改配置；839d5ce R7→ef908ad独立API、12新增/49工具绿/独立审过。Windows取消未确认不假报gone，未接runner/未再P1，真实激活/复现另裁；最终干净HEAD全CI实际另验。

[TD018同期采集工具窄授权R7](tasks/harness-final-network-sampling-authorization-2026-10-20.md)：仅有界白名单被动工具/纯测试，原超时立即失败与硬闸保持；任何网络配置不改，不再运行P1、实际复现另裁，最终全CI继续。

[最新同状态A8原26与runtime原1全绿](evidence/harness-final-browser-evidence-2026-10-20.md)：596a927首尾HEAD/树空、九次严格串行exit0/complete/owned全清；Source另原19生产器及精确回收全真。P1完整认证负例已证，精确还原7/11仍TCP建连中断，不充B2或两完整轮；Source/MRP旧待裁均历史，最终新HEAD全CI另验，非终验/竣工。

[TD018本机转发环境只读专项人裁R7](tasks/harness-final-network-environment-authorization-2026-10-20.md)：仅Docker Desktop/WSL/Windows只读定位与精确方案；监听/转发/防火墙修改逐项另批，原超时与失败硬闸不变，不重复P1求绿。A8/runtime与最终CI独立继续，非终验或竣工。

[Source原19＋3与真实故障清理完成](evidence/harness-final-source-lifecycle-2026-10-20.md)：正例2实际完整过、三项handled取消/KILL精确owned回收；首正例工具字段误报史保留，原19正文/样本/产品/UI3未改，独立只读复核通过。默认分支最终CI及P两整轮另验，不外推host掉电/强杀保证。

[Source owned生命周期实施](evidence/harness-final-source-lifecycle-2026-10-20.md)：host同事务schema/marker/同实例精确回收、原19 AST正文固定、默认分支守恒；30工具/lint/APItypecheck过，真实取消/故障与19+3尚待，不充通过。

[Source owned生命周期直接人裁R7](tasks/harness-final-source-lifecycle-authorization-2026-10-20.md)：仅可选schema/私有marker交接、同实例精确回收与真实取消/故障核验；原19正文/样本/产品/两配置/网络保持，先独立授权再实施，未充Source通过。

[MRP五期待直接人裁R7](tasks/harness-final-mrp-expectation-authorization-2026-10-20.md)：仅卡5/冻结2/建议与取整6000/说明2，保留放行6及其它全部断言/种子/产品/网络；先独立授权，再五处实施/原11与真实认证红绿，尚未执行不充通过。

[最新干净检查点及两项待裁](evidence/harness-final-blocked-checkpoint-2026-10-20.md)：b8abc83完整CI实际0/397020ms、API17297/Web436、覆盖77.25/93.74/85.46%，HEAD与树空守恒；Source生命周期/MRP五期待尚未批，P全链未完成/不能终验，最终新文档HEAD仍另完整实跑，§14不执行。

[Source未完成候选精确保全](tasks/harness-final-source-proposal-2026-10-20.md)：七工具文件完整公开源码补丁/hash/基线，已精确撤回执行入口、两个新文件可恢复；原API19与MRP期待未改，生命周期许可仍待，不充Source绿或终验。脏快照全CI被覆盖采集硬拒的失败保留，提交后干净HEAD另验。

[终验TD018资源/复现条件与runtime本轮](evidence/harness-final-network-diagnostics-2026-10-20.md)：固定资源基线/原5000ms硬闸保持，runtime原1例实际通过且owned全清；不是完整轮、不是旧超时根因修复，TD018保持开放。

[终验E当前62项/DoD10与收官草案](evidence/harness-final-closeout-preparation-2026-10-20.md)：62唯一顶层ID逐项去向、六开放P1承接提案、G5/真实覆盖及P欠项映射；阶段5主体已验非终验，DoD4/5不自动勾选，§14不执行，最终实际HEAD全CI另验。

[最新A七文件真实23例通过](evidence/harness-final-browser-evidence-2026-10-20.md)：c4f9c19同HEAD树空串行，原例完整/owned全清/无relay；Source仍待，不算完整A8轮或第二轮，后继变更仍按最新同状态完整重跑。

[MRP固定输入实证/最小期待候选](evidence/harness-final-browser-evidence-2026-10-20.md)：种子独立推导五建议/两冻结/6000；固定输入/数量bool实际全真，放行卡内5/外1合6，原五处期待未改、候选另待人裁；三次安全诊断史保留，不充P1绿或轮次。

终验D八张待决卡（仅建议，未批准/未实施）：[D1日历日期](tasks/harness-final-decision-bound003-2026-10-20.md)、[D2批次UUID](tasks/harness-final-decision-bound004-2026-10-20.md)、[D3记录锚点/SEC008](tasks/harness-final-decision-record-scope-2026-10-20.md)、[D4通知组织](tasks/harness-final-decision-employee-scope-2026-10-20.md)、[D5生产RO](tasks/harness-final-decision-production-readonly-2026-10-20.md)、[D6角色UAT](tasks/harness-final-decision-role-uat-2026-10-20.md)、[D7 CSP强制节奏](tasks/harness-final-decision-csp-2026-10-20.md)、[D8七个N+1排期](tasks/harness-final-decision-nplusone-2026-10-20.md)。每卡含现状/影响/多选项/建议/所需授权；C禁跑、不生产/部署、不修SQL或权限。

[MRP第二次固定诊断人裁](tasks/harness-final-acceptance-authorization-2026-10-20.md)：仅固定输入/6000条件布尔及标签卡内外计数，不改原期待或产品；先授权后实施，B/D/E继续。

[终验D真实PG影响](evidence/harness-final-decision-pg-evidence-2026-10-20.md)：四项定向过、owned逐例全清；非法日期PG拒绝/UUID批次部分提交重放/锚点缺列42703/通知仅仓储谓词差异，新SEC008登记P1待裁，不修产品或宣称HTTP可利用。

[终验B完整CI后补](evidence/harness-final-g5-evidence-2026-10-20.md)：a7432e6真实完整0/390232ms，首尾HEAD与干净树守恒，最终48结构自测已执行；G5工程验证闭环，业务体量债/P两轮/D/E及最终人类终验不充完成。

[终验B G5定向实测](evidence/harness-final-g5-evidence-2026-10-20.md)：377/3413，原29＋独立限期四项；48自测及真实201/过期/缺表红→精确还原绿，产品零改，实际新HEAD全CI待补，非终验/竣工。

[终验B G5基线与设计](tasks/harness-final-g5-design-2026-10-20.md)：完整生产src377/3413，四函数3627/3558/208/522；新200行AST门禁和独立有限精确表设计，原29/G3不动，尚未实施或验证。

[MRP固定只读观测结果](evidence/harness-final-browser-evidence-2026-10-20.md)：5卡/2冻结/6放行标签，原数量部分条件不匹配；host0/12867ms/owned全清，无原始产物导出，原6/3/6等期待不改、P1仍10过1败，静态归因及B/D/E继续。

[MRP固定只读诊断后继人裁](tasks/harness-final-acceptance-authorization-2026-10-20.md)：仅卡数/冻结/放行及原条件匹配，不改6/3/6等期待，保留10过1败；f13bec8干净HEAD完整CI0/387793ms，诊断待实施，B/D/E继续。

[终验P1完整11首跑结果](evidence/harness-final-browser-evidence-2026-10-20.md)：10过1败，四KPI/信用及生产实际过；唯一MRP原卡数6断言失败，实际数/归因未知，P1与第二轮按R7停止上报。无relay/owned全清，不能归因TD018，独立B/D/E继续。

[终验P正式浏览器证据（2026-10-20）](evidence/harness-final-browser-evidence-2026-10-20.md)：成本正式原2例绿→旧认证真红→精确还原2绿，原冷断言保留，TD013实施验证关闭；私有只读tmpfs/原硬闸/owned全清。Workspace旧闭环据实核账，P1全11/TD018诊断及最新同状态两完整轮仍待，非终验或竣工。

[终验收口人类新授权R7（2026-10-20）](tasks/harness-final-acceptance-authorization-2026-10-20.md)：37a7bb9阶段5主体已验收；P原spec/两完整轮/逐文件真变异主线，TD018只诊断；B新授完整函数G5，D只PG影响/决策卡、E材料刷新。产品/原29/G3/网络安全不放宽，最终干净HEAD全CI0后交人工终验，不执行§14或宣称竣工。

[驾驶舱四固定值已实施/浏览器阻断](tasks/harness-stage5-p1-money-authorization-2026-10-17.md)：先f06b459 R7，仅四唯一数字替换、其余spec字节保持proof0；实际原11集合7完成6过1败，驾驶舱路由附着失败/TD018中断、尚未抵达四KPI。owned全清，网络条件不改，新最终HEAD完整CI另验，不称11绿/第二轮/终验。

[驾驶舱四固定值后继R7](tasks/harness-stage5-p1-money-authorization-2026-10-17.md)：独立推导的950000/229000/950000/0 CNY已由人类批准，仅四字面量数字；先授权再实施，原其余断言/种子/产品/网络硬闸保持，新验证尚待。aa2d4ff完整CI0/331905ms，旧失败史保留，DoD4/5仍未完成。

[信用结清0与驾驶舱推导](tasks/harness-stage5-p1-money-authorization-2026-10-17.md)：只改两条完整指标等值断言，信用实际通过；原P1仅9完成8过1败后TD018中断，不称11绿。四KPI独立候选950000/229000/950000/0 CNY已提交审批，期待尚未修改。

[成本后继窄修实测](evidence/harness-stage5-browser-rulings-2026-10-17.md)：先人裁登记/旧实现护栏红，10回调＋43路由绿；原冷7expect PW0、34帧及末态可见，暖PW0，三handoff/owned清理全真。原整spec/auth变异与最终新HEAD全CI另计，旧失败史保留。

[阶段5后继四项R7](tasks/harness-stage5-authorization-2026-10-17.md)：信用两处结清0已批；驾驶舱仅独立推导再审批；结构不扩、DoD4/5未完成；成本先登记后独立最小产品修复，原冷提示断言保留。下方待裁与D为历史状态，不宣称后继已验证或终验。

[阶段5 D同状态三连](evidence/harness-stage5-coverage-protocol-2026-10-17.md)：4ca894f连续完整CI实际0，329429/330768/328574ms、首尾HEAD/树空，各<15分钟；分数/B/分母不变，非P全绿或人工终验，末次文档HEAD另验。

[成本提示三条件实测](evidence/harness-stage5-browser-rulings-2026-10-17.md)：旧冷PW0／当前冷PW1／当前暖PW0，三handoff可比、当前冷仅DOM瞬态无采样可见帧/末态，原冷合同保持失败；隔离/原断言/SHA与清理核完，产品C7待裁，不用暖路径或host采集0充绿。

[阶段5最新完整检查点](evidence/harness-stage5-coverage-protocol-2026-10-17.md)：0b78c94实际完整CI0/340356ms，API17293/Web426，真实覆盖37389/48566、629/671、9787/11512；A核心/E/F在链内验证、分母/B不变，非D最终三连。

[阶段5 F收官准备](evidence/harness-stage5-closeout-preparation-2026-10-17.md)：61项逐条去向、DoD10及§14映射/常驻diff草案；核心与成本诊断工具已完整CI三连，末次文档HEAD另验。四长函数/29旧豁免列具体待裁候选，不实施新例外、不归档或宣称竣工；[当前评分实测](QUALITY_SCORE.md)保历史并列真实覆盖分数。

[P1货币显示适配R7](tasks/harness-stage5-p1-money-authorization-2026-10-17.md)：亲核新增人类原话；仅main有据货币格式用独立固定期待，原币种/数值/数量/状态/seed保持，其它差异仍上报。

[P1逐路由适配R7](tasks/harness-stage5-p1-route-authorization-2026-10-17.md)：原始人类reply批准已版本化11例提案，真实菜单/逐页等待，原业务数值和seed保持，零产品改动。

[阶段5现状测试地图](evidence/harness-stage5-test-map-2026-10-17.md)：六域39项加质量/发货12项真实PG，Order360正向发货来源/事件；文档save/review/send真实回调12项补TEST007，Web部分DOM/types/实现注入；E运行时/机械hook与TEST019原335空对象绿，总61，不充最终三连/阶段验收。

[阶段5覆盖率首测协议](evidence/harness-stage5-coverage-protocol-2026-10-17.md)：3f03e62完整CI0内真实六包整体75.10%/domain93.74%/仓储79.44%首次同时达标，生产清单/分母与[首测固定基线](evidence/harness-stage5-coverage-baseline-2026-10-17.json)不变；保留失败史/报告hash/B不下降及双写豁免，不充最终三连或P线完成。

[阶段5浏览器考古与提案](evidence/harness-stage5-browser-rulings-2026-10-17.md)：main产品单页设计与P1逐例待裁方案，成本静态/实际证据及仍待受控对比，Workspace最小输入修正/TD018不放宽。

[Workspace字段适配完成](tasks/playwright-workspace-fixture-rulings-2026-10-17.md)：5230625新许可补真实tuple，缺字段/旧恢复DTO各真实红→还原原4过；A七份绿、成本/P1待后继，非第二轮完成。

[阶段5正式授权R7](tasks/harness-stage5-authorization-2026-10-17.md)：亲核人类原始消息，P/A–F范围、三覆盖率硬目标、唯一新直接依赖、串行PG、产品只临时注入还原、终验前不归档。接手5230625/树空，批次1–4已验收，阶段5未验证项不预写绿。

[P1首轮失败与安全定位](tasks/playwright-p1-replay-blocker-2026-10-17.md)：原完整11败保留；最新仅3完成/complete=false，前两例overview看板隐藏、第三未知，超时中断后owned全清。候选精确封存还原、TD-TEST-016可见性待裁/018连接待核，台账58，不改业务期待/网络失败条件。

[B私有执行器验证记录](evidence/playwright-local-private-runner-2026-10-17.md)：runtime真实1例过、Cookie omit真红→还原绿；额外共享anonymous变异实过未检出如实保留。reporter兼容及实际PW接线已验证；P1原11败/部分诊断仍非绿，不导PNG/未视觉验收。独立首轮已覆盖A8/B2，不等于最终HEAD整套PW或第二轮完成。

[B本地产物隔离接线方案](tasks/playwright-local-private-runner-2026-10-17.md)：按已授P1例外接只读容器/tmpfs/无raw导出/安全case索引；首版零PNG导出，不能称截图证据已保留。工具动态探针及runtime已验证，P1失败/中断另见上述证据，原config/业务断言/PG同一性保持。

[Source分页合成夹具R7与验证](tasks/playwright-source-fixture-ruling-2026-10-17.md)：原PG生产器19过、两次原夹具2过1败；人裁只应收stub补nextCursor:null，缺字段/auth各真红→还原原3例绿，样本SHA/权限/断言保持。TD-TEST-015仅该缺口实施关闭，55顶层项；成本/Workspace仍待裁。

[P1最小产物例外R7](tasks/playwright-p1-artifact-authorization-2026-10-17.md)：直接人类批准仅P1命令traceoff/只读容器及owned tmpfs原始产物不导出，只固定结果/核过业务截图；现已执行、首版未导图，不承诺RAM/swap物理零落盘，不扩runtime/C或业务断言。

[Workspace旧夹具失败/增量裁定](tasks/playwright-workspace-fixture-rulings-2026-10-17.md)：原2过2败、首次成本GET被gate挂起及360缺字段；等待点已人裁批准，字段独立待裁，原16expect/合成隔离冻结，台账54，非整文件已绿。

[Workspace单void语法R7](tasks/playwright-workspace-void-authorization-2026-10-17.md)：本会话原始人类仅批67行setAttribute未用void块体，原属性值/调用/全部节点和路由断言不变；不扩360字段或成本提示，先独立落盘再改。

[文档发送最小机械兼容R7](tasks/playwright-document-lint-authorization-2026-10-17.md)：人类明确只授该spec的8处旧strict ESLint阻断，类型擦除字节保持/void未使用例外，原业务断言参数/数据/步骤/规则不动；不扩其它spec或成本提示。

[成本转报价提示C7待裁](tasks/playwright-cost-handoff-blocker-2026-10-17.md)：真实PW1通过1失败，最后提示不可见而原URL/dialog/decisionId过；原trace只读核201→GET200及报价状态文本空。候选根因/产品或oracle范围待裁，临时auth适配精确还原未完成变异；台账53/未第二轮。

[Docker逐spec回放证据](evidence/playwright-docker-spec-replay-2026-10-17.md)：login2/doc7/order1/revocation2/startup5首轮过及真实红绿；Workspace/成本仍有失败、source/B未跑、第二轮禁，独立附件保失败史，C禁止；最终HEAD全CI另执行。

[P1本地成本种子验证](evidence/playwright-p1-cost-seed-2026-10-17.md)：最小原close前准备、其它字节不变；真实缺料/自批红、立即还原后同schema完整seed重复绿，计数1/2/1/2/异人/closed不变；独立只读复核，最终HEAD完整CI另实跑。下方旧待裁/未实施为前时点。

[P1本地成本种子增量R7](tasks/playwright-p1-cost-seed-authorization-2026-10-17.md)：原始人类批准已审方案最小本地policy/核算/异人批准，7b1bc62实际干净HEAD全CI0先完成；原close/其它步骤/SQL/配置/断言保护，独立变异/重复验证待执行。

[P1实际成本种子最小待裁方案（未实施）](tasks/playwright-p1-cost-seed-proposal-2026-10-17.md)：既有API policy→calculate→异人approve→原close、两主BOM测试费率/稳定标识与幂等候选；仅owned演示，事实/假设分开，不绕trigger/改SQL/断言。

[P1种子机器认证适配与当前C7停点](evidence/playwright-docker-seed-auth-2026-10-17.md)：一行URL/实际CLI绑定真红绿；信用pgcrypto环境项已修，后继生产关单500/P0001/缺实际成本批准待人裁（TD-TEST-011）；A/B/两轮未执行，非业务已修。

[Docker真实回环通道验证](evidence/playwright-docker-loopback-2026-10-17.md)：宿主guard/marker→容器只读同实例→自然Secure Cookie与Origin/真实PG计数；1流程/14工具负向、失败史/清理与最小lint接线，不是spec补跑。

[Docker Playwright三项增量裁定R7](tasks/playwright-docker-rulings-2026-10-17.md)：三份会话请求/oracle、真实容器回环HTTP/PG、seed机器URL最小适配已获原始人类批准；配置/业务断言/生产边界保持，先通道实证。

[Docker Playwright B通道原提案与后继裁定](tasks/playwright-docker-b-channel-proposal-2026-10-17.md)：原网关HTTP阻断历史；后继最小回环/PG同一性已获准并实测、seed仅token-login已适配；不改配置/业务源码。当前成本审批种子待决见上方C7，不重开已裁事项。

[Docker Playwright全量库存与通道准备](evidence/playwright-docker-inventory-2026-10-17.md)：12源/两配置、A8/B2/C2、逐处S4夹具与非fixture断言边界、网关真实Origin拒绝及本地镜像准备；未跑spec，C禁止。

[Docker Playwright前置补跑R7授权](tasks/playwright-docker-authorization-2026-10-17.md)：完整人类授权、九旧spec延期裁定、d801237实施收口/真实CI前置及本轮库存/本地通道边界；不代表S4整批人工验收或A/B补跑已通过。

[批次4唯一整体验收包](evidence/security-batch4-acceptance-2026-10-17.md)：S1–S4前后行为、全部必要期望/夹具适配与真实变异总索引、分层计数、配置/生产边界、提交/回滚及台账评分。f114ee0稳定干净HEAD全CI实际0/192524.18ms；本次仅文档收口，最后文档HEAD全CI另跑后交协调，整体人工验收未预填通过。SEC003关闭载体实施项，SEC001强制段/九旧PW义务/TD-TEST-006后继候选保持开放；下方为各小步历史导航。

[S4暂停状态显式退出窄修](evidence/security-batch4-s4-paused-logout-2026-10-17.md)：bfdc4ff、9新增真红绿/实现变异、API17242/Web313及真实DOM原失败链重跑通过；已包含于f114ee0稳定干净HEAD全CI0，整批人工验收待交付。

[S4真实网络与应用CDP](evidence/security-batch4-s4-network-2026-10-17.md)：Node4/SPA DOM8/Chrome Jar受控协议14=26、故障清理9与真实变异通过；f114ee0稳定干净HEAD全CI0/192524.18ms。SEC003载体实施项关闭，整批人工验收待交付；分层/失败史/有限窗口/资源清理边界保留。

[S4前端会话上下文切换](evidence/security-batch4-s4-frontend-2026-10-17.md)：五旧测试文件真红绿、core回调真变异；b38c75c独立全CI0/192629.727ms（Web304、预算11992/1898），后继f114ee0累积全CI0。该小步当时不跑浏览器/PW；后继CDP与当前实施状态见唯一交验包，九旧PW仍未执行。

> **作用**：docs/ 下每个 Markdown 文件都在本索引中，且每个链接可解析（校验：`node scripts/analysis/doc-lint.mjs`）。
> **状态标注**（D4 已裁决，2026-10-12，方案 A 轻触式）：`常驻`＝长期保留并随代码更新（全库共 51 项）；`已归档-只读`＝完成记录/历史快照，原位保留、不再更新、勿删（R5，全库共 54 项）；物理归档（git mv 到 archive/）暂不执行，若未来出现检索痛点再升级。
> **新鲜度**：常驻文档最近核验 2026-10-12（基线 `779dea3`）；归档文档标注原始日期。新增文档必须同步登记到本索引，否则 doc-lint 失败。

## 常驻入口（根与 docs 顶层）

[S4后端会话载体与逐文件期望映射](evidence/security-batch4-s4-backend-2026-10-17.md)：后端/config/机器接口小步的旧→新、六项依据、变异与分层验证；25526c8独立全CI0/203058.579ms，后继f114ee0累积全CI0。原冻结/停协调为当时边界，当前状态见唯一交验包。

[S4自然HTTP Secure Cookie预检](evidence/security-batch4-s4-cookie-http-2026-10-17.md)：隔离真实HTTP/真DOM/两Set-Cookie/浏览器Jar与回传，自有资源正常及4负向清理；fead2d1独立全CI0/205231.486ms。此预检本身不是S4后端或完整CSRF，九旧Playwright不抵销；后继实现见唯一交验包。

[S4正式实施开工R7引用](tasks/harness-batch4-s4-authorization-2026-10-17.md)：2e22837六项已决/原始人类授权亲核；先R7＋明确设计docs停协调只读复核，再直接续已授实施，不重问选型。人类另裁定九旧Playwright本轮不改，适配/逐文件变异/补跑一并为阶段5前硬前置，未执行不标绿/CDP不冲抵。

[S4实现设计与行为表](tasks/harness-batch4-s4-design-2026-10-17.md)：固定设计efae93d已协调确认；原“仅设计/工具、未实施”为历史时点，后继源码实现与验证已完成，当前整批人工验收仍待交付，见唯一交验包。

[S4批准前会话影响报告（历史）](tasks/harness-batch4-s4-session-impact-2026-10-17.md)：420f9ba实际干净HEAD全CI0/207904.734ms，重盘124 API源/123测试及Web/CDP/Playwright/CLI候选、两Cookie CSRF方案、跨tab/迟到Set-Cookie边界；原“待确认/仅报告硬停”保留当时时点，2e22837已六项裁定正式放行实施，当前范围以上方R7为准，不进入阶段5。

[S3 CSP验证与边界](evidence/security-batch4-s3-csp-2026-10-17.md)：行为762e393/oracle a4c2ca3/工具f693ee2实际稳定干净HEAD全CI0/219878.817ms，API17184/Web266/config29；原29/新CSP3/头矩阵20/工具65及失败史、源码/构建import与配套回滚。完成docs另实际HEAD全CI后停协调，非生产通道就绪/强制兼容声明。

[S3 CSP严格期望逐处清单](evidence/security-batch4-s3-oracle-map-2026-10-17.md)：74c78c3基线122旧API测试全AST守恒，68文件81头对象仅追加CSP字面量；S1固定历史证明保留，S3显式基线/目标，机械追加不输出fixture/补丁正文。

[批次4 S3 CSP先行设计](tasks/harness-batch4-s3-design-2026-10-17.md)：S2协调确认74c78c3后先登记，仅API/外层HTML Report-Only与默认off强制开关；真实Document头/首次导航前脱敏采集、独立精确合成发送DOM场景、旧oracle逐处映射及保护区。现时实现/真实CI见上方S3完成证据，原文保持设计时点。

[批次4 S2登录限流完成证据](evidence/security-batch4-s2-login-limit-2026-10-17.md)：业务bdbda0e首次全CI未分类端口红，独立精确声明身份门禁b8c1212全CI0/194043.303ms；API17175/Web266/config23、49门禁自测、原生入口/并发/代理及资源边界/失败史/回滚。最终证据HEAD另全CI后停协调，不启动S3/S4/阶段5；台账48，新增TD-HYG-002仅登记旧preview Dockerfile遗留COPY。

S2门禁适配：新增登录限流固定源唯一真实类声明身份分类及错类型/来源/改名跨仓拒绝对照，保持业务仓储归属规则；见[Service边界护栏](engineering/service-boundary-guard.md)。bdbda0e首次全CI未分类端口真实红，后继独立门禁b8c1212全CI0；纯名字候选漏报/修正史保留。

[批次4 S2登录限流设计](tasks/harness-batch4-s2-design-2026-10-17.md)：账户/IP独立10失败/15分钟、持锁失败退避、429不续禁、503容量边界、真实peer/显式可信链及配置透传；S1协调通过后先设计，尚未实施S3/S4。

[批次4 S1安全响应头证据](evidence/security-batch4-s1-headers-2026-10-17.md)：R7 bed8b40→业务b02ad55真实全量红→独立期望59f9dfa全CI0，API17114/Web266，逐处映射/保护区/风险及回滚；证据提交后另实际HEAD全CI，停协调续派S2，非批次4人工验收。

[S1响应头严格期望逐处清单](evidence/security-batch4-s1-oracle-map-2026-10-17.md)：76处/65文件仅追加获批三头，保留严格相等、请求夹具及其余断言；保留源码HEAD首次全量红，后继test提交重新全链。

历史时点（R7初始授权）：当时批次1/2含E1/3已人工验收64757d4，正式授权批次4 D1；[R7实施授权与S4硬停止边界](tasks/harness-batch4-authorization-2026-10-17.md)。当时执行步先S1，其它步骤按顺序另派；现时S3状态以上方入口为准。

历史时点（批次3收尾、人工验收前）：当时3a–3f实施与独立复核完成，业务dc3697b干净HEAD全CI0；47台账，原Playwright仍待补跑。[整批验收包](evidence/frontend-batch3-acceptance-2026-10-17.md)汇总实测评分/回滚/保护区和工具证明更正。当时独立工具/文档收尾提交后另全CI，等待用户整批人工验收，不进4/5；此后批次3已验收64757d4，现时S3状态以上方入口为准，下表旧职责时态保留历史。

| 文档                                                                                | 职责                                                             | 状态                    |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ----------------------- |
| [AGENTS.md](../AGENTS.md)                                                           | 智能体入口地图（≤100 行）                                        | 常驻                    |
| [ARCHITECTURE.md](../ARCHITECTURE.md)                                               | 领域与包分层、依赖方向规则与验证点                               | 常驻                    |
| [README.md](../README.md)                                                           | 项目简介与本地起步                                               | 常驻                    |
| [CI.md](CI.md)                                                                      | 框架判定（非 Tauri）与 CI 决策记录                               | 常驻                    |
| [GATES.md](GATES.md)                                                                | 门禁清单（11 项 CI 链 + 2 个本地 hook + 豁免机制）               | 常驻                    |
| [RELIABILITY.md](RELIABILITY.md)                                                    | 可靠性机制与发布链路 runbook（逐步对应 deploy-production.yml）   | 常驻                    |
| [QUALITY_SCORE.md](QUALITY_SCORE.md)                                                | 按域质量评分（可复算依据）                                       | 常驻                    |
| [design-docs/core-beliefs.md](design-docs/core-beliefs.md)                          | 核心信念（争议裁决依据）                                         | 常驻                    |
| [exec-plans/active/harness-migration.md](exec-plans/completed/harness-migration.md) | 批次4 S1–S3人工验收；S4已授权，先R7/设计docs停协调复核再编码     | 常驻                    |
| [exec-plans/tech-debt-tracker.md](exec-plans/tech-debt-tracker.md)                  | 技术债现48项含历史，新增TD-HYG-002旧preview Dockerfile引用仅登记 | 常驻                    |
| [local-acceptance-cleanup.md](local-acceptance-cleanup.md)                          | `.local-acceptance/` 本地产物清理边界与手动脚本说明              | 常驻                    |
| [harness-2026-10-21.md](exec-plans/completed/harness-2026-10-21.md)                 | Harness 一次性施工图（已竣工归档）                               | 历史归档                |
| [WORKSPACE_ROUTE_ISOLATION.md](WORKSPACE_ROUTE_ISOLATION.md)                        | 工作区路由隔离说明（2026-09-06）                                 | 已归档-只读（事件复盘） |

## docs/adr（架构决策记录，10 篇）

[3f解析与证明更正](evidence/frontend-3f-parsers-2026-10-17.md)：已知HTTP/storage轻量schema，266 Web/34工具/50及原29浏览器，三个AST证明工具完整遍历修复与固定SHA重算；源码实际HEAD全CI/整批收尾待补，不替代原Playwright。

[3f前置CDP夹具契约修正](evidence/frontend-3f-cdp-fixture-2026-10-16.md)：用户确认独立补客户360服务端固定unavailableSections，旧红→工具33绿；业务WIP隔离，原UI断言/网络硬闸不动，原29与实际干净HEAD全CI待补。

[3e③日期统一证据](evidence/frontend-3e-date-2026-10-16.md)：全runtime13调用/10消费者收敛三原语；179测试、13逆展开完整AST/旧457链及两种真实红绿，扩展47及原29浏览器/源码c0a549f实际干净HEAD完整CI0/177552.922ms，完成docs另全CI，随后解析3f。

[3e②惰性读取证据](evidence/frontend-3e-lazy-2026-10-16.md)：首次缺失源/已访问复用；21闭包、163测试、8锚点红绿、默认逆AST/70公开457链、原29及新47真实0；overview仍全授权读取，源码580cc72实际干净HEAD完整CI0/179498.691ms，完成docs另全CI后继续，续日期3e→解析3f。

[3e①store守恒证据](evidence/frontend-3e-store-2026-10-16.md)：源码fc14d50稳定干净实际HEAD全CI0/184438.376ms；5runtime全类逆证明/70公开457链/五红绿/原114+六定向120/新41及独立原fixture29齐，root704/160/AST3且撤入口豁免31→29，旧门控/顶层会话疑点仅登记44项；完成docs另全CI后续真正lazy/日期，尚非3e完成。

[3d治理证据](evidence/frontend-3d-governance-2026-10-16.md)：源码041e771稳定干净实际HEAD全CI0/177598.590ms；28新TS≤187/完整函数142/AST5/root997、完整1124行逆展开/70公开457链/27runtime真红还原114/旧新41及正常37/33/29齐；全200不冒称错误排序/写安全矩阵，启动EACCES失败史保留，完成docs另全CI后续3e→3f。

[3c⑪剩余共享证据](evidence/frontend-3c11-remaining-shared-2026-10-16.md)：源码32a277e稳定干净实际HEAD全CI0/179131.066ms；12新TS≤101/完整函数95/AST4/root2545，renderer/service与18声明逆证明/70公开457链/12红绿/新37及正常33/29齐，TD-PERF-003仅登记待核实；完成docs另全CI后继续治理3d→3e→3f。

[3c⑩在线文档证据](evidence/frontend-3c10-document-editor-2026-10-16.md)：源码78d726c稳定干净实际HEAD全CI0/181480.679ms；16TS≤172/完整函数165/AST5/root3066，完整800行14逆展开/70公开457链/15目标红绿、旧新37及正常33/29齐，三轮失败史与TD-WEB-005只登记保留；完成docs另全CI后续共享→3d–3f。

[3c⑨共享列表工具证据](evidence/frontend-3c9-register-tools-2026-10-16.md)：源码8a3b00c稳定干净实际HEAD全CI0/177320.318ms；11TS≤144/完整函数138/AST5/root3880，8逆展开/七live state/profile/70公开457链/十目标红绿/旧新扩展33齐；正常29也绿，完成docs实际HEAD另全CI，editor等共享→3d–3f继续。

[3c⑧基础共享证据](evidence/frontend-3c8-shared-foundations-2026-10-16.md)：源码541376f稳定干净实际HEAD全CI0/183823.324ms；六runtime≤289/完整函数103/AST5/root4520，43声明AST及剩余入口顺序/70公开457链/六红绿/旧新29齐，完成docs实际HEAD另全CI，共享editor/listtools及3d–3f继续。

[3c⑦共享装配证据](evidence/frontend-3c7-commercial-assembly-2026-10-16.md)：源码944a175稳定干净实际HEAD全CI0/185605.700ms，root5203/商业函数160、10逆展开/21导入边/70公开457链/八目标红绿/旧新29齐；TD-TEST-007仅登记40项，完成docs另全CI后续共享→3d–3f。

[3c⑥制造采购质量完成证据](evidence/frontend-3c6-operations-2026-10-16.md)：源码3f77a81/工具830d1fb各实际干净HEAD全CI0，36逆展开/70公开457链/27红绿/旧新11/两次正常28齐；TD006独立收口/完整失败史/旧metrics事后只读重放口径保留，21主视图已迁但共享未结清。

[3c⑤资金风险完成证据](evidence/frontend-3c5-finance-risk-2026-10-16.md)：源码00766d6完整CI0/175184.510ms、完成docs693c42f完整CI0/173041.324ms；八目标红绿/旧新16/组合24齐，后续⑥不重复许可。

[3c④订单履约完成证据](evidence/frontend-3c4-fulfillment-2026-10-16.md)：源码6ade731稳定干净实际HEAD完整CI0/182166.585ms；12模块/21逆展开及原type-predicate/70绑定457链/11目标红绿、旧新展开11与组合19齐。双生产面板/风险槽/旧权限耦合不改，首红与补展开史保持，完成docs另全CI后续⑤。

[3c③信用与合同完成证据](evidence/frontend-3c3-agreements-2026-10-16.md)：源码e401d27稳定干净实际HEAD完整CI0/182693.526ms；四新模块/完整逆展开/70绑定457断言/三目标红绿及旧新9、组合15只读探针齐。TD-WEB-004仅登记不修，文档操作与Playwright不计覆盖；完成状态docs检查点另全CI后续④。

3c②现时：实施与独立复核完成，源码/工具两HEAD全CI0；台账现38项（TD-TEST-006按测试工具边界关闭，旧37历史不改），原Playwright全补跑和3f后整批验收边界保持，完成证据如下。

[3c①线索方案完成证据](evidence/frontend-3c1-sales-2026-10-16.md)：a34df41稳定干净全CI0/167522.718ms，三视图守恒/70绑定457断言/114/真实变异/旧新CDP10与首失败史、共享残留归宿和回滚齐。

[3c②成本政策报价完成证据](evidence/frontend-3c2-pricing-2026-10-16.md)：源码9429a31与独立工具3f3aae7干净HEAD全CI0；12模块/逆展开/70绑定457断言/11目标红绿及两次无trace13齐，旧失败史/有限竞态保留，现归并docs检查点另全CI后续3c③。

[能力门禁静态TS读源修正](evidence/frontend-capability-runtime-graph-2026-10-16.md)：用户授权47a8ee5；入口静态图/原39-19逐文件规则/边界自测及实际新源负向，独立于3b业务候选。

[3b CRM域完成证据](evidence/frontend-3b-crm-2026-10-16.md)：源码487d698干净HEAD完整CI0，controller/records/shell及必要共享模块守恒、70公开绑定/457断言/实际读源变异/CDP与回滚；失败史及旧候选时点保留。

[3a唯一现时检查点](evidence/frontend-3a-checkpoint-2026-10-16.md)：五公共模块/两必要纯类型的现时SHA-CI-回滚总表、全部读取映射/变异与CDP边界；历史小步措辞以本页为准。

[3a navigation](evidence/frontend-3a-navigation-2026-10-16.md)：十声明/完整函数/同一卸载WeakMap及70公开绑定守恒、utility读源映射/真实红绿、七场景CDP。

[3a商业HTTP工厂](evidence/frontend-3a-commercial-http-2026-10-16.md)：完整116行箭头工厂/必要类型/facade守恒，分页源码读取映射与真实变异红绿、web114/预算/分步回滚。

[3a CRM HTTP工厂](evidence/frontend-3a-crm-http-2026-10-16.md)：shared工厂及必要纯类型前置，原公开facade与完整源码逐字守恒；原测试零适配、格式对拍失败/路径纠正保留，逐步验证与回滚。

[3a locale小步](evidence/frontend-3a-locale-2026-10-16.md)：两张纯文案表/完整函数逐字移动、治理查询保持、原web114/预算/七场景CDP及独立回滚；form前步86e7026完整CI已过。

[3a公共form小步](evidence/frontend-3a-form-2026-10-16.md)：完整函数/类型逐字守恒、测试切片绑定与真实变异红绿、旧新表单CDP探头及独立回滚；不等同整批完成。

[新web C3最小AST护栏](evidence/frontend-c3-guard-2026-10-16.md)：四新目录及routes子目录真实CLI 29对照、38自测，旧31/G3/G4/其他路径保持；尚未迁移3a，函数200仍独立完整函数计量。

[CDP六场景/五类确定性探头基线](evidence/frontend-cdp-harness-2026-10-16.md)：合成stub/静态白名单隔离、真实click/fill、设备/路由/可见文本/文档溢出、hold竞态及两个真实负向；仅三个业务route，非Playwright/真实API/21视图全覆盖；保留失败史与补跑地图。

[Windows Chrome CDP通道预检](evidence/windows-chrome-cdp-preflight-2026-10-16.md)：ad0435e裁定/02d93f4续派，owned loopback、版本、WSL preview真实DOM/资源200及清理通过；五类harness/Playwright尚未执行，阶段5前真实补跑义务保持。

前端批次3前置地图/历史阻断：[冻结源码断言与Chrome环境](evidence/frontend-batch3-preflight-blockers-2026-10-16.md)（保留历史；ad0435e新裁定允许Windows Chrome CDP临时通道，先连通预检，执行边界见计划§7；Playwright配置/九spec冻结，阶段5前真实补跑）。

E1先行固定证据：[authorization守恒候选/773例旧新探针](evidence/e1-authorization-conservation-2026-10-16.md)（授权310c1e2；先完成E1完整验证，再前端前置地图/冲突停报）。

双线B原规则基线与AST候选：[routes结构扫描基线](evidence/routes-structure-baseline-2026-10-16.md)（授权c75dd7b；116文件原G1/G2/G3、31旧豁免及AST候选逐文件数据；实施前审查材料）。

2e工程护栏说明：[Service边界护栏与库存](engineering/service-boundary-guard.md)（工程历史快照保留；2e已人工验收，源码基线c4ab493、验收5e94439＋924fca9，按护栏＋零迁移证据结案、不扩同仓；2f/3/4/5未授权；静态能力边界不扩大）。

> D4 裁决：常驻原位。架构改动前先读对应 ADR；与 ADR 冲突的改动须新开 ADR。

| 文档                                                                                                | 状态 |
| --------------------------------------------------------------------------------------------------- | ---- |
| [0001-typescript-monorepo-stack](adr/0001-typescript-monorepo-stack.md)                             | 常驻 |
| [0002-postgresql-access-and-migrations](adr/0002-postgresql-access-and-migrations.md)               | 常驻 |
| [0003-opaque-session-authentication](adr/0003-opaque-session-authentication.md)                     | 常驻 |
| [0004-rbac-and-data-scope](adr/0004-rbac-and-data-scope.md)                                         | 常驻 |
| [0005-versioned-platform-engines](adr/0005-versioned-platform-engines.md)                           | 常驻 |
| [0006-transactional-outbox-and-local-adapters](adr/0006-transactional-outbox-and-local-adapters.md) | 常驻 |
| [0007-immutable-business-object-schemas](adr/0007-immutable-business-object-schemas.md)             | 常驻 |
| [0008-p1-crm-compatibility-and-patterns](adr/0008-p1-crm-compatibility-and-patterns.md)             | 常驻 |
| [0009-commercial-revision-graph](adr/0009-commercial-revision-graph.md)                             | 常驻 |
| [0010-immutable-quote-to-cash-ledger](adr/0010-immutable-quote-to-cash-ledger.md)                   | 常驻 |

## docs/agent-memory（智能体记忆库，13 篇）

> D4 裁决：**保留为常驻**。Studio/Codex 工作流的活跃工作记忆（takeover-status 最近更新 2026-10-08），维持其只追加约定；与 exec-plans 体系并行。**历史记忆仅作过程记录——当前事实以 `AGENTS.md`、`ARCHITECTURE.md`、`docs/CI.md`、`docs/RELIABILITY.md` 与 `exec-plans/active/` 为准**，避免旧分支状态误导后续会话。

| 文档                                                                                             | 状态 |
| ------------------------------------------------------------------------------------------------ | ---- |
| [2026-08-17-studio-long-task-heartbeat](agent-memory/2026-08-17-studio-long-task-heartbeat.md)   | 常驻 |
| [2026-08-18-l02-ctr-solution-foundation](agent-memory/2026-08-18-l02-ctr-solution-foundation.md) | 常驻 |
| [CANONICAL_EXECUTION_BASELINE](agent-memory/CANONICAL_EXECUTION_BASELINE.md)                     | 常驻 |
| [README](agent-memory/README.md)                                                                 | 常驻 |
| [decisions](agent-memory/decisions.md)                                                           | 常驻 |
| [evidence](agent-memory/evidence.md)                                                             | 常驻 |
| [execution-boundary](agent-memory/execution-boundary.md)                                         | 常驻 |
| [handoff](agent-memory/handoff.md)                                                               | 常驻 |
| [project-issue-matrix](agent-memory/project-issue-matrix.md)                                     | 常驻 |
| [project-state](agent-memory/project-state.md)                                                   | 常驻 |
| [sessions](agent-memory/sessions.md)                                                             | 常驻 |
| [takeover-status](agent-memory/takeover-status.md)                                               | 常驻 |
| [task-sequence](agent-memory/task-sequence.md)                                                   | 常驻 |

## docs/deployment（部署运维，2 篇）

> D4 裁决：常驻。PRODUCTION_PARK_HOST 为生产主机细节 runbook（RELIABILITY.md 引用）；FEISHU 同步为在用流程（最近更新 2026-08-24）。

| 文档                                                               | 状态 |
| ------------------------------------------------------------------ | ---- |
| [FEISHU_CODEX_THREAD_SYNC](deployment/FEISHU_CODEX_THREAD_SYNC.md) | 常驻 |
| [PRODUCTION_PARK_HOST](deployment/PRODUCTION_PARK_HOST.md)         | 常驻 |

## docs/engineering（工程规格，22 篇：常驻 13 + 已归档 9）

> D4 裁决：活跃规格（蓝图/总计划/角色目录/身份授权/基座运营/能力矩阵/成本闭环/业务文档/L19-L20 规格/回归预防等 13 篇）常驻；KT-UI-PROD 系列（9 篇，编号无 04/05）为前端产品化完成记录，已归档-只读（README 仍引用 08/09，原位保留保证链接可达）。

| 文档                                                                                                                  | 状态                    |
| --------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| [ATOMIC_ROLE_AND_UAT_MATRIX](engineering/ATOMIC_ROLE_AND_UAT_MATRIX.md)                                               | 常驻                    |
| [BUSINESS_DOCUMENT_COMMUNICATIONS](engineering/BUSINESS_DOCUMENT_COMMUNICATIONS.md)                                   | 常驻                    |
| [COST_QUOTE_ORDER_CLOSED_LOOP](engineering/COST_QUOTE_ORDER_CLOSED_LOOP.md)                                           | 常驻                    |
| [FOUNDATION_OPERATIONS](engineering/FOUNDATION_OPERATIONS.md)                                                         | 常驻                    |
| [FRONTEND_CAPABILITY_PERMISSION_MATRIX](engineering/FRONTEND_CAPABILITY_PERMISSION_MATRIX.md)                         | 常驻                    |
| [IDENTITY_AUTHORIZATION](engineering/IDENTITY_AUTHORIZATION.md)                                                       | 常驻                    |
| [KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT](engineering/KINGTURF_V2_ATOMIC_OPERATIONS_BLUEPRINT.md)                     | 常驻                    |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC](engineering/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_SPEC.md)                       | 常驻                    |
| [KT-L20_COMPLAINT_NCR_CAPA_SPEC](engineering/KT-L20_COMPLAINT_NCR_CAPA_SPEC.md)                                       | 常驻                    |
| [KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN](engineering/KT-UI-PROD-01_FRONTEND_PRODUCTION_COMPLETION_PLAN.md) | 已归档-只读（完成记录） |
| [KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT](engineering/KT-UI-PROD-02_FRONTEND_REFINEMENT_AUDIT.md)                     | 已归档-只读（完成记录） |
| [KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT](engineering/KT-UI-PROD-03_LAYOUT_AND_VISUAL_AUDIT.md)                         | 已归档-只读（完成记录） |
| [KT-UI-PROD-06_PROCESS_NAVIGATION](engineering/KT-UI-PROD-06_PROCESS_NAVIGATION.md)                                   | 已归档-只读（完成记录） |
| [KT-UI-PROD-07_COST_WORKBENCH](engineering/KT-UI-PROD-07_COST_WORKBENCH.md)                                           | 已归档-只读（完成记录） |
| [KT-UI-PROD-08_PRODUCT_AUDIT](engineering/KT-UI-PROD-08_PRODUCT_AUDIT.md)                                             | 已归档-只读（完成记录） |
| [KT-UI-PROD-09_STARTUP_DELIVERY](engineering/KT-UI-PROD-09_STARTUP_DELIVERY.md)                                       | 已归档-只读（完成记录） |
| [KT-UI-PROD-10_LOGO_DOCUMENT_SEND](engineering/KT-UI-PROD-10_LOGO_DOCUMENT_SEND.md)                                   | 已归档-只读（完成记录） |
| [KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE](engineering/KT-UI-PROD-11_DOCUMENT_ACTION_GUIDANCE.md)                       | 已归档-只读（完成记录） |
| [MASTER_DEVELOPMENT_PLAN](engineering/MASTER_DEVELOPMENT_PLAN.md)                                                     | 常驻                    |
| [OPERATING_MODEL_AND_ROLE_CATALOG](engineering/OPERATING_MODEL_AND_ROLE_CATALOG.md)                                   | 常驻                    |
| [PRODUCT_BLUEPRINT](engineering/PRODUCT_BLUEPRINT.md)                                                                 | 常驻                    |
| [REGRESSION_PREVENTION](engineering/REGRESSION_PREVENTION.md)                                                         | 常驻                    |

## docs/evidence（验收证据，23 篇）

> D4 裁决：已归档-只读（历史验收快照，原位保留）。

| 文档                                                                                                                       | 状态                            |
| -------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| [BATCH1_INTEGRATION_REPORT_20261008](evidence/BATCH1_INTEGRATION_REPORT_20261008.md)                                       | 已归档-只读（验收快照）         |
| [BATCH1_RELEASE_SAFETY_REPORT_20261008](evidence/BATCH1_RELEASE_SAFETY_REPORT_20261008.md)                                 | 已归档-只读（验收快照）         |
| [BATCH25_CI_GATE_RECOVERY_REPORT_20261008](evidence/BATCH25_CI_GATE_RECOVERY_REPORT_20261008.md)                           | 已归档-只读（验收快照）         |
| [BATCH2_AUTH_SECURITY_REPORT_20261008](evidence/BATCH2_AUTH_SECURITY_REPORT_20261008.md)                                   | 已归档-只读（验收快照）         |
| [BATCH2_PR_INTEGRATION_REPORT_20261008](evidence/BATCH2_PR_INTEGRATION_REPORT_20261008.md)                                 | 已归档-只读（验收快照）         |
| [BATCH3_AUTHORIZATION_REPORT_20261008](evidence/BATCH3_AUTHORIZATION_REPORT_20261008.md)                                   | 已归档-只读（验收快照）         |
| [GITHUB_PROTECTION_AUDIT_20261008_BATCH1](evidence/GITHUB_PROTECTION_AUDIT_20261008_BATCH1.md)                             | 已归档-只读（验收快照）         |
| [KT-L07_ACCEPTANCE](evidence/KT-L07_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L08_ACCEPTANCE](evidence/KT-L08_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L09_ACCEPTANCE](evidence/KT-L09_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L10_ACCEPTANCE](evidence/KT-L10_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L11_ACCEPTANCE](evidence/KT-L11_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L12_ACCEPTANCE](evidence/KT-L12_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L13_ACCEPTANCE](evidence/KT-L13_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L14_ACCEPTANCE](evidence/KT-L14_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L15_ACCEPTANCE](evidence/KT-L15_ACCEPTANCE.md)                                                                         | 已归档-只读（验收快照）         |
| [KT-L17_ACTUAL_MANUFACTURING_COST_20260822](evidence/KT-L17_ACTUAL_MANUFACTURING_COST_20260822.md)                         | 已归档-只读（验收快照）         |
| [KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824](evidence/KT-L18_SHIPMENT_RELEASE_LOGISTICS_POD_20260824.md)               | 已归档-只读（验收快照）         |
| [KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825](evidence/KT-L19_COLLECTIONS_LEGAL_EVIDENCE_LOCAL_GATE_20260825.md) | 已归档-只读（验收快照）         |
| [KT-RG01_PRODUCTION_REACCEPTANCE_20260822](evidence/KT-RG01_PRODUCTION_REACCEPTANCE_20260822.md)                           | 已归档-只读（验收快照）         |
| [KT_RBAC_ATOMIC_ROLE_UAT_20260822](evidence/KT_RBAC_ATOMIC_ROLE_UAT_20260822.md)                                           | 已归档-只读（验收快照）         |
| [PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010](evidence/PROJECT_TAKEOVER_DEV_TEST_ACCEPTANCE_REPORT_20261010.md)   | 已归档-只读（验收快照）         |
| [PROJECT_TAKEOVER_REPORT_20261008](evidence/PROJECT_TAKEOVER_REPORT_20261008.md)                                           | 已归档-只读（验收快照）         |
| [playwright-docker-channel-2026-10-17](evidence/playwright-docker-channel-2026-10-17.md)                                   | 常驻（Playwright 补跑通道核查） |

## docs/tasks（历史任务档案，23 篇：常驻 2 + 已归档 21）

> D4 裁决：ROADMAP 与 KINGTURF_V2_LONG_TASK_PLAN 常驻（活跃规划，目标 2027-06-30）；JTF-P0/P1 任务档案已归档-只读。

| 文档                                                                          | 状态                    |
| ----------------------------------------------------------------------------- | ----------------------- |
| [JTF-P0-E01-REPOSITORY-BOOTSTRAP](tasks/JTF-P0-E01-REPOSITORY-BOOTSTRAP.md)   | 已归档-只读（任务档案） |
| [JTF-P0-E02-CONFIGURATION](tasks/JTF-P0-E02-CONFIGURATION.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E03-DATABASE-FOUNDATION](tasks/JTF-P0-E03-DATABASE-FOUNDATION.md)     | 已归档-只读（任务档案） |
| [JTF-P0-E04-ORGANIZATION-EMPLOYEE](tasks/JTF-P0-E04-ORGANIZATION-EMPLOYEE.md) | 已归档-只读（任务档案） |
| [JTF-P0-E05-AUTHENTICATION](tasks/JTF-P0-E05-AUTHENTICATION.md)               | 已归档-只读（任务档案） |
| [JTF-P0-E06-AUTHORIZATION](tasks/JTF-P0-E06-AUTHORIZATION.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E07-MASTER-DATA](tasks/JTF-P0-E07-MASTER-DATA.md)                     | 已归档-只读（任务档案） |
| [JTF-P0-E08-NUMBERING](tasks/JTF-P0-E08-NUMBERING.md)                         | 已归档-只读（任务档案） |
| [JTF-P0-E09-AUDIT](tasks/JTF-P0-E09-AUDIT.md)                                 | 已归档-只读（任务档案） |
| [JTF-P0-E10-WORKFLOW](tasks/JTF-P0-E10-WORKFLOW.md)                           | 已归档-只读（任务档案） |
| [JTF-P0-E11-RULES](tasks/JTF-P0-E11-RULES.md)                                 | 已归档-只读（任务档案） |
| [JTF-P0-E12-NOTIFICATIONS](tasks/JTF-P0-E12-NOTIFICATIONS.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E13-ATTACHMENTS](tasks/JTF-P0-E13-ATTACHMENTS.md)                     | 已归档-只读（任务档案） |
| [JTF-P0-E14-EVENTS](tasks/JTF-P0-E14-EVENTS.md)                               | 已归档-只读（任务档案） |
| [JTF-P0-E15-BUSINESS-OBJECTS](tasks/JTF-P0-E15-BUSINESS-OBJECTS.md)           | 已归档-只读（任务档案） |
| [JTF-P0-E16-OBSERVABILITY](tasks/JTF-P0-E16-OBSERVABILITY.md)                 | 已归档-只读（任务档案） |
| [JTF-P0-E17-QUALITY](tasks/JTF-P0-E17-QUALITY.md)                             | 已归档-只读（任务档案） |
| [JTF-P1-E01-E04-SALES-TO-CASH](tasks/JTF-P1-E01-E04-SALES-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E05-E10-SALES-TO-CASH](tasks/JTF-P1-E05-E10-SALES-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E11-E17-QUOTE-TO-CASH](tasks/JTF-P1-E11-E17-QUOTE-TO-CASH.md)         | 已归档-只读（任务档案） |
| [JTF-P1-E18-E21-CLOSURE](tasks/JTF-P1-E18-E21-CLOSURE.md)                     | 已归档-只读（任务档案） |
| [KINGTURF_V2_LONG_TASK_PLAN](tasks/KINGTURF_V2_LONG_TASK_PLAN.md)             | 常驻                    |
| [ROADMAP](tasks/ROADMAP.md)                                                   | 常驻                    |

## exec-plans/completed/

归档计划：[harness-2026-10-21.md](exec-plans/completed/harness-2026-10-21.md)。

## docs/productization（V1.0接管与产品化草稿）

| 文件                                                                                 | 内容与状态                                |
| ------------------------------------------------------------------------------------ | ----------------------------------------- |
| [KingTurf V1.0 产品化改造与试运行交付工程](productization/README.md)                 | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 真实业务验收方案](productization/business-acceptance.md)              | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 业务能力和实现映射](productization/business-capability-matrix.md)     | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 技术债和整改清单](productization/debt-remediation.md)                 | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 行业对标](productization/industry-benchmark.md)                       | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 产品差距分析](productization/product-gap-analysis.md)                 | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 发布和试运行准入报告草案](productization/release-readiness.md)        | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 执行路线图草案](productization/roadmap.md)                            | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 接管审计 2026年10月26日](productization/takeover-audit-2026-10-26.md) | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 目标技术架构草案](productization/target-architecture.md)              | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 目标产品设计草案](productization/target-product-design.md)            | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 受控试运行和维护方案草案](productization/trial-operations.md)         | 2026-10-26本地审计/方案草稿；未作业务放行 |
| [KingTurf V1.0 接管验证证据 2026年10月26日](productization/verification-evidence.md) | 2026-10-26本地审计/方案草稿；未作业务放行 |

[本地正确性整改执行](productization/local-execution-2026-10-26.md)：本地审计保全、A/B/C及获批BOM/来源规则、分提交与新SHA验证，生产/远程禁写。

[KingTurf V1.0 本地整改交付记录 2026年10月26日](productization/local-delivery-2026-10-26.md)：本地修复/提交、PG与CI、浏览器两轮、失败史和残余。

[KingTurf 本地整改后的业务决策材料](productization/local-business-decisions-2026-10-26.md)：风险重放、驳回成本修订、发运出库与金额/利润，待批准内容不实施。

[KingTurf V1.0 Batch 2 本地执行与授权记录](productization/batch2-execution-2026-10-26.md)：916f63f后继，风险重放实施，成本/发运/金额/版本设计边界，远程生产禁写。

[KingTurf V1.0 Batch 2 本地交付记录](productization/batch2-delivery-2026-10-26.md)：风险评价重放整改、成本/发运设计、新PG阻断与真实验证分层。

[Batch 2 制造成本不可变修订设计](productization/batch2-cost-revisions.md)：状态机/关联模型/门卫/API/UI/兼容回退，尚未批准正式实施。

[Batch 2 发运与出库闭环设计](productization/batch2-shipping-inventory.md)：A/B比较、数量来源/库存并发/撤销/历史与待裁。

[Batch 2 金额、BOM版本与订单利润研究](productization/batch2-money-bom-profit.md)：独立精度样本、版本冻结、四层成本与利润权威。

[Batch 2 四项长函数豁免独立整改计划](productization/batch2-complexity-plan.md)：到期、重叠、守恒拆分与回归保护，不续期。

[KingTurf V1.0 Batch 3 本地执行授权与计划](productization/batch3-execution-2026-10-26.md)：19d40a2后继，库存/风险三项正式修复、独立G5守恒及设计边界。

[ADR 0011: Serialize inventory resources without a second balance ledger](adr/0011_inventory_resource_serialization.md)：Batch3库存保护行、快照、兼容与回退；仅本地验证授权。

[V1.0 Batch8累计集成与岗位验收前置](productization/batch8-integration-uat.md)：迁移/API兼容、十岗位合成验收边界和未决规则阻断。

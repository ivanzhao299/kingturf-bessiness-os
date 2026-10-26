# KingTurf V1.0 行业对标

研究日 2026-10-26，KingTurf 基线 `b1ef7a9`。采用官方产品与标准资料，竞品能力用于设计参照，不直接变成本企业需求。Odoo 为 19.0 文档、SAP Business One 为 10.0；ERPNext 和 Business Central 是滚动在线文档，未绑定企业安装版本；金蝶和用友为公开官方方案，未核实商业许可与接口版本。访问失败或版本不明之处不扩大结论。

## 十二业务域

| 业务域       | 成熟方式和官方来源                                                                                                                                                                                                                                                                       | 本项目现状及实际影响                                                | 保留与改造                                            | 不适用或暂缓                        |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------- |
| 客户商机     | Odoo19 [CRM阶段与赢失分析](https://www.odoo.com/documentation/19.0/applications/sales/crm/performance/win_loss.html)                                                                                                                                                                     | 已有客户/商机/归属/360；真实操作在能力矩阵                          | 保留生命周期；按销售交接和责任队列验收                | 企业未确认前不扩营销自动化平台      |
| 规格技术     | Odoo19 [产品变体](https://www.odoo.com/documentation/19.0/applications/sales/sales/products_prices/products/variants.html)                                                                                                                                                               | specification JSON与CTR/方案可存规格，未证所有草坪生产约束          | 版本化技术条件、受控枚举、单位、上下游继承            | 不把每个颜色/卷长组合自动建海量SKU  |
| BOM工艺      | [ERPNext BOM](https://docs.frappe.io/erpnext/bill-of-materials)、[BC工艺](https://learn.microsoft.com/en-gb/dynamics365/business-central/production-how-to-create-routings)                                                                                                              | 已有版本、用量、替代料和工序；output_quantity计算是风险             | 保留发布与不可变历史；明确定额产出基准和工时          | 高级工程变更平台以真实变更量为前提  |
| 成本报价     | Odoo19 [制造订单成本](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/manufacturing/basic_setup/mo_costs.html)、[报价毛利](https://www.odoo.com/documentation/19.0/applications/sales/sales/sales_quotations/margin.html)                                         | 估算成本/制造成本/报价已有，实际全成本未闭环                        | 四层分别解释/对账；报价审批固定成本政策；复核预置定额 | 不直接复刻完整总账成本模块          |
| 信用合同订单 | [ERPNext信用](https://docs.frappe.io/erpnext/credit-limit)、[BC审批](https://learn.microsoft.com/en-us/dynamics365/business-central/across-how-use-approval-workflows)                                                                                                                   | ADR0010精确报价/信用/合同签署钉住可靠                               | 保留分权和敞口；异常理由、审批责任和到期反馈          | 不将所有拒绝都变可随意越过的软提示  |
| 采购库存     | [ERPNext生产计划](https://docs.frappe.io/erpnext/production-plan)、[BC批次跟踪](https://learn.microsoft.com/en-us/dynamics365/business-central/inventory-how-work-item-tracking)                                                                                                         | 采购收货/批次台账存在，多次部分收货有缺陷                           | 收货/检验/入库分清，数量和台账同事务，批次可追溯      | 供应商门户、复杂多级寄售先延后      |
| MRP报工      | SAP B1 10 [MRP](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/5a6957d864b3458ea5b48aa0b8249e54.html)、[生产](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/44f29313df7365fbe10000000a1553f7.html)                            | 需求/建议/工单/领报工已有，订单来源与用量需核                       | 保留人工建议转单、解释、冻结窗口；单据/数量关联       | APS、OEE、PLC/IoT不阻塞首轮生产闭环 |
| 质量批卷     | Odoo19 [质量控制点](https://www.odoo.com/documentation/19.0/applications/inventory_and_mrp/quality/quality_management/quality_control_points.html)、SAP B1 [批次管理](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/1b459988eda642ea93b4d137891697ad.html) | 检验/隔离/卷号存在；上下游正反追溯未全验                            | 按工序触发检验；隔离禁止可用、处置独立授权            | 全量LIMS和设备实验室接口暂缓        |
| 发运物流     | [ERPNext销售订单](https://docs.frappe.io/erpnext/sales-order)区分订单和交货                                                                                                                                                                                                              | 门禁物流/POD有实现，出库与数量闭环不足                              | 订单行→批卷→出库→装运→POD关系与累计约束               | 报关/承运商平台保留外部权威         |
| 应收利润     | [ERPNext核销](https://docs.frappe.io/erpnext/payment-reconciliation)、[会计分录](https://docs.frappe.io/erpnext/accounting-entries)                                                                                                                                                      | 不可变余额投影可保留；经营利润不能用报价毛利替代                    | 同币种核销、未分配收款、调账新证据、差异解释          | 法定财税和跨币种核销不得无口径先做  |
| 岗位单据     | [BC审批工作流](https://learn.microsoft.com/en-us/dynamics365/business-central/across-how-use-approval-workflows)                                                                                                                                                                         | 已有工作台和表单，待办为DOM启发式                                   | 对齐责任人/期限/可执行动作与上下游导航                | 不照搬竞品全部菜单和角色            |
| 权限审计运维 | [BC审计](https://learn.microsoft.com/en-us/dynamics365/business-central/dev-itpro/security/security-auditing)、SAP B1 [授权日志](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/4506daaed8696c30e10000000a114a6b.html)                                      | default-deny、SQL范围、audit/outbox在位；显式锚点缺列与恢复证据需补 | 保留不变量，实测角色/组织/字段；备份恢复与发布分离    | 不仅以测试数或首页可访问放行        |

## 金蝶和用友

[金蝶云星空官方制造方案文章](https://www.kingdee.com/article/2001510838371999746.html)可参考 MRP 到采购、缺料和批次追溯；[用友 U9 cloud 官方行业方案](https://u9cloud.yonyou.com/news/detailes/news/297)可参考标准/实际/工序成本和批次链。二者属于供应商公开方案描述，证据强度低于具体版本操作手册；不据此宣称某企业许可已包含这些能力。企业现用金蝶、用友或其他会计软件及版本、维护商、接口条件尚待确认。

## 草坪行业适配

按产品版本固定草高mm、Dtex、针距、行距、针数/密度、丝型、颜色、底布、背胶、幅宽m、卷长m、单位面积重量及公差。`0036`、`0066` 证明部分结构/预置存在，不能证明企业定额已签署。BOM必须说明“用量对应多少产出、基准单位、损耗如何计”；面积=宽×长可确定，面积与重量要依产品版本/批次实测，禁止全局固定比率。[BC单位设置](https://learn.microsoft.com/en-us/dynamics365/business-central/inventory-how-setup-units-of-measure)和 [SAP B1单位组](https://help.sap.com/docs/SAP_BUSINESS_ONE/68a2e87fb29941b5bf959a184d9c6727/641a2505ffb142f6bc4de5a800b6b119.html)提供基础单位及交易换算参照，具体草坪精度仍由业务确认。

## 验收标准参照

[OWASP ASVS 5.0.0](https://asvs.owasp.org/)用于会话、授权、输入输出、文件、审计等验证条目选择；不声称已获认证。[NIST SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)用于安全开发与依赖、变更、漏洞处置过程；[WCAG2.2推荐版](https://www.w3.org/TR/2024/REC-WCAG22-20241212/)用于关键岗位路径的键盘、焦点、标签、反馈、对比度与目标尺寸检查。采用标准前要形成适用条款清单及证据映射，不以笼统“符合标准”替代验收。

## 同日再次核验的资料强度补充

再次研究取得[金蝶K3 Cloud官方工程数据操作手册 物料清单](https://open.kingdee.com/k3cloud/help/ENG_BOM.html)正文。该页明确子项与父项的数量比、子项BOM版本、单位、固定/变动损耗与不同用量类型，可作为BOM基准、版本和单位建模的技术参照；网页未标明确发布日期/安装补丁版，适用范围限该K3 Cloud手册，不据此保证企业所购云星空版本一致。对KingTurf的对应建议是明确产出基数并按固定版本展开，不能机械照搬它的用量类型全集。

本次重新读取ERPNext滚动BOM与Business Central批次手册成功；Odoo19制造成本的官方搜索正文可读取、直接页面抓取超时，保留19.0的版本限定。金蝶原宣传文章直接抓取超时，已由上述技术手册加强核心BOM论证。用友官方案例/行业方案可定位，但在官方域搜索公开生产/领退料操作手册未取得可验证的技术规范；仅保留为流程线索，不用它证明事务、精度、API或具体许可功能。用友具体版本、接口合同和操作约束须在实际集成前依据企业已授权文档核实；不能用营销材料填平这个缺口。

资料获取状态见evidence/reconfirmation.json；本段为同日补充，不把抓取失败冒充产品没有该功能。

# 决策卡 D3：记录范围锚点（SEC006 / 新SEC008）

状态：待人类决定；现只制卡，不修SQL/权限。[真实PG及新债务](../evidence/harness-final-decision-pg-evidence-2026-10-20.md)。

现状：relationshipOnly引用osr.tenant_id/osr.scope，但迁移0001/0004闭包表只有ancestor_id/descendant_id/depth。COMPANY空anchor正控可读；匹配TEAM anchor在complaint list/get与dashboard真实42703，COMPANY+TEAM仍错（TRUE OR也要解析列）。这是新SEC008/P1可用性，不是已证权限扩大；旧SEC006/P2弱语义问题仍待决。

静态范围：该选项生产配置仅complaint与dashboard；complaint八处scope消费者（list/get/create/verifyCapa及四Current），dashboard一份secured.sql用于五个visible CTE。本轮仅list/get/dashboard真实PG实跑，其余是静态影响。触发是组织ID非空且anchor.scope在scopes集合中，不仅TEAM。未运行生产/真实HTTP身份，不宣称生产事故。

选项：

1. 独立授权统一organizationJoin，补组织有效性/归属/类型与TEAM深度，修复真实schema可执行性；也会收紧旧006理论接受域，必须按行为变更验收，不能叫纯提取。
2. 先另设计真实schema可执行的保守relationship兼容形态，单独约定缺列语义替代，再决定是否统一强形态；可能保留弱语义债，不能用不存在的列声称已安全等价。
3. 暂维持现状，明确匹配锚点查询失败风险与P1排期/终验豁免决定；不关闭008或宣称无影响。

建议选1，优先独立安全兼容批次，在后续生产发布前完成；是否作为终验阻断、实施日期与负责人由人类决定，现不预填已排期。所需授权：两域范围与强语义合同、旧SQL形状期望适配、真实组织/租户/锚点负例与认证路径核验、完整CI。当前产品/G3不改。

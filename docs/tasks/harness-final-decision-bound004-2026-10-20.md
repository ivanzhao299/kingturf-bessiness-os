# 决策卡 D2：批次 UUID 逻辑身份（BOUND004）

状态：待人类决定；不实施规范化或去重。[影响实测](../evidence/harness-final-decision-pg-evidence-2026-10-20.md)。

现状：uuid helper忽略大小写但保原字符串，batch Set按字符串去重。真实应用dispatch＋PG（合成授权）同一UUID大小写两行被接受，第一条成功、第二条版本conflict，状态TRIAGED/sequence2、投诉事件2含初始1；exact replay结果不变，投诉event/所查audit与batch不增加。反转同key顺序409，全大写重复400。派生事件key含原小写，requestHash含原大小写与顺序；未计数所有outbox，不称整事件流绝无写。来源：`complaint-batch-triage.ts:37–53`、`complaint-repositories.ts:1017–1128`。

影响：当前是有意分项提交的批处理，不应把本例部分成功称数据损坏。规范化会改变重复接受域、派生幂等key及canonical/replay；旧已存混合大小写请求再次请求应如何返回，必须单独约定。

选项：

1. 对新批次按UUID逻辑身份拒绝重复，但有效单行仍保原字符串；另明确旧已存批次按原canonical重放的兼容通道，不能简单在旧replay前新增400而不说明。
2. 全局统一UUID小写后处理，配新canonical版本/命名空间或迁移兼容；影响面大于单一批次，不能借此顺改所有helper。
3. 维持现有部分成功与大小写敏感key合同，记录风险和客户端限制，债务不关闭。

建议选1，以batch边界为最小范围，先提交旧重放兼容方案再编码。所需授权：重复拒绝与错误码、旧批次重放策略、明确文件与冻结断言适配、真实PG事件/审计/幂等回归。现无实现授权，BOUND004开放。

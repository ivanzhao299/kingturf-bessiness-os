# 阶段5 P1 最小逐路由适配 R7

## 原始人类许可

主执行者亲读协调会话01a12db5-380f-79c2-9329-8bcc500a27c8的人类回复消息01a148fc-8c9c-7392-b0e1-54a6e25ab28c，非仅凭代理转述。questionItemId为 `["request_user_input_async","call_f9cc886e017b44faadc7ee055b90d8d5",0]`，答复：“批准最小逐路由适配（推荐）”。

原问题完整范围：“P1 考古已找到主线产品提交 d4e9dbd 及其设计文档，明确规定‘每个菜单只打开一个主要任务页’。是否批准按已形成的逐例提案适配 P1 测试：登录后真实进入商机页，11 例分别访问对应业务路由，移动端由‘13 个工作台同时可见’改为逐页验证？所有原金额、数量、状态、事件、表单参数和种子保持，逐处登记并做真实变异，不改产品或用 CSS/DOM 伪造可见。证据与逐例映射：docs/evidence/harness-stage5-browser-rulings-2026-10-17.md。需要本次裁定，是因为计划 §7 明确要求先提交考古证据，再申请非会话期待适配授权。”

## 已交证据与精确范围

[已版本化考古与11例映射](../evidence/harness-stage5-browser-rulings-2026-10-17.md)在b1eab97，主线产品意图d4e9dbd早于S4，原a4ee6aa P1未同步；用户批准的是该映射的最小逐页适配，不是允许删除后续业务失败。

- 既授自然DOM登录后，通过真实菜单进入opportunities，保原商机heading断言。
- 11例分别按证据表访问真实业务菜单/等可见就绪，再执行原业务断言；订单/应收/付款改依次访问，截图在各自当前页拍、名字和业务内容不变。
- mobile保390×844，原13类逐页可见，原JSON请求textarea数量0保留，回订单页拍原截图。
- 全部原金额/数量/状态/事件/参数/seed保持；不更改产品/导航源码、DOM/CSS或使用force/evaluate造可见。
- 原11标题/用例不删改，不跳过/加retry/改timeout；Cookie与每文件真实变异红→还原绿义务保持。
- P1依旧按dc32ffa最小产物例外：仅CLI traceoff、原两config不改、readonly容器/owned tmpfs、raw不导出；首版零PNG导出，不宣称视觉验收。TD018不放宽。

## 接手与顺序

授权记录父ac7082a（Workspace字段最小修正）。该稳定干净HEAD完整ci:local实际0/209428ms，HEAD unchanged/clean均true，日志 `/tmp/kingturf-stage5-workspace-ac7082a-ci-2026-10-17.log`；Workspace原4例/字段及旧恢复DTO真红绿已完成，独立只读review无必要阻断。不是线D最终状态三连跑。

本R7独立docs提交后再改P1；逐处映射/静态业务断言守恒/实际正常及真实变异各记录，不预写绿。新的业务数值/数据语义失败仍走C7，不借此授权放宽。成本未证明信息保留、A/B未全绿前不第二轮，C生产仍禁，其它阶段5独立线继续。

回滚：本R7 docs可单独revert须核后继依赖；P1测试后继独立提交/回滚，不回滚已验收产品。

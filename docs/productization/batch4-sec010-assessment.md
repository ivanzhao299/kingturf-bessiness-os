# TD-SEC-010：当前授权前幂等重放核查

状态：**本地隔离PG与真实HTTP已复现，P1建议，正式修复未实施**。Batch4批准的是复现/安全影响核查；不把现状刻画测试通过当成安全修复或岗位验收。运行底层仓储与f3基线相同；路由正在进行行为保持拆分，最终固定候选另完整回归。

## 三条路径与实证

| 路径                                                                | 新键/当前读取                                 | 已知旧键现状                                                                                                            | 可利用前置与可见信息                                                                                                                |
| ------------------------------------------------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| commission.accrue；POST /api/v1/commissions/accrue                  | 同公司另一员工仅SELF，当前佣金列表空，新键404 | 201返回原佣金的id、sales_order_id、commission_amount等；返回snake_case旧持久对象，与初次camelCase响应还存在历史合同差异 | 需当前accrue能力、字段可读权限及同公司旧key；不是无身份读取。未证明可以猜中随机key                                                  |
| commission.transition；POST /api/v1/commissions/:id/pay             | SELF对不存在/不可见case，新键404              | 旧事件key可返回原PAID证据和金额，甚至路径使用另一随机case ID                                                            | 当前pay能力仍必须有，key按tenant查询而未绑定当前path/主体；旧响应evidence不含首次响应额外ledgerEntryId，不擅改合同                  |
| businessDocument.dispatch；POST /api/v1/business-documents/:id/send | 非创建者SELF，GET404；新key409                | 完整相同已知发送输入+旧key返回202原收据                                                                                 | hash包括document ID、版本和完整发送输入；未知body或更改subject仍409。因此新增泄漏主要是queue ID、状态、时点，不声称任意单据内容可读 |

三项均有真实不透明token登录、当前角色/DataScope、独立公司、当前权限撤销对照：跨公司请求拒绝、撤销对应操作能力后403，未返回受保护数据。业务记录、佣金流水、发送队列、audit/outbox计数对比无额外写入。EMAIL adapter只写合成队列，未发送邮件、未访问外部提供商。

## 根因与最小整改候选

commission-repositories.ts的accrue/transition以tenant+key返回旧对象早于当前订单/客户范围校验；business-document-repositories.ts的dispatch在验证相同input hash后，早于当前creator/公司范围查询返回旧收据。均不是前端隐藏问题。

候选修复需独立行为提交：每次返回旧结果前，先验证当前操作能力与原业务对象的当前合法范围，并单独落实读取/字段权限；事件重放核对原主体与路径，不能通过新path取得旧case。合法重放保留既有结果、无新增审计成功/业务副作用。单据发送的历史收据不应因原文档后来已发送/版本变化而要求重新APPROVED或重新发送；必须区分当前读取授权与首次发送资格。

兼容问题需明确：不同path复用事件key应拒绝何种错误；初次/重放的camelCase/snake_case差异是否只保留还是另修。修复不得删除缓存、扩大SELF或跨公司范围，不得自动重发单据。回退优先前滚；已确认越权通道不能作为可接受生产回退。

与旧问题的关系：TD-RISK-002/003和SEC009处理风险评价/任务与读取授权，本问题是佣金和单据的同类独立路径；Batch1–3成果不重复施工，也不把旧技术去重债关闭当成授权已安全。

## 可复核测试与失败记录

- commission-postgres.integration.test.ts两项TD-SEC-010现状刻画；foundation-postgres.integration.test.ts一项；新sec010-http-postgres.integration.test.ts三项真实HTTP。
- ownedCommercialGraph/ownedHttpApi使用随机schema、回环测试库与随机本地API端口；合成登录凭据留在闭包，不作为夹具输出。子进程、附件临时目录和schema都有关闭逻辑。
- 早期HTTP首例误把初次camelCase响应断言为sales_order_id，真实失败后按原合同纠正设置；旧响应仍检查snake_case并与独立金额对账。未修改业务代码。
- foundation整文件运行暴露已有connector更新路径问题：configureConnector的INSERT SELECT WHERE expectedVersion=0使已存在connector、expectedVersion>0时没有输入行，未执行ON CONFLICT更新。新安全场景改为复用既有READY合成connector，缺失时才首次配置；安全拒绝/泄漏断言均保留。更新缺陷另登记TD-CONN-001，不在本批顺手修。
- 私有原始日志与最终候选回执另见Batch4验证材料；早期运行处于开发中，不充固定最终SHA验收。独立源码/证据复核与独立复跑分别记录。

## 后续验收要求

取得本地修复范围批准后：原泄漏转为拒绝；同用户与当前有权异人合法重放保持合同；撤权、范围收窄、组织变化、原对象转移/失效、跨公司、path/key冲突、嵌套字段、并发重放与失败无副作用均做PG+HTTP矩阵。与风险三项组合回归，最终同SHA CI及受影响浏览器验收另跑。

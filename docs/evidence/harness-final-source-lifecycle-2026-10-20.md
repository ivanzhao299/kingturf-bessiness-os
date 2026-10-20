# Source owned 生命周期：实施与真实验证

授权先行c65c67f/[直接人裁R7](../tasks/harness-final-source-lifecycle-authorization-2026-10-20.md)，基于b907ac7已验检查点恢复[封存候选](../tasks/harness-final-source-proposal-2026-10-20.md)并修订，不将旧候选当新验证。MRP五期待实现34e5453与本线分开，原19测试正文/业务样本/权限/响应、Source spec、产品SQL/源码、两配置/网络不改。

## 实施合同

- host在既有guarded admin/同实例上，一事务创建随机authz_http schema及私有marker表/行；仅通过私有stdin传精确控制三元组，不输出schema/marker/连接。无目录差集或前缀猜删。
- 原API测试三项owned环境参数全有且有效或全无；owned分支只读比对同实例/marker，不注册DROP；默认分支原CREATE/DROP及迁移schema-only→API schema,public保持。19个it完整call文本SHA256固定`de059920e9bee2c63dfa158f9577ffbbf6d80d4760ad9f8caa8cf4f0e06dc645`，原样本均在固定正文中。
- ready只表示beforeAll图初始化已结束，在owned RAM原子rename发布；不等19/19。工具必须观察真实19/19、精确九根/会话结构/有界/无认证字段的RAM fixture与ownership复核，才允原UI3启动。字段校验不宣称任意字符串内容脱敏，原始内容永不导出。
- host先确认精确container移除/自有进程停止，再同实例、marker匹配并锁表，精确DROP和参数查询不存在；Source与runtime清理独立尝试，一方失败不跳另一方。无法确认停止/marker/实例时保留并报错，不报gone。
- 新source-cancel/source-kill/source-failure只限Source，ready之后分别触发可处理取消/精确container KILL/producer组KILL。只导固定阶段/布尔/计数，不改两config、trace或网络失败条件。保证不覆盖host自身SIGKILL、掉电或底层DB失联；这类情况不能承诺finally必达，须保留资源并另行核查。

## 已执行与未执行

最终工具正例`final-source-owned-positive-2`：f2d0b11后原19真实producer exit0/null/8190ms、fixtureValidated/ownershipVerified均true/stage complete，随后原UI3 discovered3/complete=true/三passed（720/1006/737ms），PW0/null/11737ms；preflight0/19021ms，host0/null/19599ms。安全日志`/tmp/kingturf-final-source-owned-positive-2-2026-10-20.log`，无relay，source-owned-cleanup精确marker/schema/container与runtime/preview清理全true。独立只读核验五份安全日志/公开源码无必要证据/隐私阻断，未代主执行者测试。只认本次19+3完整正例，初次失败和三故障不充正例，也不充A8/B2完整轮。

后继真实实测（58c3ece，严格串行，日志均`/tmp/kingturf-<label>-2026-10-20.log`）：

| label / fault                           | host真实exit/signal/耗时 | 实际证据与边界                                                                                                                        |
| --------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| final-source-owned-positive-1           | 1/null/16254ms           | 生产器真实19/19、ownership true；fixtureValidated false/stage fixture-auth-fields，UI未启动；精确Source marker匹配回收与外层owned全清 |
| final-source-cancel-1 / source-cancel   | 1/null/13600ms           | beforeAll ready后host可处理SIGTERM取消，producer143/未通过；Source marker匹配/schemaGone/containerGone及runtime/preview全清，无UI     |
| final-source-kill-1 / source-kill       | 1/null/13312ms           | beforeAll ready后精确owned container KILL，未依赖child afterAll；Source marker匹配/schemaGone/containerGone及外层全清，无UI           |
| final-source-failure-1 / source-failure | 1/null/13420ms           | beforeAll ready后producer组SIGKILL，producer null/SIGKILL/未通过；Source marker匹配/schemaGone/containerGone及外层全清，无UI          |

三负例均是真实PG/进程故障后回收，不是工具模拟或正常afterAll保证；没有relay事件，也未把ready当19完成。清理保证仅在host可执行finally且DB可达时，不能扩成host自身强杀/掉电绝对保证。

首正例失败的静态根因已独立只读确认：原公开`released-order-http.ts:52`固定合成业务规格`specification.secret`由Order360 `to_jsonb(tsr)`返回到唯一`authorized.technical.specification.secret`，值固定`SENSITIVE-TECHNICAL`；不是认证secret。quote快照只含revision/lines/approvals，无该规格副本。新工具笼统按键拒绝导致误报，不是产品、原样本或权限失败。仅修新工具：完整唯一路径+公开固定值且恰1次绑定，其它所有secret路径/值及token/CSRF/password/cookie/authorization/generation仍拒绝；原fixture/19正文/UI断言/网络不改。补wrong-value/missing/denied/masked/quote-copy负例，定向10工具实际0及lint0；完整31工具与后继19+3正例另实跑，不预填通过。旧30/首次正例失败保留为当时结果。

30个工具单测实际0（旧21＋Source结构4/owner5），strict lint与API typecheck0。包含参数/坏marker/异实例拒绝、原19 AST正文hash、故障入口仅Source、私有输出重编码；纯工具模拟不是PG取消证明。独立只读实现审无必要静态阻断，未代主执行者测试/访问DB。

本提交时真实Source正例、三故障、默认API19完整验证尚未执行；不得预写19+3绿或精确取消清理已证。后继命令、exit/耗时/owned状态逐项追加，失败史不删除；最后干净HEAD全CI与最新同状态两完整轮仍须实际完成。原产品/SQL与Source spec/两config/workflow对基线零diff已核，C2不跑/不§14。

回滚原测试生命周期、host owner/fixture/preflight、Source prep/private入口及测试命令需成组，避免producer失去owner却仍跳DROP；MRP五期待不属于该组。文档/历史补丁不删除失败或直接人裁来源，未push/部署/生产。

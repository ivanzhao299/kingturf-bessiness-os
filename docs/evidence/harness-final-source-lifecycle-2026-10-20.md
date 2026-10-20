# Source owned 生命周期：实施与真实验证

授权先行c65c67f/[直接人裁R7](../tasks/harness-final-source-lifecycle-authorization-2026-10-20.md)，基于b907ac7已验检查点恢复[封存候选](../tasks/harness-final-source-proposal-2026-10-20.md)并修订，不将旧候选当新验证。MRP五期待实现34e5453与本线分开，原19测试正文/业务样本/权限/响应、Source spec、产品SQL/源码、两配置/网络不改。

## 实施合同

- host在既有guarded admin/同实例上，一事务创建随机authz_http schema及私有marker表/行；仅通过私有stdin传精确控制三元组，不输出schema/marker/连接。无目录差集或前缀猜删。
- 原API测试三项owned环境参数全有且有效或全无；owned分支只读比对同实例/marker，不注册DROP；默认分支原CREATE/DROP及迁移schema-only→API schema,public保持。19个it完整call文本SHA256固定`de059920e9bee2c63dfa158f9577ffbbf6d80d4760ad9f8caa8cf4f0e06dc645`，原样本均在固定正文中。
- ready只表示beforeAll图初始化已结束，在owned RAM原子rename发布；不等19/19。工具必须观察真实19/19、精确九根/会话结构/有界/无认证字段的RAM fixture与ownership复核，才允原UI3启动。字段校验不宣称任意字符串内容脱敏，原始内容永不导出。
- host先确认精确container移除/自有进程停止，再同实例、marker匹配并锁表，精确DROP和参数查询不存在；Source与runtime清理独立尝试，一方失败不跳另一方。无法确认停止/marker/实例时保留并报错，不报gone。
- 新source-cancel/source-kill/source-failure只限Source，ready之后分别触发可处理取消/精确container KILL/producer组KILL。只导固定阶段/布尔/计数，不改两config、trace或网络失败条件。保证不覆盖host自身SIGKILL、掉电或底层DB失联；这类情况不能承诺finally必达，须保留资源并另行核查。

## 已执行与未执行

30个工具单测实际0（旧21＋Source结构4/owner5），strict lint与API typecheck0。包含参数/坏marker/异实例拒绝、原19 AST正文hash、故障入口仅Source、私有输出重编码；纯工具模拟不是PG取消证明。独立只读实现审无必要静态阻断，未代主执行者测试/访问DB。

本提交时真实Source正例、三故障、默认API19完整验证尚未执行；不得预写19+3绿或精确取消清理已证。后继命令、exit/耗时/owned状态逐项追加，失败史不删除；最后干净HEAD全CI与最新同状态两完整轮仍须实际完成。原产品/SQL与Source spec/两config/workflow对基线零diff已核，C2不跑/不§14。

回滚原测试生命周期、host owner/fixture/preflight、Source prep/private入口及测试命令需成组，避免producer失去owner却仍跳DROP；MRP五期待不属于该组。文档/历史补丁不删除失败或直接人裁来源，未push/部署/生产。

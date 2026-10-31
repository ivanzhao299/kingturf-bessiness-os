# ADR-0012 惰性路由尝试与同步结果投影

日期：2026-10-26。状态：Batch4本地行为保持实施；负责人已批准剩余G5治理，不涉及业务口径、技术栈或生产授权。

## 问题与方案取舍

f3的buildApp3622行、内部dispatch3553行仍依赖精确有限豁免。当前选择/权限/解析/仓储/DTO和错误收尾混在入口。直接整域async helper会在无匹配路径引入await；首个匹配Promise返回null后直接跳到下一域会丢失本域续走。QTC对部分无关POST的eager body解析是现有合同，不能移动至仅匹配后执行。

选择：沿原顺序调用同步、惰性的route-attempt iterator。每个attempt保存原始Promise、同步结果投影和接受规则。根是唯一等待者，执行project(await pending)，不使用for-await、async generator、then链或Promise.resolve包装。无匹配同步完成，不构造Promise；结果null继续同一iterator。原无条件dispatch/await仍无条件产出，不按新路径前筛。

已有声明式路由直接保存原dispatchRoutes Promise，投影为恒等函数；遗留单await分支保持所有前置校验和Promise操作数在iterator原位求值，仅将原await后的同步DTO/return移入typed projector。三种接受规则分别保留原!==null、truthy和无条件return。原同步throw、Promise拒绝、投影throw均到同一根catch；不把局部错误吞成null。

拒绝：整体技术栈迁移、通用yield结果回传/异常注入解释器，以及以一层async-null包装所有业务族。仅计行数不足以证明成功。iterator是选择和准备过程，不租用资源、不新增try/finally或清理副作用；根提前命中触发IteratorClose不会发生业务写入。未来确有“结果驱动第二个await”的分支须另设计，不扩成通用指令系统。

## 类型、依赖与验证

promise和projector通过泛型工厂一起构造；名义私有字段及冻结实例防手写/展开对象替换配对，异构输入使用项目既有RouteHandler同类的bivariant method模式，不使用any或as T。投影必须同步，不能提前缓存原本await后才读取的授权、依赖或业务字段。

ApiDependencies保持app.ts的机械溯源锚点，HTTP DTO类型可独立导出并由app保留旧type facade。业务路由→共享解析/类型→packages；没有运行时反向import app，不增加Service透传层或复制规则。server仍唯一组合根，仓储/事务边界不变。

固定f3完整源fixture及摘要，比较结构/类型/字面量、路由组逆展开、238条请求业务轨迹（依赖/仓储/授权/错误/logger/telemetry和结算微任务），保原QTC335合同、无匹配时序负例及相关所有既有测试。差分子进程固定时钟，生产时钟不改。扩大legacy场景及失败/配对/null接受测试；最后真实PG、结构/依赖门禁、干净固定提交完整CI和同配置P1两轮。结构源码审查与独立复跑分别记录。

## 回退与边界

每个业务族独立提交，按组代码回退并复跑保护。无新依赖、数据库迁移、业务状态、金额、库存过账、权限规则或会话变更；两个G5原期限不延。仅实际函数≤200且全结构门禁通过时移除相应精确项。临近到期后回退到原超长版本仍会被门禁拒绝，不能调时钟/续期规避。

## Batch4逐组实施补充

原同步返回使用directReply包装，根在await前立即返回；包装不冻结原响应。缺仓储的同步拒绝在generator中保留终止return，不能yield后继续执行。QTC POST的body和ctx在原位置建立，以同一引用传给分组，非匹配POST的解析行为仍保留。遗留18个await操作新增72条成功、同步throw、拒绝及结算后字段范围变化对照，原238条仍保留，共310条轨迹。

依赖门禁原只识别defineRoute对象与原app内条件分支。迁移后的`yield projectedReply(originalPromise,synchronousProjector)`是等价的单次路由执行单元：新增严格S5只接受真实context.ts工厂、同步generator直接yield、同步非generator投影；不接受提前数组/变量存储。S3仍将pending、投影、间接helper和共享前置工作合并计仓储，沿委托传播调用者工作，不能用generator类型整体豁免。新增真实CLI正反例，包括双仓投影、bind/call、跨文件、共享工作+委托/局部分支/手工消费、伪工厂及不合法async/eager形状。仓储来源规则和S3阈值不变；不声称覆盖任意高阶callback调用图。

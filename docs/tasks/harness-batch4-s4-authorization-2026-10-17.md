# 批次4 S4：正式实施授权引用（R7）

2026-10-17，主代理已只读亲核人类原始“正式授权S4实施”消息；六项已决裁定位于 `2e2283705aa30b30565c5a369b9777b5ab69f188` 的[计划§7](../exec-plans/active/harness-migration.md)末行“4-S1S3验收+S4选型”。该提交是本轮接手基线，harnessing、树空。S1–S3已经人工验收；S4影响报告 `420f9ba` 真实干净HEAD完整CI0/207904.734ms、仅文档，其[报告§9](harness-batch4-s4-session-impact-2026-10-17.md)的“待确认/仅报告硬停”是批准前历史，不再重开选型。

## 六项已决与许可范围

1. **B方案**：浏览器HttpOnly/Secure/SameSite=Lax opaque session Cookie＋session-bound签名双提交CSRF＋严格Origin。签名材料须会话派生，明确实现设计与行为表先于代码落盘；同session合法复用，不引一次性语义。
2. **机器兼容**：保留无会话Cookie的显式Bearer第二载体；独立受限token-login出口与主登录共用同一S2窗口/语义。同请求Cookie＋Bearer为401拒歧义，空/畸形/重复会话Cookie不得降级机器；不可信Origin/ambient Cookie不能借机器或独立HMAC例外绕过。
3. **体验**：接受同host跨tab单身份；旧sessionStorage一次清理、重登，不做旧token交换。前端实际入口是`apps/web/src/http.ts`，不存在`shared/http.ts`，按报告实际路径施工。
4. **竞态**：普通401不清Cookie；logout撤请求绑定session，改密保持原事务撤全部目标session。清理独立防迟到响应清掉新登录，允许保留无效Cookie字节；必须网络级证明，JS epoch不能代替。并发登录的已盘点风险须在同一设计中明确，不假称原single-flight/广播保证全网顺序。
5. **配置与本地验证**：Cookie名称/path/寿命、精确Origin集合经parseEnvironment及`.env.example`配置化；无固定值处采用明确安全默认与理由，不再询问已授常规实现选择。Secure不降、浏览器旗标不放松；本地真实HTTP/CDP预检先行，不通即回报另批HTTPS，不预先安装/授权本地HTTPS设施。
6. **必要耦合适配**：按影响报告§2–6逐处映射；TD-WEB-007/TD-PERF-003只允许同文件且与载体迁移耦合必要的代际适配，逐处登记旧→新与理由；否则不碰，不能据此结清其他债务。

## 不变量与验证纪律

opaque token本体、secret-bound SHA-256服务端存储、scrypt、原SQL/撤销事务与锁、website已解析body canonical及规范数值timestamp签名不变；不JWT、不新依赖、不SQL/scope-sql/G3扩白。多Set-Cookie必须端到端保留，不能逗号合并。SEC006/007、BOUND003/004、七N+1及非耦合旧债不并入。

新行为新增检查；获批旧载体行为消失才逐处改期望，登记“旧→新→六项裁定依据”；每个被适配文件至少一次真实变异红→还原绿，API mock与E2E/CDP分开计数，不输出认证/签名fixture值或补丁正文。CDP须真实Cookie登录→工作台→登出→重登及CSRF负例/网络级清理顺序；原Playwright未补跑边界与阶段5前补跑义务保持，不能以CDP抵销。

**九份旧本地Playwright测试安排已另获明确人类裁定**：“九份暂不改；适配、变异及补跑合并到阶段5前”。主代理只读核到原始人类回复，原消息ID `01a147b3-7265-7193-ae34-c4360b95f5f1`；该待决已解除，不重问。本轮九spec保持零diff，Cookie夹具适配＋各文件真实变异＋实际补跑一并作为阶段5前硬前置，未执行/未适配不得标绿，CDP不冲抵。两个production命名spec、runtime spec与两配置仍静态分类、无生产访问/未执行边界保持，不改runner、不借缓存Chromium、不sudo。API/Web/CDP本轮完整实施、每被适配文件真实变异红→还原绿的纪律不变。

## 本步与后续节奏

**本步只有独立R7引用及明确实现设计/行为表文档**；设计完成后交协调只读复核，停在后端编码前。这是已授权执行中的小步独立核验，不是再次请求人类许可。本R7提交仅作文档校验，不冒称已完成Cookie预检或实施。

[明确实现设计/行为表](harness-batch4-s4-design-2026-10-17.md)已落盘并经独立只读复核，补明MAC字段/缓存契约/隔离预检证明边界；仍只设计，未运行预检、未编码。最终文档HEAD完整CI结果执行后交付，不预填。

之后由协调直接续派已授权步骤：本地Secure真实HTTP/CDP预检→后端独立提交（API＋Web全量绿）→前端独立提交（API＋Web全量绿）→网络级清理/浏览器主链与负例→整批收口最终实际稳定干净HEAD完整`pnpm ci:local`真实0/树空。原执行线程是唯一写入/测试/构建/浏览器/PG操作者，PG仅串行guard回环测试库；协调与reviewer只读。

本轮不push/部署/dispatch/触生产或`.github/workflows/`，不自行进入阶段5。若出现报告盘点遗漏的新影响面/新竞态，按C7立即停止上报，不现场扩大。SEC001仅RO、强制仍待生产观察另批；SEC002/004按S1–S3验收与S4最终证据核账，SEC003必须真实完成后才关闭，安全评分与整批证据亦按实测更新，不预填。

R7与后续设计均独立docs提交，可核后继依赖后revert到2e22837，不退S1–S3、不自动执行回滚。本步最终文档HEAD须实际干净完整CI后交协调；运行日志/真实退出码/耗时在执行后交付，不假称批准基线2e22837自身跑过未记录的CI。

# 批次4 S1：统一API安全响应头（TD-SEC-004）

**批次4交验补记（2026-10-17）**：S1最终00ed10d实际全CI0/178476.659ms。本轮累积源码f114ee0038e8ef4568c1521b51efa606cb52da66稳定干净HEAD完整CI实际exit0/192524.18ms，首尾同HEAD/clean=true；API126/17242、Web14/313、config71、结构0/29、预算11991/1898、audit0，日志 `/tmp/kingturf-s4-network-final-head-ci-2026-10-17.log`。这是后继累积检查点，不冒称重跑本页每个旧HEAD。SEC002/004核账已验收范围实施完成、SEC003载体迁移实施项关闭，SEC001强制段开放；本次整体人工验收仍待交付，九旧PW延期硬前置不抵销。[唯一批次4交验包](security-batch4-acceptance-2026-10-17.md)汇总分层/适配/回滚/残余候选；下方“待CI/未实施/开放/硬停”为各自原时点，不回写历史。最终本次文档HEAD完整CI另实际执行后交协调。

状态：S1实施及独立只读复核完成，源码与响应期望后继检查点`59f9dfa`实际稳定干净HEAD完整`pnpm ci:local`真实0/180503.567ms，开始/结束HEAD相同且树空，无编辑/其它测试/构建并发。日志`/tmp/kingturf-batch4-s1-59f9dfa-head-ci-2026-10-17.log`。本独立完成证据提交后另跑实际干净HEAD完整CI，结果以`/tmp/kingturf-batch4-s1-final-head-ci-2026-10-17.log`为准，不预填；本步停协调独立确认/续派，**不是批次4人工验收**，不启动S2/S3/S4或阶段5。

## 授权、前后行为与实现

人工原始消息已只读核实。基线64757d4（批次1/2含E1/3已验收）→R7授权docs `bed8b40`→独立行为源码`b02ad55`→独立严格期望同步`59f9dfa`。见[R7范围](../tasks/harness-batch4-authorization-2026-10-17.md)。

| 范围             | 原行为                                                 | D1 S1新行为                                                                                                     |
| ---------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| buildApp应用响应 | API直连无安全三头，仅response头/关联ID                 | 每个经complete返回的响应统一加nosniff、SAMEORIGIN、strict-origin-when-cross-origin，与仓库host nginx24–26值一致 |
| 正常/错误/超大体 | 同一complete原状态、正文、关联ID、telemetry/logger顺序 | 原内容及顺序保持；新增三头适用于正常dispatch与rejectOversized，包括200/204/400/401/403/404/413/500/503          |
| 原严格响应期望   | 仅预期x-correlation-id                                 | 仅追加获批三固定头；保toEqual、状态、正文、权限、首错顺序、repository调用及请求/会话/签名夹具                   |

实现只有`apps/api/src/middleware/security-headers.ts`纯函数与app.ts的单一complete接线；先保留原response.headers，再固定三小写键，最后保原x-correlation-id覆盖。无依赖、无IO、每响应独立头对象。原响应body引用、status不变；server.ts两处writeHead均展开result.headers，JSON content-type设置未改。中间件split11/完整函数10/AST1；G1/G2/G3扫描包含该路径，无新增豁免/G3白名单，阈值800/200/5保持，函数200完整审计不冒称全仓已有AST强制。

## 真实验证与失败史

1. 新app12检查在旧实现运行真实12红/原39绿；首次新session用例误写/api/v1/session，冻结前改正确/api/v1/auth/session后再实际12红/39绿。两次日志`/tmp/kingturf-batch4-s1-old-headers-red{,2}-2026-10-17.log`保留，不将首次错误路径当有效正常session证明。新500 mock写法先后修类型和unbound-method lint，最后使用vi.spyOn，不放宽规则/不改实现迎合测试。
2. 接线后app51+helper3=54/2绿。新增15覆盖列出状态、缺依赖、内部500不泄露消息、413入口，以及其它头/输入不变、固定值优先、逐次独立对象。`/tmp/kingturf-batch4-s1-headers-green{,2}-2026-10-17.log`。原app39检查除新describe插入外字节同；app源码去唯一import/return接线后逐字同bed8b40，`/tmp/kingturf-batch4-s1-conservation-2026-10-17.log`真实0。
3. **b02ad55首次源码完整CI真实失败**：1/182202.688ms；API65失败文件/6994失败、53通过文件/10120通过，共118/17114；Web266绿。旧严格响应oracle拒绝新安全头。不是已绿源码提交，不回写/删除失败史；日志`/tmp/kingturf-batch4-s1-b02ad55-head-ci-2026-10-17.log`。
4. 按人工本批测试纪律独立test同步：65文件76处=74严格响应envelope+2直接headers，只加三头；另24同形请求头不动，文本72候选不是72修改文件。详见[逐文件旧→新→D1清单](security-batch4-s1-oracle-map-2026-10-17.md)。定向5文件120绿，`/tmp/kingturf-batch4-s1-oracle-targeted-green-2026-10-17.log`；逆去三字段后每个完整测试AST与固定b02ad55同，`scripts/analysis/security-header-oracle-check.mjs`只读核65/76、void完整遍历及三差异自检，日志`/tmp/kingturf-batch4-s1-oracle-conservation2-2026-10-17.log`。AST证明忽略格式/注释，不宣称所有fixture字节不变；语义节点/调用/请求输入未改。auth相关测试只改响应头期望，不是S4登录/会话夹具迁移。
5. **59f9dfa完整CI真实0**：API118/17114（原17099+15）、Web13/266，database68/domain14/config4/types1、原13 PG套件，工具/格式/能力39/19/结构0违规29豁免/type/lint/build/audit全链通过；启动gzip11794/1898与原workspace deferred保持。59f9dfa相对b02ad55的业务源码/apps/web/packages/infra/workflows零diff，因此是S1源码不变、获批期望同步后的绿色检查点，不声称失败的b02ad55自身变绿。

独立reviewer已核complete全返回路径、server两处写头与nginx值，以及76期望/脚本/逐处清单，无必要阻断；未替主代理运行测试或写文件。协调先发现旧oracle冲突后才按原授权同步，保留此决策与真实失败。

## 保障边界与后续风险

- “统一API响应”限定经buildApp.complete管理的响应，不是所有站点/传输异常保证。server URL构造/请求流异常在dispatch前，Node自身异常及Nginx自产301/ACME/502等不走此函数；不顺手改旧异常处理。413新增断言直调rejectOversized，实际写头两分支仅静态核验；原PG HTTP回归不冒称新网络级413头断言或生产头实测。
- host nginx已有同值add_header always，上游增加后代理可能出现重复头；未来路由若提供大小写不同的同名安全头，纯对象合并不保证大小写去重。当前app/routes未发现此producer，保持代码不扩大；风险登记TD-SEC004，上线另核数量和值，本步不部署、不改nginx去重。SAMEORIGIN不是DENY，政策值严格沿人工指定的现有nginx。
- 本步没有CDP/Playwright新运行；原9spec/config保持未补跑边界，阶段5前用户提供Linux Chrome或免交互权限后补跑。本步不访问生产、不真实登录/发送、不sudo、不改依赖、SQL、auth/Bearer/sessionStorage/Cookie/CSRF/Origin、nginx、packages/config、CSP或限流。无安全全矩阵/生产生效保证。
- SEC001/002尚未实施，SEC003仅待S4影响报告及人工确认；SEC006/007、BOUND003/004、七N+1修复不纳入，台账47保持。不push/部署/dispatch/.github/workflows，不启动阶段5。

## 回滚与停点

R7 bed8b40为独立docs，可独立revert。S1按后继依赖先核后逆序revert：严格期望59f9dfa与业务b02ad55须成对撤销；只退实现会使新oracle红，只退oracle会恢复本次6994红。授权基点64757d4；源码前基点bed8b40。本完成证据独立提交，可单独revert，无自动回滚执行。

本步交协调最终SHA/diff/日志/真实结果后停，待协调按已授顺序续派S2；不向人类重复索已授许可。S4即使影响简单也必须另停人类确认，不能以本步绿灯推定Cookie/CSRF授权实施。

# 前端3e①：商业store守恒拆分（2026-10-16，候选验证中）

输入3d源码041e771完整干净HEAD CI0/177598.590ms；完成docs b2e2a53另稳定干净实际HEAD完整CI真实0/176778.554ms（`/tmp/kingturf-3d-b2e2a53-head-ci-2026-10-16.log`），结束HEAD不变/树空。3d已独立协调确认，继续既有3a→3f授权，不重问。**本步仅守恒store职责迁位和撤已消解入口豁免，不是3e惰性加载/日期收敛完成，不结清TD-ARCH-002。** 后续lazy与日期各独立提交，3f后停整批人工验收。

## 先旧契约与边界

新增独立`commercial-store-contract.test.ts`六项在未迁位b2e2a53业务上首跑全部绿，连同原9文件114为10文件120（`/tmp/kingturf-3e-store-old-contracts-2026-10-16.log`），旧type首跑0。锁读取权限过滤/库存read优先/同步调用顺序与receiver，列表并发且全settled才批提交→dashboard后置，普通失败保旧而商机失败清空，explicit refresh无权限过滤/部分成功写Map后聚合报错与重试，order360不同ID独立及失败重试，submit仅exact机会自动reload/响应身份。原114/457不改。这是定向护栏，**不代表全43 readable对/全部权限分支、get receiver、所有写失败、upload/quote/transition全动态覆盖**；全部方法另完整源码逆展开守恒证明。

原commercial-loading三项继续锁cost latest-request/pendingquery合并/旧失败不覆盖、新查询不被慢refresh回灌，以及order360同ID仅在途合并/完成后再GET；不复制成新的“已覆盖数量”。原route-isolation没有旧会话成功晚挂载防覆写保证，不冒称已有；旧entry/mount行为本步不修。纯迁位不新增请求、读取权限、重试策略、幂等/缓存规则或字段收紧。

R4仅登记TD-WEB-006/007，台账42→44、旧42字节原样。前者是商业route可见但controller创建/个别panel门控差异，非合同三族前缀TD-WEB-004；后者是旧顶层挂载缺会话代际复核。主代理与独立只读核验确认静态链条，实际触发/生产影响待核实，无真实账号/跨会话复现实验，不推论数据泄露。两项本步不修，新lazy自身任务绑定shell/销毁隔离不算已修旧顶层mount。TD-PERF-003及SEC/D1等保护区不扩。

## 实际候选与全类守恒

5新runtime位于`commercial/store/`：controller保原字段/构造及全部方法与统一状态，cost-query保原默认查询声明，readable-sources在原调用点创建43对（库存动态permission条件仍调用时读），load-opportunities与load-views只同步启动原Promise链，**均非async，不新增await/微任务**。顺序仍failures数组→readable→filter→opportunityTask→viewTask→原await Promise.all→dashboard Date/query/await→message→finally。API/controller receiver、同Map/数组/查询引用、所有成本计数/在途Map/写后reload语义不变，root直接import/re-export同class而非wrapper。

完整原279行class三helper展开（controller→同this）后所有成员/字段初始化/构造/方法/await AST全等；默认query完整声明、root剩余业务AST及顺序/import、四实际运行边/无反向root、70公开名称种类/457完整expect链及原其它八test文件字节相等。首证明即0，最终日志`/tmp/kingturf-3e-store-inverse-final-2026-10-16.log`。新文件最大215/完整函数50/AST5，root997→704、最长完整函数160/AST3/格式最大5。不是把279行类当完整函数或用callback reset绕门禁；store职责第一步仍有统一facade，真正按域加载尚待后续实现。

首type exit2仅为root迁出后unused类型、固定43项tuple不能作为过滤后数组类型；删除真unused/保re-export，参数改为tuple元素readonly数组后type/lint0。原未适配120首跑即全绿（`/tmp/kingturf-3e-store-web-unadapted-2026-10-16.log`），不虚构旧读源失败；向原turf真实集合补五唯一非空实现锚，457断言不动，适配后120绿。5runtime实际改坏权限键/默认attention/实际path，各真实exit1→恢复120 exit0，日志`/tmp/kingturf-3e-commercial-store-<模块>-read-source-{red,restored}-2026-10-16.log`，全部已恢复。独立frontier实际候选五模块审无必要修正，确认全部30成员顺序/其余方法AST与三helper整表达式守恒；独立登记/撤豁免精度审无必要修正，未由只读代理运行测试构建。

## 入口旧豁免撤销

入口已实际704/160/AST3/格式5才删除SIZE_WHITELIST唯一bootstrap项；不扩大isNewWebModule AST范围、不改原G2算法/G3/G4/D5/其它旧29。新增真实CLI临时隔离bootstrap样本拒801行/格式6、放800行，原门禁自测唯一旧软计数31→29依据root G1/G2消解校正，原web114/457不动。撤前红灯真实exit1：新801样本被旧白名单放行，另旧31预期因当前root已无G2而实际30失败；撤后首跑仍exit1：新测试文案regex写“超过上限5”但实际为“嵌套超过5”，另旧31预期应29。只修新增regex并精确校正现时软计数（不放宽阈值/删除判定），39项最终全绿（`/tmp/kingturf-3e-bootstrap-exemption-{red,green1,green2}-2026-10-16.log`）。所有临时自测目录在finally清理，无修改真实root来造样本。

## 后续3e惰性加载约束（尚未实施）

独立21视图盘点确认不能仅按同名列表请求：报价依赖CTR/solution/cost/policy/quote；订单门禁quote/credit/contract/order；资金队列AR/bank/cases/legalhandoffs；采购/MRP/生产依赖物料、工艺/库存，质量含complaint/SLA及CRM引用。CRM customers/employees仍首次并行完成后原数组ref赋值，commercial.load不重读CRM。权限先与旧read过滤交集，保TD-WEB-004/006与riskPolicyControls原order360创建/跨风险消费关系。

公开load()仍保全权限加载；refreshViews(paths)仍不按权限过滤，写流程自己load/refresh的范围不缩成当前域。新route加载需另覆盖初始hash/点击/hash返回、A→B晚完成、旧shell销毁/会话任务边界、失败重试、访问过视图写后刷新与未加载≠空；不永久缓存首次访问，定义新route freshness并保原UI断言，合法请求数差异另表。Overview/readiness与独立文档模板读取有跨域请求，不称所有网络都只有当前route。日期需全runtime真正收敛，根文件grep0不是TD-DUP-004结清。

负向失败数为controller3/117、cost-query2/118、readable-sources3/117、load-opportunities10/110、load-views3/117，全部恢复120pass，不称五项都只有一条断言失败。

最终format/type/lint/完整证明/结构/能力/build串行set-e真实0，结构0硬29旧软/能力39-19不变。metrics TS338/56598→343/56625，测试146/65868→147/66069（新六契约186 split／wc185，实际读源集合增加15行），root缩进≥4层104→5、≥7层4→0/最大7→5，API4129/buildApp3598不变。构建bootstrap-CLD6nzOp.js/index-BnTys0G0.js，登录gzip JS11368/CSS1898、workspace deferred；日志`/tmp/kingturf-3e-store-{metrics-new,build}-2026-10-16.log`。

旧浏览器复用3d实际poWKfN41/N2w16R37/tZKvtB33/EQMpRR29，041e771→b2e2a53业务与工具零diff（`/tmp/kingturf-3e-store-old-baseline-same-2026-10-16.log`）后才复用，不冒称新跑；本步新跑扩展41及独立原fixture29，正常37/33仅作为旧基线复用，不冒称本步重跑，以完整类逆证明+120定向与默认29守恒互补额外治理夹具41。

新b1kQOW41首跑真实exit0（`/tmp/kingturf-3e-store-new-cdp41-2026-10-16.log`），DOM150/viewport53/route80/text180/overflow68，与旧41全部请求计数相同（各list/session6、cost7/detail2/orderEvidence2/docDetail4/15docList各6、20治理GET除employees12外各6）。独立原fixture lZDGjb29首跑真实exit0（`/tmp/kingturf-3e-store-normal-cdp29-2026-10-16.log`），DOM80/viewport47/route69/text142/overflow56，各list/session5、cost6/detail2/orderEvidence2，与旧29相同。两组网络三零、preview3543765/3543913退出/root/profile清理全真。未改任何CDP工具/defaultfixture/driver/断言，未失败重试本步浏览器。

源码及完成docs实际干净HEAD全CI仍待跑。原Playwright9spec/config冻结未运行，阶段5前补跑；不push/部署/生产/改后端SQL依赖工作流评分。回滚为本组5模块/root/读源与root豁免撤销配套恢复，不能只回root而留撤豁免造成旧巨石硬失败；六新契约/两登记/证据可分别回滚，须核后继冲突。

# 前端3c⑪：剩余共享职责（2026-10-16，设计/实施中）

输入⑩完成docs`9fdcaf0`稳定干净实际HEAD完整CI真实exit0/180514.504ms（`/tmp/kingturf-3c10-9fdcaf0-head-ci-2026-10-16.log`），结束HEAD仍9fdcaf0/树空。源码⑩78d726c也已实际干净HEAD全CI0/181480.679ms。按3a→3f连续授权继续，不重复许可；本组后治理3d、store/惰性加载/日期3e、独立解析收紧3f，3f后停供整批人工验收。

## 设计与旧护栏输入

只提取文档读取服务、连接器UI/表单、文档绑定/清洗/比较/打印，以及客户360、图标/viewport、岗位洞察和页面分区导航的原职责。保留root路由替换/CRM shell装配、依赖治理surface的可见路由/岗位profile、governance与CommercialController；不混做其后阶段。新TS均≤800/完整函数≤200/AST≤5，70公开绑定/457完整expect/原114及原CDP29/register4冻结；仅实际读源组织可适配且每新runtime真红→还原114。

原root renderer先定义（934），API到1075才定义。候选renderer factory在原位置只创建原arrow，接收私有API getter但不提前读取/解构/spread；GET在替换进度节点后、PUT在确认JSON.parse后原调用点取得局部alias再裸调，self递归始终returned same arrow。service factory在原API声明处只调用一次，原API→Map→clear→read顺序，token仍每request读取、缓存仍单一Map/path promise与失败delete，mount clear首时点及保存等成功clear时点不变。配置textarea的JSON.stringify仍打开表单时、parse仍提交时，**不收紧其解析**；HTTP及两storage畸形输入拒绝留3f独立登记/提交。上述TDZ、receiver、时点设计已经独立只读复核，无必要阻塞，实际候选另审。

⑩新6mdAvK扩展37、dDT4Qq正常33与2cHNqS原fixture正常29，均在本组前实际业务源码78d726c上运行，9fdcaf0只改docs、完整CI重建仍bootstrap-\_ihGLlW4.js/index-BRGHJLAb.js。拟复用为本组旧护栏运行，不伪称本组新执行；需机械核78d726c→9fdcaf0业务/tool零diff后才迁位。旧37/33/29网络三零与自有资源清理全真，失败史TD-WEB-005只登记保持，41台账不修不结清。新版仍需实际跑37及正常29（夹具口径分开），写入/权限/真实API/PG/Playwright边界保持。

当前尚未修改业务源码，不预填提取、验证或提交结果；主代理唯一写入/串行测试构建浏览器执行，scout/reviewer/协调只读。API/packages/SQL/依赖/lock/workflows/评分/Playwright冻结，不push/部署/生产。

## 候选实施与机械核验

上述为设计时点；实际迁位前已核`git diff --exit-code 78d726c 9fdcaf0 -- apps/web scripts/e2e-cdp`真实0（`/tmp/kingturf-3c11-old-baseline-same-2026-10-16.log`），据此明确复用⑩已执行同业务源码37/33/29为旧基线，不伪造新旧运行。主代理完整读原职责，经临时`/tmp/kingturf-3c11-extract.mjs`生成patch并apply_patch迁位；service四声明在原位置factory中按原序执行、root恰调用一次，renderer原位置factory仅读/返回箭头而不提前读getter，GET与PUT各原点才取得局部函数裸调用，self为同一returned renderer。

首typecheck真实2（`/tmp/kingturf-3c11-type1-2026-10-16.log`），除unused imports外发现displayTime也供commercial immutable ports，不能只做CRM私有函数；主代理复读全shared/business-format，将原完整displayTime声明放入现有共享formatter，root/CRM直接named import同绑定、不复制，原其他formatter AST不动。type2/lint真实0；不将迁位说成3e全runtime日期收敛。旧配置JSON的stringify仍click、parse仍confirm，null/数组/标量合法JSON接受范围不变；sanitizer/print/HTML下载/locale/Date/UI注册顺序原样，未修任何旧业务。

`/tmp/kingturf-3c11-proof.mjs`在实际候选逆展开两helper/两个late API alias后，**整个原137行renderer完整AST相等**；service四原声明AST及顺序、18个完整原声明、business-format除原displayTime外全体AST、root剩余业务AST/顺序/剩余import绑定、18条真实runtime导入边、70公开绑定/457完整expect全等。private API getter只原局部return，root service在renderer后/editor前一次初始化，模块无反向root或死import。首次及最终proof均真实0；完整有body函数/AST不重置回调口径。独立实际候选review及协调只读交叉审无必要阻塞，其未代跑测试。

| 新TS职责                              | split | 完整函数最大 | AST |
| ------------------------------------- | ----: | -----------: | --: |
| document-read-service                 |    24 |           22 |   3 |
| document-connector-configuration      |    89 |           85 |   4 |
| document-connector-card               |    33 |           28 |   3 |
| document-connectors                   |    46 |           41 |   4 |
| document-bindings                     |    61 |           17 |   3 |
| document-html                         |    67 |           26 |   3 |
| document-print                        |    39 |           36 |   2 |
| customer360-view                      |   101 |           95 |   3 |
| shell-presentation                    |    41 |            7 |   3 |
| role-insights                         |    53 |           32 |   4 |
| route-sections                        |    38 |           35 |   4 |
| document-connector-services（纯type） |     3 |            0 |   0 |

12新TS=11runtime/1type，另已有business-format53→56/完整函数12/AST2；最大file101/完整函数95/AST4，root3066→2545。实际metrics TS298/56214→310/56291、测试146/65760→65789，root缩进启发式≥4由1103→972、≥7由510→439、最大10不变，API4129/buildApp3598不变。root zh-CN toLocale计数虽2→0，仅迁出，不结清TD-DUP-004（须3e全runtime检查/收敛）；共享残留已是小型装配/政策，governance与God store仍大。日志`/tmp/kingturf-3c11-metrics-new-2026-10-16.log`。

## 冻结读源与实际负向

原未适配web真实2fail112（`/tmp/kingturf-3c11-web-unadapted-2026-10-16.log`），仅canonical document cache guard失去root唯一锚/广源在线文档失去HTML diff等迁出实现。新readDocumentSupportSources只收七实际文档runtime/唯一非空锚，并入原文档广源与turf；turf另收客户360/图标/岗位洞察/分区导航四实际源；cache原读源改service+bindings+原contextual。原全部expect/fixture/阈值/Playwright/原CDP断言不动，适配后9/114真0（web-adapted/lint日志）。

11新runtime与迁位displayTime所在既有business-format逐一扰动真实DOM tag/路径/状态/selector/locale文字为WEB-UAT，不动锚、不追加死marker：洞察2fail112，displayTime locale4fail110，其余十目标各1fail113；每次完全还原后114真0。日志`/tmp/kingturf-3c11-<shared/crm-模块名>-read-source-{red,restored}-2026-10-16.log`，不将大部分由turf源码guard触发的红称动态业务覆盖。最终type/lint/inverse/结构0硬31旧软/39能力19路径/build实际0，启动gzip11368/1898、bootstrap-CyQj6aZm.js/index-CuyhgVau.js；新浏览器/提交后实际干净HEAD全CI待跑。

## 新发现仅登记

独立只读复核提醒原catch无条件按path delete的代际风险；主代理复读旧新同体及台账`cache|promise|缓存|代际|旧请求`搜索未见该项覆盖，新增TD-PERF-003，**现42项**（上方41为设计时点）。只登记“旧A在途→clear→新B缓存→旧A reject可能删B而重复GET”候选时序、真实触发/生产影响待核实，不新增复现实验、不加generation/身份guard、不推论旧值覆盖/跨账号泄露，不混入3e/3f修复。登记patch初因index格式化空格不匹配原子失败、未落部分修改，核实后按实际行修正，业务候选未随之变化。

回滚本组新模块、原displayTime迁位/root facade/最小读源整组，前editor/driver/register工具不撤；源码与完成docs独立提交并各实际HEAD全CI。剩余治理3d→store/惰性加载/日期3e→独立解析3f继续，3f后整批人工验收及阶段5前原Playwright补跑保持。

## 候选浏览器实际结果

新lXBvrT全37真实exit0（`/tmp/kingturf-3c11-new-cdp37-2026-10-16.log`），与复用旧6mdAvK的case/计数/GET次数相同，DOM137/viewport51/route78/text166/overflow63、各list/session6/cost7/detail2/orderEvidence2、15类documentList各6/detail4；网络三零、preview3437315/root/profile清理全真。

另新nBMYVk未启用editor overlay正常33真实exit0（`/tmp/kingturf-3c11-new-normal-cdp33-2026-10-16.log`），DOM113/viewport48/route74/text150/overflow59、各list/session6/cost7/detail2/orderEvidence2，与旧正常33同；网络三零、preview3438161/root/profile全清。新IKaw9K未启用两个overlay、原fixture正常29真实exit0（`/tmp/kingturf-3c11-new-normal-cdp29-2026-10-16.log`），DOM80/viewport47/route69/text142/overflow56、各list/session5/cost6/detail2/orderEvidence2，与旧原29同；网络三零、preview3438542/root/profile全清。三种夹具口径分列，不用37代替原29；不声称connector配置PUT、print/download/activity、权限矩阵或真实PG受这次只读浏览器覆盖。源码提交后实际干净HEAD完整CI待跑，下方/上方“待跑”为各时点。

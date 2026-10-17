# Workspace 旧夹具失败与增量裁定（2026-10-17）

## 原失败事实/TD-TEST-014

dc43e81后只加已授S4合成Cookie/restore DTO和单void块体，原16expect调用参数AST同；void局部对照transpile除唯一获准形态外JS同。原catch-all合成API保持，不触真实API。

实际命令 `NODE_ENV=test DATABASE_URL=<private guarded loopback> node --experimental-transform-types scripts/e2e-docker/preflight.mjs spec workspace-route-isolation.spec.ts workspace-adapt-candidate-1`。PW1/38957ms、host1/44429ms，2过2败：第一CRM导航/节点保持632ms、第四失败反馈516ms过；第二搜索fill因input不可见30s超时；第三详情h2未找到5s失败。日志/HTML/两红截图trace保留于 `.test-results/docker-pw/workspace-adapt-candidate-1/`，host日志 `/tmp/kingturf-docker-workspace-adapt-candidate-1-2026-10-17.log`。guard/容器READ ONLY同实例通过，owned三清理全真。

只读第二trace非auth cost-matrix-summaries GET：q=null、response.status=-1，未完成；fixture所有该路径await gate，而原步骤要先fill才等requestStarted/切页/release，支持首次lazy读取被旧gate挂住的解释，不认定产品应删loading保护。第三360 mock缺unavailableSections；parser:44–56要求string[]，服务端customer-360:89固定投影、repo:869实际为orders/finance。不是产品漏字段，旧CDP许可不扩大到本PW。

两项候选各须独立批准：只让首次成本读取按原fixture正常返回、挂起q=慢请求的搜索；360必需字段补值（申请为空合成数组，不宣称实际repo空数组）。所有原UI断言/值/逐帧探针/路由步骤/网络隔离、产品源码/两配置冻结。原2过不是整文件绿，全文件auth真变异/还原全绿尚未完成。

## 首项原始人类许可：等待点

主代理本会话直接收到：

<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_2a13b5991a4b4354ae99d03ff621b2b7\",0]","question":"Workspace 第2例的旧合成拦截器挂住了首次成本 GET（trace：q 为空、请求未完成），搜索框因此不可见。是否允许仅把等待点限定到 q=慢请求 的搜索 GET，让首次加载按原夹具返回？保留原切页、逐帧泄漏探针和全部断言，并核验迟到搜索确在切页后释放。","answer":"允许这项夹具时序修正（推荐）"}]
</send_user_message_question_reply>

只准该等待点：requested仅由q=慢请求发出再await原gate，首次q空原payload立即回。主步骤原等requestStarted→quotes→RAF→release不改，核实际搜索在切页后响应。第二字段尚待本轮许可，不因首项先补；成本TD-TEST-013/C2/第二轮/产品保护保持。

独立R7 docs先行、台账54，父dc43e81回滚点。当前auth/void候选未作新等待点/字段变更；后继候选与各获准修正分提交，保原部分通过/失败，不预填全绿。最终稳定干净HEAD完整CI必跑，不push/部署/workflow/生产/一般阶段5。

## 等待点后继实施（字段仍待裁）

0c9a886保auth/void候选2过2败后，单独只对q=慢请求发requested/await原gate，首次原payload正常返回。夹具另只报固定fixture标记及page hash，不打印auth/业务body。主步骤从切costing起到quotes/RAF/release/原断言全字节同，16原expect不动。

workspace-timing-positive-1：PW1/9435ms、host1/15210ms，**3过1败**（迟到成本case已过，360仍原缺字段失败）；实际唯一release标记hash=#/quotes。真实源将条件扰回全部cost路径，workspace-timing-broad-gate-red-1：PW1/39005ms、host1/44821ms，2过2败，成本case又30s超时。完整close/清理后立即还原q条件，workspace-timing-restored-1：PW1/9562ms、host1/15129ms，3过1败，成本case再次过且唯一release hash=#/quotes，原16assert/切页RAF动作未改。每次owned三清理全真，原失败截图/trace独立保留。

这是等待点目标case真红→还原绿，不是整个spec绿；360未获本轮许可未改。TD-TEST-014只等待点实施验证完成、字段/全文件auth变异仍未完成。父0c9a886为本等待点修正独立回滚点，最终HEAD完整CI仍必跑。

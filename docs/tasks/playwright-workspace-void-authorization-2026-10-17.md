# Workspace 单处等价 void 语法授权（R7，2026-10-17）

主代理直接收到本会话人类原始reply，不是将doc八处许可泛化：

<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_18640ce480e847d8885863c94508ca59\",0]","question":"已集中核完其余本地 spec，只剩 workspace-route-isolation.spec.ts:67 一处非会话机械阻断：原 await evaluate 回调简写返回 setAttribute() 的 void。是否允许仅改为块体、仍调用一次，保留 data-preserved 值、所有节点/路由断言及规则？该返回值未被使用；本项不扩展文档发送那 8 处许可。","answer":"允许这一处等价语法修正（推荐）"}]
</send_user_message_question_reply>

只 `tests/e2e/workspace-route-isolation.spec.ts` 原67行 `await ...evaluate((node) => node.setAttribute('data-preserved', 'yes'))` 改块体，原一次DOM setAttribute/相同属性和值，调用方仅await未用返回，原生void/undefined异常行为保持；不得改所有节点身份/路由/迟到响应业务assert或规则。内存transpile证明除该唯一void形态外（单独去掉获准S4 auth迁移）其余生成JS/expect调用参数不变，真实绑定变异后还原原spec实跑。

原5行storage void随既有S4会话fixture迁移，不属新的非会话逻辑许可。本R7不批准原360缺unavailableSections等非S4字段修正；历史CDP许可不自动扩大到此PW文件，真实失败按TD/C7独立呈报。成本提示TD-TEST-013继续待裁。

独立docs先行，父为当前order适配提交；实现/回滚独立，先核相邻hunk，不绕hook/改PW配置/生产/C/一般阶段5/依赖/workflow/push/部署。最终稳定干净HEAD完整CI仍必跑。批准不等于该spec已执行或已通过。

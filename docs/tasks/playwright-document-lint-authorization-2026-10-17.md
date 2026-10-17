# 文档发送冻结 spec 最小机械兼容授权（R7，2026-10-17）

基线bd7e80b，当前仅文档发送S4会话夹具工作树候选；原7测试初跑全过，真实旧token变异2失败/5通过，完全drain后还原再次7过，详见后继逐spec证据。该候选的原ESLint实际1/8错误，原文件内存lint基线bd7e80b实际1/9错误（多出旧storage init void简写，已由获准auth替换消除）；不是产品业务失败。禁止绕hook/放宽strict规则。

## 原始人类裁定

主代理直接收到本会话人类原始reply：

<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_35cccddbc8024f6f890813be80e44491\",0]","question":"文档发送的会话夹具已使原 7 项测试通过，但旧代码的 8 处 strict ESLint 问题阻止提交（6 处非空断言、1 处 void 箭头简写、1 处 JSON 字段类型）。是否允许独立做最小类型／语法兼容修正？不改业务断言及参数、测试数据、网络步骤或规则；类型擦除后的运行代码须相同，void 简写只在确认返回值未被使用时改为块体；否则仍停报。","answer":"允许上述最小机械修正（推荐）"}]
</send_user_message_question_reply>

## 精确合同

只 `tests/e2e/document-send-product-quality.spec.ts` 候选行117/118和268/269的6个box!、166的void arrow、201的JSON字段类型（原文件118/119、269/270、167、202）。两组boundingBox采用准确非空结果类型标注/类型断言并移除同义 `!`，类型擦除后原运行代码相同；不加runtime空值分支/改变错误语义。JSON读取采用该合成connector fixture的精确请求类型投影，保原 `expect(route.request().postDataJSON().expectedVersion).toBe(0)` 参数与运行字节，不加runtime schema/默认值或any。

form.evaluate回调只有原一次原生HTMLFormElement.requestSubmit()，lib.dom合同void；调用方仅await、未读取返回值。只允许把该void arrow简写改块体，保一次调用/原异常/undefined结果；若发现返回值可观察或实现需其它运行逻辑则停报。不借此改其它业务数据/操作/断言/阈值、其它spec或产品源码/配置/规则。TD-TEST-012只更新本文件机械阻断状态，不提前关闭额外tsc诊断或其它旧文件问题。

独立提交与回滚点；内存transpile逐处证明纯类型擦除相同，void例外单独核，原expect调用/参数AST不变；原7测试再实跑/真实绑定变异、原hook lint/format全过。共享API/PG/浏览器串行；最后稳定干净HEAD完整CI仍必跑。成本TD-TEST-013继续待裁，不改该原提示oracle/产品，不跑第二轮/C2/生产、不push/部署/workflow/一般阶段5。

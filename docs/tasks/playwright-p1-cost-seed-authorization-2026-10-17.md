# P1 本地实际成本种子增量授权（R7，2026-10-17）

## 基线与原始裁定

接手 `7b1bc6237eeafaa5da5a96ba3ee3c0116a102d6e`，先让该HEAD完整CI实际完成exit0/206168.393ms；首尾同HEAD、clean=true/unchanged=true，API126/17242、Web14/313、config71、结构0/29、预算11991/1898、audit0，日志 `/tmp/kingturf-docker-pw-current-stop-final-ci-2026-10-17.log`。新裁定到达时未中断CI/改文件，确认树空后才本R7先行。

主代理亲读协调会话 `01a12db5-380f-79c2-9329-8bcc500a27c8` 原始人类消息 `01a14883-4398-78e3-9698-10a60b02c072`：

<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_c459820854524a8db18523404ace2a3f\",0]","question":"是否批准仅在本地 P1 种子关单前补齐“成本政策→核算→现有另一身份审批”，按已落盘方案的合成费率与稳定标识执行，并验证重复运行及真实变异？原关单、其它业务步骤和断言、SQL/触发器均保持。方案：docs/tasks/playwright-p1-cost-seed-proposal-2026-10-17.md。需要这次裁定，是因为你上一项授权明确限定种子只改认证 URL、冻结全部业务步骤；新发现的成本审批前置超出该范围。","answer":"批准最小本地种子补齐（推荐）"}]
</send_user_message_question_reply>

## 执行合同

只按[已审具体方案](playwright-p1-cost-seed-proposal-2026-10-17.md)在原COMPLETED关单前补本地owned schema演示成本policy→calculate→现有另一employee approver批准，费率/标识同方案；原close/其它全部业务步骤与断言字节保持。不得绕trigger/直写APPROVED/改SQL迁移/业务源码/PW配置；不新增依赖/生产身份。

必须真实API、两BOM主组件费率完整、policy/run已有记录严格核对并复用/拒冲突；不是重复POST依靠unique约束。分别验证同schema完整seed重复执行、policy/run/event不重复，以及缺料费率/算者自批等真实绑定变异红→立即还原绿，独立提交/回滚点。API/Web全量及最终干净HEAD完整CI仍须真实执行。TD-TEST-011由待裁变已授权实施，未验证前不关闭；前C7失败史保留，不借新许可扩大其它业务。

完成种子准备后才回已授fixture/三份会话oracle逐处映射和逐文件真实变异、A8逐spec→B2逐spec→全部绿后同配置第二轮。source-nested原PG producer前置保持；runtime原配置/loopback DB guard/隐私off，真实匿名401独立request context。C2生产spec不改不跑，未知非S4问题具体C7停报。主代理唯一写/执行PG/浏览器/测试/构建，子代理/协调只读，严格串行，不push/部署/dispatch/workflow/一般阶段5/覆盖率/收官，不输出密码/token/proof/Cookie/DSN或原SQL参数。

此R7独立docs，父7b1bc62回滚点；三项旧会话/通道/机器URL已批准，不重新问。本追加仅新增该成本业务seed最小准备，不等于P1种子/全部补跑已绿或Harness完成。

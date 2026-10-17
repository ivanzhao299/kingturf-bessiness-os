# Docker Playwright 三项增量裁定（R7，2026-10-17）

## 来源与基线

主代理亲读协调会话 `01a12db5-380f-79c2-9329-8bcc500a27c8` 原始人类消息 `01a1486d-ad22-72e1-9a01-da3b378967de` 的三项question reply，非历史CRM/360回复。接手 `c2ff52bb410e3bf32fc3f0eda797583f2f8b6a09`，工作树干净/无外来untracked。该HEAD完整CI实际exit0/190014.635ms，clean=true/unchanged=true；S4实施前置已满足，整批人工验收仍独立待交。

## 原始人类裁定全文

<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_4d96fcf68bbd471d8e7ccfd83e79a995\",0]","question":"本次授权要求“spec 文件一字不改”，但独立核验确认三份测试必须调整非夹具逻辑：startup-delivery 和 session-revocation 直接用旧 sessionStorage 判会话；runtime-local 用旧 Bearer 发权限探针，且原匿名 page.request 在 S4 后会共享 Cookie。是否仅允许这三份的会话载体请求与断言迁移，保留原目的（加载失败保会话、401 失效／403 保留、权限 403、真正匿名 401），逐处登记、独立提交并做真实变异？配置与其余业务断言继续冻结；已授权的夹具适配不重问。","answer":"允许上述最小迁移（推荐）"},{"questionItemId":"[\"request_user_input_async\",\"call_b7bf433cd5f84f4c8c946a10e6b36d99\",0]","question":"B 类补跑的原网关 HTTP 通道已实测不能接收 Secure Cookie，且被 S4 Origin 校验拒绝。是否允许仅新增本地环境脚本：容器内真实绑定 127.0.0.1，字节转发至已验证的宿主 preview／测试 PG，并将测试 baseURL 设为真实回环地址？保留 Cookie、Origin、配置和浏览器安全标志；PG 必须通过宿主 guard 与同一实例／schema／宿主生成 marker 校验，现有网关端口不可达则停，不改数据库监听或防火墙。具体提案已落盘 playwright-docker-b-channel-proposal-2026-10-17.md。","answer":"允许上述最小回环通道（推荐）"},{"questionItemId":"[\"request_user_input_async\",\"call_b7bf433cd5f84f4c8c946a10e6b36d99\",1]","question":"P1 种子脚本 scripts/seed_p1_demo.mjs 仍向旧浏览器登录出口索取 JSON token，S4 后已不兼容；该旧脚本不在本次允许改动文件集。是否仅允许其机器认证 URL 改为 /api/v1/auth/token-login，核验既有开关，保留凭据参数、Bearer、身份、幂等键和全部种子业务步骤，独立提交并做真实变异？","answer":"允许最小种子认证适配（推荐）"}]
</send_user_message_question_reply>

## 精确执行边界

1. 三份spec仅会话请求与oracle迁移，真正匿名401须独立无会话APIRequestContext，不改200冒充。其余业务断言、两配置冻结；原先批准的内联fixture/helper适配仍有效，C两生产spec不改不跑。每适配文件真实绑定/实现或fixture变异红→还原绿，单独提交/映射。
2. 只scripts/e2e-docker必要本地环境脚本：owned容器真实回环字节转发，Cookie/Origin/Set-Cookie不改。网关重新实测，PG现有端口不可达即停，不改listen/防火墙/新增对外监听/PG容器。宿主先原guard核实际测试db/实例，宿主owned schema生成随机marker，容器只读比较相同db/schema/实例与marker，不能在任意目标重建marker自证；不匹配在seed/API写前停。runtime原guard/trace-screenshot off/原bundled Chromium配置保持，主配置Chrome另记。
3. seed_p1_demo仅机器认证URL改token-login，既有开关核true，凭据、两身份、Bearer、幂等及全部业务步骤/断言不变；独立提交与真实变异。

R7独立docs先行，父c2ff52b为回滚点。随后通道/PG同一性及自然Cookie/Origin负例→seed小步→fixture/oracle→A8逐spec→B2逐spec→全部绿后第二完整轮。source-nested依赖原PG producer回放；不得拿回放充真浏览器API。失败留trace/截图（runtime原off）、真实命令/退出/耗时；非S4业务/非已授fixture形状新问题实证登记TD并C7停报，不借旧CDP授权扩PW字段。最终稳定干净HEAD完整CI实际0后停人工验收。

不push/部署/dispatch/生产/workflow/新依赖，不读真实.env，不把密码/token/proof/完整Cookie/DSN放日志/镜像/trace。只有主代理写执行PG/浏览器/测试/构建，协调/子代理只读，不并发共享PG/浏览器/CI。不得扩一般阶段5/覆盖率/收官。

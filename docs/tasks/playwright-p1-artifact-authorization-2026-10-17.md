# P1 最小产物例外（R7，2026-10-17）

## 来源与原始人类裁定

本会话直接收到原始人类reply，非协调消息或历史权限推断。父796eba0；startup-delivery候选另在工作树验证中，不纳入本docs提交。

<send_user_message_question_reply>
[{"questionItemId":"[\"request_user_input_async\",\"call_5b46d68608d34eccb6dbaaae626c4776\",0]","question":"P1 原 retain-on-failure trace 会记录真实合成账号的密码、proof、Cookie，与本轮保密要求冲突。是否允许仅 P1 命令加 --trace=off（两配置/原断言不改），使用独立只读仓库容器，把原始输出、HTML、错误上下文及浏览器临时文件放 owned tmpfs，不导出原始产物，仅导出固定用例结果和逐张核过的业务截图，完成后移除容器？该方案不承诺 RAM、宿主 swap 或物理磁盘绝无认证字节；若要求物理零落盘，则 P1 保持阻断。","answer":"允许上述 P1 最小产物例外（推荐）"}]
</send_user_message_question_reply>

## 精确范围与尚未执行

只P1命令级`--trace=off`，两原配置文件字节/原业务断言不改；独立只读仓库容器，原始stdout/stderr、HTML、错误上下文、浏览器profile/cache和临时文件留owned tmpfs，不导出原始产物，仅固定用例状态/耗时及逐张核过业务截图。容器/Docker日志不得保存原始输出，不复用A runner的0644持久raw log策略；不上传、不将材料写argv/镜像/公开报告。完成后移除owned容器和临时文件系统，仍不得称RAM、swap、所有物理介质从未含认证字节。

本R7不是实施通过。仍需先具体接线/封闭写路径、独立只读复核及真实正负/取消清理证据；发现无法满足即停报，不凭本例外宣称秘密零落盘。协调后到的密封全产物方案未执行、不取代此直接人类裁定，若拟改为保留加密raw须另经具体裁定。

先继续A8独立首轮，再B2首轮；仅第二完整轮须全部A+B绿。先前dc32ffa此处“全部A绿后才B2”是主代理额外解释，非上述人类reply/原授权的新条件，现明确纠正，不因此拦独立未受影响B首轮。runtime沿原trace/screenshot off，C2不改不跑。当前cost/Workspace仍有非S4待裁失败，不因本R7改业务/oracle。产品/API/Web/SQL/依赖/workflow/push/部署/一般阶段5保护保持，最后稳定干净HEAD实际完整CI必跑。

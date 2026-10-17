# B 首轮本地产物隔离接线方案（2026-10-17）

依据[P1直接人类产物R7](playwright-p1-artifact-authorization-2026-10-17.md)与[原Docker三项R7](playwright-docker-rulings-2026-10-17.md)，只接本地P1/runtime，不扩A/C白名单。A首轮已均留证，非S4失败继续保留、第二轮仍禁。无加密工程/原始产物私有持久保留。

## 最窄实施设计

1. 既有preflight新增精确`local p1|runtime <unique-label> [privacy|interrupt]`，复用宿主guard/随机schema/marker、容器只读同实例核证→初始化API→原preview/真实回环byte relay。P1先同一schema原完整seed，runtime不执行P1业务seed。凭据/guard DBURL只走现有私有stdin JSON，不用argv/Docker env/镜像，不读.env。
2. B独立容器root filesystem及repo bind只读，`--log-driver=none`，仅`/tmp`及`/work/.test-results` owned tmpfs可写；XDG cache/TMPDIR都指/tmp，不改HOME。原API/preview输出忽略。Docker配置在发送身份前重新核只读/日志驱动/tmpfs；容器内实际拒repo canary写入才可继续。取消/失败必须确实移除owned容器/tmpfs、schema、preview，不能只记录准备清理。
3. 不复用A原0644 raw runner。B Playwright stdout/stderr只写/tmp mode0600；原结果/HTML/error-context/浏览器profile/cache仅tmpfs，原始对象/标题/错误/认证不向host转发。P1仅CLI traceoff，原main两reporter+安全观察reporter；runtime原config/Chromium/list/off不变，仅加安全观察。两config字节保持。
4. 安全观察reporter只在内部tmpfs写固定case索引、枚举status、整数duration/原source line；控制程序及host分别白名单重编码，不转发原reporter对象/附件/错误。PW真实close exit及signal、整体耗时独立记录，缺case/不全passed不得称绿。普通工具错误只报固定phase，不输出原异常message。
5. **首版零PNG导出**，包括原显式业务附件：仍按原spec在容器tmpfs产生，不修改附件代码；截图证据未保留/未验收，不能称已逐图核或视觉验收完成。此为R7允许集合的保守子集，经只读review确认；不将未审PNG经base64工具stdout或docker cp送出。若需后继截图验收，先明确私有临时预览通道边界，逐张核准才导出，不自动沿用本方案。

## 验证与边界

实施后独立只读review、固定非秘密canary隐私负例（repo只读/tmpfs/raw与host安全事件分离）、取消实际清理、原lint/format/结构；再P1/runtime自然登录与各文件真实会话负例/还原。原业务断言/样本/种子业务步骤/SQL/配置/依赖保持。实际执行命令/exit/耗时与未导出截图限制另补证，不预记绿；运行失败不偷偷输出raw查因，只用安全业务类别诊断。

只保证本工具不导出/保留宿主持久原始产物，不证明RAM、swap、内核/虚拟化或未审外部采集从未含认证字节。若只读rootfs/tmpfs配置不满足或未知原始写路径尝试失败即停，不放宽只读。最终最后稳定干净HEAD实际完整CI必跑，C2/生产/push/部署/workflow/一般阶段5禁。

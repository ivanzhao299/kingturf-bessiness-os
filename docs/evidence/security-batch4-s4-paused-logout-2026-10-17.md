# S4 独立修复：暂停状态下的显式退出

## 裁定与映射（实现前）

输入b38c75c，真实网络候选发现并已登记TD-WEB-009：挂载冲突进入恢复页后owner暂停，返回登录在发送前本地403。失败链/两次Chrome复现和全部owned资源清理见[网络证据](security-batch4-s4-network-2026-10-17.md)。协调与独立frontier裁定为已授S4新增实现与设计§4退出契约内部矛盾，非C7新选型，允许窄修；不改其它业务。

旧锚点 `http.ts:30–32 prepare`：所有paused unsafe均本地拒绝，包括startup-failure显式logout。新锚点：仅已有SessionContext的精确path `/api/v1/auth/logout` 且method `POST` 跳过canWrite暂停检查；current前置、原generation/原CSRF、same-origin Cookie、服务端Origin/认证/撤销、响应后owner检查原样。绝不resume owner、不新增通用allowPaused、不豁免改密/其它写、不读新proof、不自动restore/retry、不假登出。旧A+实际B拒绝并保B，迟到A204不reloadB。

变异目标：真正http暂停门禁删除精确logout例外，新增paused logout测试必须红；还原后绿。`http.test.ts`只增加退出/精确边界/处置归属断言，原8项预期保持。Node mock只能证本地请求策略，真实撤销与失败链重跑另由Chrome/PG证明。独立fix提交与网络工具WIP分开；WIP仍在时不声称fix HEAD干净或最终CI通过，最后全部候选稳定干净HEAD完整CI0才交付。

验证待执行，保留网络失败史，不提前关闭TD-WEB-009/SEC003或上调评分。

## 窄修实测（独立fix提交前，工具仍WIP）

实现仅http.ts新增精确revokingSession条件并在原pause检查附`!revokingSession`，其余控制流不动。独立只读auth reviewer确认授权边界，原8测试正文不改。新增9项：paused精确退出仍原proof/owner继续pause、六项非目标path/method不发请求、disposed不发、迟到A204不清B/不reload。

- 旧实现新增测试先真红2fail/15pass：`/tmp/kingturf-s4-paused-logout-before-red-2026-10-17.log`。
- 新实现17pass；真正删除exception再2fail/15pass（`/tmp/kingturf-s4-paused-logout-mutation-red-2026-10-17.log`）；还原17pass（`/tmp/kingturf-s4-paused-logout-restored-green-2026-10-17.log`），无变异遗留。
- typecheck/lint0、build0/预算11991/1898。首次新测试table未加const导致typecheck1、lint2条，补tuple const后两项复跑0，失败不隐藏。
- API全量126/17242实际0/81.80s：`/tmp/kingturf-s4-paused-logout-api-full-2026-10-17.log`；随后Web全量14/313实际0/1.79s：`/tmp/kingturf-s4-paused-logout-web-full-2026-10-17.log`。
- 新profile真实Chrome原失败链恢复成功：`/tmp/kingturf-s4-network-paused-fix-full-first-2026-10-17.log` exit0，固定诊断logoutRequests=1/hasLoginForm=true/retryFailureVisible=false，DOM重登挂载成功；合计Node4/SPA DOM2/受控Runtime协议14=20项，owned清理全true。协议内旧A proof+B Cookie拒绝且PG零写，旧logout不影响B；完整focus/tab/dialog/旧mount待后继工具，不外推全DOM。

独立fix回滚只撤本窄修及新增9测试，会恢复已知失败行为，不自动恢复/清除Cookie。fix提交时工具仍WIP，不能称树干净或该HEAD完整CI通过。最终全部候选稳定干净HEAD完整CI仍待执行；TD-WEB-009仅窄修验证不提前验收，SEC003/评分开放。

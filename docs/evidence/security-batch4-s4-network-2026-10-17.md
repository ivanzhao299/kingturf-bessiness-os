# S4 真实网络与应用 CDP 验证

后继检查点：[暂停状态显式退出窄修](security-batch4-s4-paused-logout-2026-10-17.md)经协调/frontier判为已授S4内部实现矛盾，非C7新选型；已局部修复且真实失败链重跑成功。下方“仅登记/未修”为失败时点。网络完整DOM/生命周期/变异及最终CI仍待执行。

## 输入与范围

输入 b38c75c：稳定干净 HEAD 完整 `pnpm ci:local` exit0 / 192629.727ms，API126/17242、Web14/304、config71、结构0/29、预算11992/1898。日志 `/tmp/kingturf-s4-frontend-final-head-ci-2026-10-17.log`。这是前端证据，不是本页网络验证。沿已授权设计§4/6/7继续；SEC003/评分开放，不跑九旧PW/Docker/阶段5，不push/部署/workflow。

## 先行策略

guard回环test PG、随机独占schema，现迁移/scrypt/组织员工凭据权限表，两真实API共schema/secret。临时合成账户/密码/secret，不读真实.env，不输出身份、密码、token、proof、Cookie或DSN。参数化SQL统计真实员工写/会话审计副作用；工具seed/到期安排不改生产SQL/schema。先停API再关连接、只删本轮精确schema。

owned gateway在127.0.0.1:4173同源提供构建后真实SPA/代理真实API；上游真实响应到达后、下游writeHead/flushHeaders/首次write/end前barrier，分开观测事务提交与头放行，不只延body/JS，不Fetch.fulfill。Chrome既有安装/原安全flags/随机loopback CDP/全新owned profile，不碰用户窗口；精确method/path白名单，未知API/写/外域拒绝且整套失败。Secure不降级，不换别名/HTTPS。

## 矩阵（全部待执行）

| 设计锚点 | 网络/PG oracle                                                | Chrome oracle                                                                                                   |
| -------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| §4.1     | 旧401/logout204/credential204无认证Set-Cookie                 | B自然Cookie GET后放旧头；不同目标B/事务后新B存活，同目标旧B撤销                                                 |
| §4.2     | 同账户不同session/不同账户                                    | A→B、B→A头顺序后自然GET，以最后实际Cookie为准                                                                   |
| §4.3     | A proof+B Cookie拒绝、员工写计数不变                          | 不自动重放；错配/迟到restore仅修CSRF，有限恢复后手动新写                                                        |
| §4.4     | 晚login跨logout/改密、跨实例撤销/过期                         | 放真实头后自然GET区分存活/已撤，不拿JS epoch作网络证明                                                          |
| §6应用   | 两Set-Cookie/no-store/login JSON无token/服务端收到Cookie      | DOM登录→workspace→登出→重登，HttpOnly/Secure/Lax/Path/无Domain及实际回传                                        |
| §7负向   | 缺/null/foreign Origin标Node instrumented；GET豁免/双载体拒绝 | 缺/错/跨session CSRF与零写副作用                                                                                |
| §5       | 既有Web304/PG20不冒充新增Chrome调度                           | 真tab广播/focus同代保表单、换代reload清body dialog、旧请求/mount不覆盖B、初始401无reload循环、mount冲突手动重试 |

## 文件及验证纪律

拟新增独立opt-in工具；真实DOM复用driver。若提取Chrome生命周期适配旧preflight，先登记旧→新与逐文件真变异，再单独重跑原29/CSP3，不混自然Cookie结果。原fixture/网络硬闸/PW不变。输出仅固定类别/计数/布尔，正常/失败/信号验证API/listener/Chrome/profile/schema精确清理。独立提交后同一稳定干净HEAD完整CI0再交协调，未完成不预填。

历史CRM/360异步选择不替代当前执行，已落盘不重改。主代理曾误将旧回复当当前结束，已恢复；两次不存在路径读取无写入；先行docs patch两次索引锚点错误均原子失败无部分落盘。协调两次JS括号SyntaxError执行前失败无外部作用，修正后初派实际一次。

## 实际检查点：恢复页退出阻断（未完成，不提交候选为已测试实现）

新增七个 `session-network*` 文件仍是WIP，旧preflight/driver/fixtures/网络策略/业务源码/PW均未改。没有抽取旧launcher；新独立owner沿既有flags/ActivePort/精确进程验证实现，仅真正共享ownership matcher和driver，不称生命周期已抽取复用。独立只读复核证实gateway barrier在下游写头前；发现的query/raw URL硬闸、逐资源清理、CDP异步failclosed和中断race已在候选修正：现在中断标记由有界setup/用例边界检查，等待当前工作settle才清理，不Promise.race遗留后台工作。生命周期故障/信号实测、这些修正的变异及全矩阵仍未执行，不能算闭环。

实际日志：

- `/tmp/kingturf-s4-network-first-2026-10-17.log` exit1：真实DOM登录/工作台及Cookie属性1项通过，挂载冲突退出未通过；当时隐藏错误详情，不能倒推失败细节。全部owned资源清理true。
- `/tmp/kingturf-s4-network-second-2026-10-17.log` exit1：Node手工Cookie/Origin缺、null、foreign零员工写及GET豁免4项通过；Chrome真实DOM登录/工作台1项通过；随后 `DOM logout returns login` 超时。全部owned清理true。
- `/tmp/kingturf-s4-network-signout-diagnostic-2026-10-17.log` exit1：同样5项通过；固定诊断 `logoutRequests=0 / hasLoginForm=false / retryFailureVisible=true`，再次同位置超时。gateway listener、Chrome root/profile、两API子进程及随机schema全部已清理。Chrome154.0.8037.99/CDP1.3，原安全flags/新profile/自然Secure Cookie未降级。

确定调度：真实SPA登录B→workspace→reload，hold真实employees响应头→真实同页另一个BroadcastChannel发invalidate→watch同代复验→释放employees头→显示手动恢复页→真实Input点击“返回登录”。这是显式调度信号，不是自然跨tab行为证明。没有注入假modal/伪造认证。

独立只读核对因果：entry.ts:243–246、262的revision验证再次pause owner并抛错；startup-failure.ts:40–48调用POST logout，http.ts:30–32因canWrite=false在fetch前抛本地403，界面显示“退出未完成”。刷新仍可恢复，不能称全部手动恢复不可用。挂载冲突保守失败本身已在前端证据登记，**新确认的是其“返回登录”操作被同一暂停门禁拦住**。登记TD-WEB-009，业务修复须独立处理，当前不擅自给所有paused写放行/恢复proof/绕过代际检查。

已执行：新增纯JS2项（精确URL负例、真实头barrier）通过、七文件eslint通过、prettier通过、doc-lint152通过。首eslint曾因测试空arrow报2条，已加注释后通过；另一次多文件patch因browser匹配行变化原子失败，随后按实际行重做。未执行：Runtime协议矩阵（DOM阻断前未到达）、同代focus/tab/dialog/旧mount完整矩阵、逐文件真变异、生命周期负向、API/Web全量和本步最终HEAD完整CI。工具里的`__s4`协议请求只可算Chrome自然Jar+受控Runtime.fetch，不可冒充SPA owner处理或DOM登录写。迟到restore当前候选尚须按真实login-context使l域Cookie后hold restore，断仅CSRF Set-Cookie→B proof403/零写→显式restore新写201；同账户不同session旧proof也须补独立拒绝例。SEC003/评分开放，WIP不标验收/无新提交。

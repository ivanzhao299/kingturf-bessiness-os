# TD018 受控收口 S1–S6 证据（尚未完成）

先0c98d6a[正式人类R7](../tasks/harness-final-channel-closeout-authorization-2026-10-20.md)，再3095081[S1–S3设计](../tasks/harness-final-channel-s1-s3-design-2026-10-20.md)。旧[网络失败史](harness-final-network-diagnostics-2026-10-20.md)与[P义务链](harness-final-browser-evidence-2026-10-20.md)保留；d973ce8实际干净HEAD完整CI0/401325ms是前检查点，不顶新结果。

## S1 完成驱动采集窗

仅将采集绝对上限改为SAMPLING_CAP_MS=15000，完成/close立即收取、不等cap；不是修改原relay5000ms。15秒选型依据为Windows既有3.6秒查询及首次超过10秒yield，不声称实测分位数或已保证所有Windows查询可用；真实正常采样验证在S2。取消确认原300ms暂保持，Windows取消不确认仍报false，真正原生监督与独立消亡验证须后继S2/S3。

新增3.6秒mock完成即收测试；原error无close测试改mock时钟14999→15000触发kill、再300ms未确认false。原12＋新增1=13纯测试实际全过（82.774178ms），strict lint/format实际0。没有运行真实采集/Windows/P1，原forward/preflight/spec/产品/两配置未改。回滚本S1仅cap与对应测试成组，不能把旧1.5秒用于已知3.6秒查询的受控激活。

S2真实canary/原生监督、S3三故障清理与独立审、S4原11认证红还原绿、S5同HEAD两轮38原UI、S6材料及最终新干净HEAD完整CI均尚未执行；未执行不预填绿。不push/部署/生产/网络配置/产品/依赖/§14。

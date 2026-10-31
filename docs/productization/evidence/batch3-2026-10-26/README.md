# Batch 3 定向验证证据

manifest.json列原红、新绿与失败修正日志，不包含密钥/合成账号密码/数据库连接串。baseline-three-defects保留旧行为；target-red为在旧行为上的正确目标断言。risk-read-first-green中的8个旧合同失败与后续修正见验证报告；inventory-matrix两次失败是夹具与精确业务门卫差异。g5-no-match-mutation-red/restored-green最初两份因mock错误使用suppliers而非list，均不能证明时序保护；以随后valid-baseline=0、valid-mutation-red=1（body为replacement）、valid-restored-green=0为有效注入链，原错误记录保留。

G5对比初版scanner失败另在验证报告说明。最终CI/双轮浏览器只认固定最终SHA本地`.test-results/batch3-productization/final-status.json`，此目录中的先前限定绿不代替它。独立源码审查不等于独立复跑。

# 决策卡 D6：C类角色 UAT

状态：待人类决定；本轮禁跑，不提供或读取生产凭据，不改权限/身份。[总R7](harness-final-acceptance-authorization-2026-10-20.md)。

现状：`production-role-uat.spec.ts`按业务角色验证允许/禁止路由、动作与API。旧Bearer/sessionStorage需独立Cookie迁移；`KINGTURF_UAT_PROVISION=true`分支会创建employees、写identity/role及最终deactivate（源码279/291/310附近），不是只读，也不等于删净临时数据。configuredAccounts仍可能指真实账号，禁止仅凭环境变量名推定授权；失败日志/截图亦可能含业务或认证数据。

选项：

1. 非生产专用schema与合成角色矩阵，明确provision/回收在owned范围；自然Cookie和原权限断言保留，覆盖允许/拒绝并真实扰动，不声称代表真实生产角色授予。
2. 生产专项UAT：优先人类预建专用最小角色账户并关闭自动provision；若确需生产建/停用户，另逐项授权写入、负责人/时段、回滚与审计。禁止将此写权限混入RO窗口。

建议选1，生产角色授予验证另批2，先确认矩阵、合成账号/种子与网络副作用边界。所需授权：环境与角色真值、账户生命周期、明确可写接口/数据、产物脱敏和失败终止策略。当前C待决不充通过，任何生产外写/自动化/部署均不执行。

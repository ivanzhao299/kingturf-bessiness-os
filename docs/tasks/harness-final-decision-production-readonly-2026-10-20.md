# 决策卡 D5：C类生产只读 spec

状态：待人类决定；本轮禁跑C类，不访问生产，不改原spec或两配置。[总R7](harness-final-acceptance-authorization-2026-10-20.md)。

现状：`production-readonly.spec.ts`含生产health/ready/version身份及桌面/移动所有权限页巡检；认证仍读JSON token、写旧sessionStorage，与已验收Cookie模型不兼容。原附件导出路由/标签JSON与全页截图，console/pageerror也会原样记录；生产“只读”仍会登录创建会话，不能等同无状态/零敏感产物。精确生产release/environment要求不能在隔离环境伪造为通过。

选项：

1. 另授非生产同版本同入口/权限/浏览器巡检，使用合成数据与自然Cookie，严格产物白名单；可覆盖UI合同，但不替代真实生产HTTPS、release身份与外层代理观察。
2. 另授生产专项RO窗口：固定发布SHA/账户与权限、只读请求白名单、自然Cookie适配和逐文件负例、采样/脱敏/保留期/产物审批及清理；明确禁止业务写入和未批截图导出。

建议先选1获得可重复UI证据，再由人类单独决定2的必要性与时间。所需授权：环境、账户提供方式、网络/产物范围、允许的登录会话写入、终止条件与负责人员。当前不能用A/B、CDP或非生产绿勾掉该C项；不创建监控/部署任务。

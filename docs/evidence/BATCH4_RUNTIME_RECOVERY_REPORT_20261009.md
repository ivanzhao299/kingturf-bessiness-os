# BATCH4_RUNTIME_RECOVERY_REPORT

2026-10-09 Asia/Singapore。GOAL：恢复标准本地真实API/Web开发和构建后启动；RESULT：**COMPLETE_LOCAL_VALIDATED**，独立branch/checkpoint，未push/PR/Hosted/部署。

## Initial State / SCOPE / BASE

分支 `codex/batch4-runtime-recovery`；当前源码checkpoint **be6f56bd5db8355e08c5b2d841759dcad92c2cd0**。源码改动前基线 **7341f4f729878fb912c6f404d61b49f518455a2d** 是本地整合预览及最后余额渲染补丁，包含未合并33/31/32/34，明确依赖，不能宣称来自已集成main。仅8文件：apps/api/package.json、apps/web/vite.config.ts、.env.example、README.md、package.json、eslint.config.mjs、playwright.runtime.config.ts、tests/e2e/runtime-local.spec.mjs；不把runtime修改混进PR34。

## ROOT_CAUSE / CHANGES

1. API dev的strip-types不支持现有constructor parameter properties；dist/server.js普通Node又会经现有workspace exports加载TS源码。dev/start采用仓库生产镜像已用的transform-types；start入口仍是已编译dist/server.js。没有更改workspace exports、生产镜像、依赖/lockfile或重写构建体系；编译API当前仍依赖带TS的workspace，不宣称独立纯JS分发。
2. README复制.env后pnpm命令没有环境加载；API dev/start用Node24 `--env-file-if-exists=../../.env`读取root文件，显式process env优先。DB命令不自动读文件（CI数据库只用显式进程DATABASE_URL；Vite testing/build会按配置读取root的proxy/port设置，不向浏览器公开非VITE前缀变量），README本地迁移改为 `node --env-file=.env --run db:migrate`/db:status。CI继续受显式loopback test guard保护。
3. Vite没有同源API代理；dev/preview增加/api及health/ready/version代理。默认target127.0.0.1:3000，可按local API_PORT配置，拒绝远端/非HTTP/credentials/path/query/hash；Web默认loopback绑定，避免将本机API新增暴露到局域网。没有CORS bypass、生产地址或mock auth。生产Web容器的显式host参数和API CMD保持原样。
4. 模板API_HOST127.0.0.1，SESSION_SECRET=change-me必须替换；WEB_PORT真正读取。新增显式opt-in真实浏览器验证、受限CRM合成账号、持久化/审计/401/403断言。root lint纳入新测试/config；plain JS使用既有非typed推荐规则，不降低原TS规则。新配置仅loopback Web origin，认证trace/screenshot关闭。

## VERIFICATION

仅本轮新建loopback/tmpfs PG17.7容器，标签stabilization-20261009；库名kingturf_test、专属runtime_web随机schema。先assertTestDatabaseTarget和迁移70项，然后一次事务创建合成company/team/employee/identity、scrypt凭据及仅customer:read/create COMPANY role。无默认账号或会话绕过，没有运行缺target guard的demo:seed；不读取生产数据。

| 实际操作                                 | 结果                                                                                                                                      |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| frozen install / pnpm ci:local           | PASS414/414：release38、API180、Web114、shared82；8 workspace lint/typecheck/build，format/manifest/DB guard/70 migrations/audit全通过    |
| pnpm --filter api dev + web dev          | PASS：默认root.env加载，API3019、Web5189；真实Web proxy登录200→表单创建客户201→UI查询→DB PROSPECT/tenant/成功audit核对                    |
| pnpm build后api start + web preview      | PASS：本地NODE_ENV=production API3020、Web4189；正常production config校验（仅本地合成DB/secret），同一真实浏览器业务再通过                |
| dotenv override / proxy override         | PASS：root文件3019被process API_PORT3020覆盖；preview target显式指向3020，ready/version证据来自该本地API                                  |
| security deny                            | PASS：真实浏览器无ar capability403且无items；无bearer客户接口401；API日志无500/未预期pageerror；customer.created/auth.login成功审计可核对 |
| original browser regression              | PASS26/26：原21、Batch2 auth2、Batch3 authz3；模拟/响应回放，另计真实runtime1 dev+1 build                                                 |
| invalid target                           | PASS：远端proxy配置启动前拒绝；runtime远端Web、非test DB、未opt-in均在浏览器/HTTP之前拒绝                                                 |
| secrets / migration / production diff    | PASS：已知合成password/connection未进入API/browser日志；无migration、生产配置或image修改                                                  |
| Hosted / human UAT / attachments restore | NOT_RUN / NOT VERIFIED / NOT VERIFIED                                                                                                     |

开发夹具先前ESM加载、label包含“必填”的定位、将客户PROSPECT误写为线索POOL的预期、JS浏览器global lint问题均按真实DOM/0017 schema/原lint修正；没有删测试、skip、降低断言或修改客户状态实现。最终真实test要求PROSPECT（0017:9原default）。已解包浏览器runtime libraries复用，无依赖升级。Node experimental warning属于现有运行方式，非功能错误。

## RISKS / NEXT

startup migrate/status仍有DDL、并发及历史checksum治理问题KT-013，本批没有顺带重写；dev/start只能使用隔离本地库。API认证测试依赖的PG schema/ext路径与生产backup/schema状态分开。附件上传/下载/哈希恢复、真实岗位UAT未执行；页面历史环境标签仍可能固定显示生产域名，另作P2体验问题。本地API使用production配置不构成真实生产部署。

独立只读review已核查脚本、env优先、proxy loopback、生产镜像兼容及guard；生产发布NO。后续正常集成基础PR后，8文件runtime patch可单独进入PR并运行Hosted；不将本地整合基线伪装成已合并main。报告另为文档checkpoint，SHA见最终交付，避免自引用。

## Final cleanup

全部测试后主动停止本轮API dev/start、Web dev/preview；只读确认auth/authz HTTP schema残留0，再删除自身runtime_web合成schema及已核对标签的tmpfs容器。私有root.env、test/start.env、runtime-private账号材料已清理，未保留默认账号。日志/脱敏摘要留在忽略证据目录；当前服务状态为STOPPED_AFTER_VERIFICATION，PASS表示启动/真实链路曾实际执行通过。复现按README显式隔离资源/账号准备，不连接生产。最终文档format/diff/sensitive-pattern检查通过；工作树干净，source/docs分开checkpoint。

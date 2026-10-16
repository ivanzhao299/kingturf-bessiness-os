# 3a CRM HTTP 工厂（2026-10-16）

基线 `66a2f2b` locale稳定干净HEAD完整CI真实exit0/171878.057ms后才实施。路径严格按3a工厂→shared地图，**不是启动3b域视图/控制器迁移**。

## 旧新映射与守恒

- 原bootstrap.ts:10522–10590完整 `createFetchCrmApi` → `shared/crm-http.ts:4–72`（完整69行/AST3，模块73 split行）。运行import仅原 `../http` 的json/requestId；type-only import `../crm/types`。原post闭包、Date/JSON/headers/幂等键求值顺序、async方法/箭头receiver、token捕获及await完全保持，不造转发factory。
- 原bootstrap.ts:715–796连续七type → `crm/types.ts:1–82`，模块85 split行/AST0，无运行依赖。原Customer/Lead/Employee/Customer360/CrmApi五公开类型由bootstrap真实type facade保留；CustomerInput/LeadInput仍不经bootstrap公开，仅尾部内部type-only export供原controller签名跨文件使用。纯类型前置是工厂最小依赖，不扩业务实施范围。
- bootstrap导入并直接reexport原工厂，无wrapper、无新运行反向bootstrap依赖。原http模块已由bootstrap使用，其单一sessionExpiredHandler不会复制。工厂对http引用同一模块实例。

`/tmp/kingturf-3a-crm-http-conservation2-2026-10-16.log`真实exit0：整个factory逐字相同；除尾部内部type-only export之外原类型整块逐字相同；删除新增四个import/export并回填旧两块，**整个bootstrap逐字还原**；原五类型公开facade名单和type-only属性机械核验。全部新模块800/200/5满足，parseErrors0，结构0硬/31旧豁免，bootstrap15731→15590 split行净−141（含显式facade开销）。

本步全部原web测试与预算脚本零diff，原读取路径/slice/import **零适配**；facade是真实绑定，不留字符串死代码。readonly reviewer与协调分别核验真实diff/TS AST七类型/factory正文、自由依赖、receiver和时序，无阻塞，未运行检查/写入。

## 诊断史与验证

后补：独立源码/证据提交 `1a7c4a9` 稳定干净HEAD完整 `pnpm ci:local` 真实exit0/174221.138ms单调计时；日志 `/tmp/kingturf-3a-crm-http-head-ci-2026-10-16.log`。API117/17099、web114、原PG、database68/domain14、纯JS4、预算11368/1898、结构0硬/31旧豁免、audit无已知漏洞，完成后才启动商业工厂。下文“CI随后”保留此前时点。

新产物CDP zq3TCZ真实exit0：Chrome154.0.8037.99/PID27136/127.0.0.1:59765、owned preview2182024，新profile隔离；七场景32 DOM/3 viewport/25 route/10 text/10 overflow，网络blocked/unknownAPI/failedAPI全部0，preview/process/profile清理成功。日志 `/tmp/kingturf-3a-crm-http-cdp-2026-10-16.log`；截图 `/tmp/kingturf-cdp-preflight-zq3TCZ-probes.png`。只有四route合成stub，覆盖真实新工厂的客户GET与360迟到/失败路径，不声称CRM写入、全部API方法、真实账户或Playwright覆盖；不并入web114计数。

初稿工厂误放crm/http.ts，协调指出3a shared落点后通过apply_patch迁到shared/crm-http.ts，未提交错误路径。首次type整块byte证明真实exit1：直接给私有CustomerInput加export使Prettier将单行类型重排；改为保留原type定义、尾部独立type-only导出列表，再次证明全等，未放宽正文比较。首次证明的stderr保留在会话命令输出，stdout日志 `/tmp/kingturf-3a-crm-http-conservation-2026-10-16.log`为空，不伪称该文件含完整失败堆栈；先前局部web/build为旧路径诊断，最终路径另全部重跑。

最终路径原web9文件114通过（`/tmp/kingturf-3a-crm-http-web2-2026-10-16.log`）、typecheck通过、capabilities39/19通过；metrics175源文件/52693 split行（`/tmp/kingturf-3a-crm-http-metrics2-2026-10-16.log`）；build预算11368/1898 gzip，阈值12000/4000与lazy约束未改（`/tmp/kingturf-3a-crm-http-build2-2026-10-16.log`）。CDP与独立HEAD完整CI随后记录，不以locale CI冒称本步全链。

回滚本小步到66a2f2b，bootstrap、shared工厂、必要类型前置与facade同步撤；form/locale/C3保持。无新依赖/后端/packages/SQL/workflow/生产/push/部署变动，不提前commercial工厂或navigation/3b。Playwright九spec冻结未执行/阶段5前全部真实补跑义务、原31与评分债务口径保持。

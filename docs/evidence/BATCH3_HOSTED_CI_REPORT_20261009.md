# BATCH3_HOSTED_CI_REPORT

2026-10-09 Asia/Singapore。GOAL：独立复核Batch3、收敛CI-only依赖并建立PR/Hosted证据。RESULT：**PR34 OPEN / latest-head Hosted quality PASS**，未集成main、未生产部署。

## SCOPE / CHECKPOINT

原code7562baf、docs23c2764保留；9c79da1正常merge PR33最终ab26c6e，不改公开历史。后续ae8e9f7修统计展示/契约断言，e33e414修字段缺失金额显示。PR：[#34](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/34)，base `codex/batch25-ci-gate-recovery` SHAab26c6ebff7a4524a205f3a1ec92959a35c97f94；head **e33e414c1de805714af6641c274723e56ef53482**。明确未合并依赖，权限source diff13文件，不含重复Web/CAPA fixture或Batch1/2源码；其余治理文档恢复/连续性在描述中披露。

## Independent security review / ROOT_CAUSE / CHANGES

独立只读review覆盖各source的capability、tenant/org/SELF/COMPANY/TEAM、object scope、字段，法律嵌套事件/manifest及UI。无新跨tenant读取证据；不是生产安全认证。

- KT-L19规格42–72明确定义collection的LEGAL_PENDING/LEGAL_ACCEPTED父生命周期，催收read用户需要知道已交接不能继续跟进；按原契约保留（受collection自身字段策略）。它不授予独立legal对象/事件/evidence/manifest权限。新增真实HTTP断言父state=LEGAL_ACCEPTED，保留所有原敏感子字段拒绝断言；不能声称“完全不能推知法务交接状态”。
- P2统计：无legal read或字段白名单遮蔽legalHandoffs时，原首页错误显示“法务待受理0”。现在只有collection与legal能力、实际可读数组及子状态完整时展示；缺失/失败/空可见列表不编造真实总数。其他资金指标按其来源capability展示。未返回服务器新统计或扩大权限。
- 加第三个真实HTTP响应回放字段mask浏览器case后发现空currency导致Intl RangeError、工作台启动失败；格式缺失现在显示“金额不可见”，合法货币保持既有格式。没有以清空断言掩盖异常。
- 集合过滤不改变既有list分页接口；无授权来源返回既有null/空数组，不无依据全量403。有能力/公司范围/不限字段角色的完整商业与法务闭环保持通过；父字段与独立legal字段分别校验。

## VERIFICATION

| 层级                   | 实际结果                                                                                                                                                                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Unit/route             | app39/39；全部Web最终110/110，lint/typecheck/build PASS                                                                                                                                                                                        |
| PostgreSQL / Real HTTP | authorization19/19 native server+session guard+RBAC+SQL；targeted59/59含route39和既有legal PG1                                                                                                                                                 |
| Full local             | 350/350 pnpm ci:local；余额一行修正后Web全部重新验证，完整最终树随后Hosted通过                                                                                                                                                                 |
| Browser                | 新增权限3/3 PASS：无legal、完整legal、字段masked；API response replay，明确不是浏览器直连生产                                                                                                                                                  |
| Hosted CI              | [37855253180](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/37855253180)，quality job113577763369，head e33e414；完整350/350（API158、Web110、shared82），install/format/guard/70 migrations/lint/type/build/audit全部成功 |
| 合并预览回归           | 最终a83c933真实完整414/414；后续Batch4整合浏览器26/26，包括原21、auth2、authz3                                                                                                                                                                 |
| Human/production UAT   | NOT VERIFIED；物理库存/生产/发运新增完整业务夹具仍未验收                                                                                                                                                                                       |

开发途中一次format检查碰到尚未解决的文档merge冲突，恢复后完整重跑通过；浏览器最初未设置既有临时库路径缺libnspr4，复用此前已解包runtime libraries后执行；masked case的真实页面异常已修，最终0新增失败/0skip。没有安装/升级项目依赖或系统软件。版本Node24.19、pnpm10.33.4、Vitest3.2.6、PG17.7、Playwright1.62.1；Hosted Node24.13按已有CI。

## RISKS / NEXT

main/production仍9d89c7d，权限修复未生效。无migration或生产设置变更；严格字段策略会减少可见时间线信息。先review33/31/32，再对齐34到确切main并重新Hosted，不能把34合并到CI-only分支。READY_FOR_PR=YES，READY_FOR_PRODUCTION_RELEASE=NO；独立人工approval仍未取得。

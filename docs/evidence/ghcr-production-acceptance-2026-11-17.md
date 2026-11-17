# GHCR生产发布验收 — 2026-11-17

状态：**正式部署及技术验收通过**。Actions deploy 于 2026-11-17 19:14:00（Asia/Singapore，UTC 11:14:00）完成；主机状态于 UTC 11:13:38 写 DEPLOYED，随后主协调及独立审查复核实况。

## 发布身份与主证据

- 应用/镜像源码SHA：`45605d37e462801927a50d0ef6f97aea7b7d13c3`；固定控制SHA：`fbf7b7a802b61d789985b6d6fea4b4d788669999`。应用仍复用原批准镜像，没有重建或改回主机源码构建。
- 正式运行：[44070050685](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/44070050685)，validate/verify/deploy均success；实际builtAt=`application-44070050685-1`。
- 修复集成：[PR47](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/47)、[PR48](https://github.com/ivanzhao299/kingturf-bessiness-os/pull/48) 均已合并。精确源码8d92572本地ci:local退出0，[PR CI](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/44066642334)与[控制面主线CI](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/44068484102)均success。
- 原镜像发布：[42335784132](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/42335784132)；本次完整重跑候选CI、源run/tag摘要、真实OCI导入与原smoke脚本至末尾，未复用一份旧绿绕过候选门禁。

## 实际API/Web字节身份

生产Docker29.5.1/linux-amd64/containerd。批准GHCR根索引、选中平台manifest、原始config及每层字节在OCI布局逐descriptor核sha256/size；目标单平台docker save重导出原config核其字节哈希，并核RootFS diff IDs。运行容器引用、Docker image ID及ImageManifestDescriptor和该链逐项匹配。containerd的image ID可等于根索引，config摘要另验，不把二者混作同一身份。

### API

- GHCR批准根：`sha256:18685f7a1070fdd4ef983da1d83140377eabcd630e1aaedc0c842bd218159d61`
- linux/amd64 manifest：`sha256:d813583ba43679c186122ea32f449e86be3092323bd4ba51afa9e00cb0cfec2c`
- 原始config：`sha256:8e17abd47eabd69854c3a575f77328571d7636965f23c5cbc63a6d6123045ed3`
- 实际容器：`bb7f9bf43ee9ca22f30b97be5f9162262079a2d1ebe46baba0ee21a33a80fc6b`
- 实际引用：`127.0.0.1:15432/kingturf-erp-api@sha256:18685f7a1070fdd4ef983da1d83140377eabcd630e1aaedc0c842bd218159d61`
- 实际Docker image ID：`sha256:18685f7a1070fdd4ef983da1d83140377eabcd630e1aaedc0c842bd218159d61`；18个diff IDs全等；healthy。

### WEB

- GHCR批准根：`sha256:229eecf8bc6ed257a94a7fe5fac1320283591f15a862ab271c8bf6865d490130`
- linux/amd64 manifest：`sha256:2461e313bbe694a9cb5b99e9b468a8d62d70af2bbbeea243adacb23a0b5d1492`
- 原始config：`sha256:a2eacf3d1ebe404d1f4e524a32d2112aa44d042388e9805748b887b11d38fb06`
- 实际容器：`897922e521342e8c1e4c7c2e4a28624a03ebeba93d9eb79c8d09ffe93d344a94`
- 实际引用：`127.0.0.1:15432/kingturf-erp-web@sha256:229eecf8bc6ed257a94a7fe5fac1320283591f15a862ab271c8bf6865d490130`
- 实际Docker image ID：`sha256:229eecf8bc6ed257a94a7fe5fac1320283591f15a862ab271c8bf6865d490130`；10个diff IDs全等；healthy。

## 72项登记、恢复与运行验收

- 生产前后完整72行name/checksum/**原applied_at**逐行完全相等；分类FULLY_MATCHED。旧迁移state解析内容和当前原始文件sha256均与发布前映射全等。新路径没有调用migration execute、没有重置/覆盖旧迁移状态。生产API以production只读启动校验运行。
- PostgreSQL容器ID和image均未变化；API/Web容器才发生切换。内部HTTP、生产主机HTTPS、GitHub Runner外部探针及主协调外部HTTPS health/ready/version全部通过，marker与应用SHA一致。
- 原API恢复image `sha256:c3f7d1d104c767770a1ade161f497e062d92c109f8e8ee871ecc021d04eb71ac` 和原Web恢复image `sha256:3e5ff2c608449ef29229e81ba232fbf6706cd150be319fd58d4cacf8c829844a` 仍可本地inspect；原10件恢复材料逐件sha/size/mode保持。
- 停API排空后采集数据库/附件/配置三件联合恢复材料，均从创建即私有、最终0600；PG同版本network-none/tmpfs隔离容器完整pg_restore --exit-on-error成功，登记含原时间戳全等。生产库只经只读登记核验；恢复演练在独立临时库。

- `.release-backups/application-44070050685-1.attachments.tar`：225280 bytes，`sha256:113a8cee399fedecea7a2524c708598db778f533a84628e000d5bae87590220b`。
- `.release-backups/application-44070050685-1.config.tar`：10240 bytes，`sha256:ad0891eb8f728b02e6f59298ee00e10a920950e5e3b5bdf1a1a4a4a83d2c4099`。
- `.release-backups/application-44070050685-1.dump`：1434095 bytes，`sha256:a58c066d8ae44fbe5dcb69d2f4ed6a21911c2fde4dea384b8e390fb2e7c63591`。

- 制品祖先和本run目录均root:root0700，旧环境快照及私有状态均0600；data filter丢弃源UID/GID，避免控制脚本被归档属性改为其他UID可写。现场三控制脚本哈希与fbf7b7a Git对象已由独立审查再次复算全等。
- 发布后再次实际导出/核验运行镜像字节；ss确认15432无监听，临时registry已关；本run的隔离restore容器已移除。所有恢复镜像和文件保留，未执行prune/历史材料清理。
- 持久配置记录固定loopback仓库及原根digest；未来重建前从保留bundle再次验证/导入，compose用--pull never。registry无需常驻。

## 真实失败史与隔离验证

- 历史run42335884296完成72迁移后，Runner拉取成功、host load有输出，但repo@digest inspect失败。GHCR最初用于绑定不可变制品与批准/回退证据；私有拉取拒绝是后来的集成问题。
- 本次本地04b0612及3ba4201两轮CI因运行期间源码/文档变更被干净树护栏拒绝，日志保留，未计作绿；后续精确冻结head完整CI才计数。
- 正式首轮[44062257356](https://github.com/ivanzhao299/kingturf-bessiness-os/actions/runs/44062257356)完整候选CI/来源/OCI导入成功，smoke因缺必需配置未监听，deploy skipped。独立Docker重放旧环境实际得到ATTACHMENT_STORAGE_ADAPTER is required；补齐参数后原脚本SHA0e6a66512141d3b452f7aceda3b2722a8f6836231a0a523a799e6dc689e7a10c直接Bash入口完整退出0，再通过第二次正式运行。
- Classic与containerd跨daemon正向分发、真实Docker篡改层拒绝、缺/截断blob与缺平台失败、containerd停API后过期授权拒绝并实际恢复旧应用、随后完整成功切换均已实际验证。root隔离提取试验丢弃伪造UID12345及0777属性且字节不变。

## 证书限定维护

- 用户另行明确授权仅ERP证书续期及共享Nginx平滑reload。原证书于2026-11-15过期，新证书到期2027-02-15T08:26:14Z，SAN仍仅erp.kingturf.cn。nginx -t后reload，53份Nginx文件哈希保持；同机其他11个域基线全同。reload后首个即时ERP断言未过，后续完整复测与外部HTTPS均PASS，失败保留。
- 实际服务端/磁盘叶证书SHA256同为 `b843c55005601dfd7f4f53f387f373e636b9edc5007a4095e5803df9ba040f0d`。共享certbot.timer仍failed/resources，两个其他域的旧过期证书未扩修。

## 证据位置与残余限制

- Actions artifact：`application-recovery-evidence`（含transport/runtime/deployment/authorization/postcheck）；主机私有完整证据位于 `/data/kingturf-erp/.release-image-recovery/44070050685-1/`；保留原始bundle以供离线导入。
- 工作区外 `ghcr-recovery-evidence-20261117/` 保留production-before/after、旧材料哈希、当前迁移state字节哈希、源码参考哈希、现场复核、失败日志、原脚本完整演练、acceptance-summary及Actions原始证据；这些快照过滤了环境秘密和业务数据。私有recovery-compose/recovery-env/config归档仅在生产主机，不上传仓库或Actions。
- 独立代码复核、独立脱敏数据交叉复核和固定Git对象到现场哈希复算均PASS；原协调会话另行独立复查公网及完整72登记。此证据不是伪造的人类审批签名。
- 既有main保护和production审批/分支限制实际未启用；本次未修改/绕过平台设置。root/Docker管理员仍是共享主机信任边界。
- 原10材料中9件历史权限0644，保留原状；本次新增三件0600。历史本机访问控制另记TD-REL-003，不把“已保留”误称“旧材料均私有”。共享续期定时器和其他域证书另行治理，技术部署通过不关闭这些债项。
- 既有业务岗位试运行准入继续按产品化验收记录办理，本次没有更改其判定。

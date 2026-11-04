# Batch8 非生产性能与恢复基线

本记录只针对隔离环境，未使用生产数据库、附件、账号或配置。

## 数据库恢复演练

- 来源容器：PostgreSQL 17.7，隔离数据库 `kingturf_b8_test`。
- 备份：`pg_dump -Fc`，文件 1,048,999 bytes，SHA256 `29c54f282d8878a57fda1398b4c0898975cf6edc278240814a41109c1104245f`。
- 恢复：全新 PostgreSQL 17.7 容器和空数据库 `kingturf_b8_restore`。
- 恢复后 `db:status`：退出码 0；71 个迁移 applied/matched，最新 `0071_inventory_stock_resource_guards.sql` checksum 一致。

本次证明了数据库备份、恢复和迁移状态可核验；未包含附件目录、外部密钥引用、生产配置和完整业务数据，因此 `ISOLATED_RESTORE=PARTIAL_DATABASE_ONLY`，不能宣称灾备完成或满足 RPO/RTO。

## 有界性能基线

使用独立 PostgreSQL 17.7 容器运行 pgbench scale 1，4 clients、2 threads、10 秒：

- 实际事务：9,046。
- 失败事务：0（0.000%）。
- TPS：904.57（不含初始连接）。
- 平均延迟：4.422 ms。
- 初始连接：3.183 ms。
- 容器采样：CPU 0.02%，内存约 48.18 MiB / 31.26 GiB。

这是数据库基准，不代表业务 API、浏览器或真实岗位吞吐，也没有正式并发目标。正式性能 SLA、数据规模和容量目标仍需负责人根据服务器条件确认，当前状态为 `BASELINE_ONLY`。

## 运维差距

附件/配置恢复、后台任务压测、API P95/P99、锁等待告警、备份失败告警和值班责任人尚未完成。不得将本基线作为生产发布或试运行准入证据。

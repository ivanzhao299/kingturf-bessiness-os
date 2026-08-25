# KT-L19 催收、法务移交与债权证据包规格

日期：2026-08-25（Asia/Shanghai）

## 1. 业务目标

把已过期且仍有余额的应收项目转为可分工、可升级、可移交、可举证的经营案件。系统不重算或覆盖账务余额，所有金额事实继续以 `ar_open_item_balances`、回款核销和订单 360 为准。

一条完整链路为：

`逾期应收 → 建立催收案件 → 记录联系证据 → 登记付款承诺 → 履约或违约 → 申请法务移交 → 独立法务受理/退回 → 生成不可变债权证据包 → 结案`

## 2. 范围

### 本任务包含

- 按逾期天数、余额、客户和责任人排序的催收队列。
- 一个应收项目最多存在一个非终态催收案件。
- 电话、邮件、函件、会议、上门等跟进事件的不可变记录。
- 付款承诺金额、到期日及履约/违约事件。
- 催收人员发起法务移交，法务人员独立受理或退回。
- 债权证据包清单、来源引用、生成快照、缺失项和 SHA-256 摘要。
- Order 360 中的催收、承诺、法务和证据包分区及时间线。
- 原子权限、职责分离、审计、幂等、并发和生产角色 UAT。

### 本任务不包含

- 自动发送律师函、自动起诉或连接法院系统。
- 直接修改应收余额、核销记录、合同或 POD。
- 将 AI 建议直接转换为法律决定。
- 删除、覆盖或重新生成已冻结的证据包版本。

## 3. 事实口径

- 原始金额：`ar_open_items.original_amount`。
- 当前余额：`ar_open_item_balances.remaining_amount`。
- 逾期日：`ar_open_item_balances.due_at`；`due_at < now()` 且余额大于零才可建案。
- 已收金额：原始金额减当前余额，不从催收案件反向写账。
- 承诺履约：只能引用已存在的 `allocation_entries`，且承诺期内核销金额达到承诺金额。
- POD：只引用 `shipment_events` 的 `DELIVERED` 证据，不复制或改写物流事实。

## 4. 状态机

### 催收案件

- `OPEN`：案件已建立。
- `CONTACTING`：已有有效跟进。
- `PROMISE_ACTIVE`：存在未到期付款承诺。
- `PROMISE_BROKEN`：承诺到期但未足额核销，或经受控复核确认违约。
- `LEGAL_PENDING`：已申请法务移交，等待独立受理。
- `LEGAL_ACCEPTED`：法务已受理。
- `RESOLVED`：应收余额为零或有足额核销证据。
- `CLOSED`：终态，必须附结案依据；法务受理案件必须已有冻结证据包。

允许转换：

- `OPEN → CONTACTING | PROMISE_ACTIVE | LEGAL_PENDING | RESOLVED`
- `CONTACTING → PROMISE_ACTIVE | LEGAL_PENDING | RESOLVED`
- `PROMISE_ACTIVE → CONTACTING | PROMISE_BROKEN | RESOLVED`
- `PROMISE_BROKEN → CONTACTING | PROMISE_ACTIVE | LEGAL_PENDING | RESOLVED`
- `LEGAL_PENDING → LEGAL_ACCEPTED | CONTACTING | PROMISE_BROKEN`
- `LEGAL_ACCEPTED → RESOLVED | CLOSED`
- `RESOLVED → CLOSED`

`CLOSED` 不可再次打开；错误只能新建纠正事件，不修改历史。

### 法务移交

- `REQUESTED → ACCEPTED | RETURNED`
- 申请人与受理/退回人必须不同。
- 同一催收案件同一时刻最多一个待处理移交。
- 受理后案件进入 `LEGAL_ACCEPTED`；退回时恢复到申请前的可执行催收状态。

## 5. 原子角色与职责分离

| 角色                                       | 能力                                     | 禁止能力                             |
| ------------------------------------------ | ---------------------------------------- | ------------------------------------ |
| `KT_COLLECTION_SPECIALIST` 催收专员        | 查看队列、建案、跟进、登记承诺、发起移交 | 法务受理、冻结证据包                 |
| `KT_COLLECTION_MANAGER` 催收主管           | 查看、升级、确认违约、结案复核           | 受理本人发起的法务移交               |
| `KT_LEGAL_CASE_MANAGER` 法务案件管理员     | 查看、受理/退回、生成证据包              | 建立原始催收案件、受理自己发起的移交 |
| `KT_EXECUTIVE_VIEWER` 经营管理驾驶舱查看者 | 只读催收与法务状态                       | 所有写操作                           |

硬性冲突：`KT_COLLECTION_SPECIALIST` 与 `KT_LEGAL_CASE_MANAGER` 不得分配给同一员工。服务器和数据库均拒绝申请人自受理。

## 6. 债权证据包 V1

证据包必须保存生成时的不可变清单和摘要，至少核对：

1. 客户与销售订单标识。
2. 已签合同及签署证据。
3. 应收单据、到期日、原始金额、当前余额。
4. 银行回款及核销条目。
5. 发货释放、物流轨迹与 POD（存在交付时必需）。
6. 催收跟进和付款承诺历史。
7. 法务移交申请与独立受理证据。

每项记录来源类型、来源 ID、来源时间、内容摘要和来源哈希。清单存在必需项缺失时只能生成 `INCOMPLETE` 包，不得标记 `READY`；只有 `READY` 包可支撑法务案件关闭。

## 7. 完成门槛

- 数据库迁移、守卫、索引、幂等和不可变触发器通过 PostgreSQL 测试。
- API 默认拒绝并验证允许/禁止角色路径和自受理拒绝路径。
- 前端提供队列、详情、字段化动作、缺失证据提示和状态反馈。
- Order 360 可下钻催收、承诺、法务及证据包时间线。
- 生产使用真实逾期应收验证正常催收、承诺违约、独立法务受理、完整/缺失证据包和撤权路径。
- 本地、GitHub、部署与生产运行 SHA 一致；记录回滚方案与验收证据。

# KT-L07 验收证据

日期：2026-08-16  
环境：204 预览环境，经本地隧道 `http://127.0.0.1:14331`

## 可重复种子

执行命令：

```sh
KINGTURF_ADMIN_PASSWORD='<admin password>' \
KINGTURF_CREDIT_APPROVER_PASSWORD='<credit approver password>' \
pnpm demo:seed
```

种子脚本只通过受权限、幂等和审计约束的业务 API 创建数据；固定业务编号用于重入查找，关键命令使用
稳定幂等键。连续执行两次得到同一客户、商机、报价、合同和订单 ID，未产生重复业务单据。

预览环境固定结果：

| 证据         | 值                                     |
| ------------ | -------------------------------------- |
| 客户         | `99ba4fe9-f213-4922-a8fc-90c6916f7e70` |
| 商机         | `1d3567e1-1331-4f75-b72e-601899179d62` |
| 已签发报价   | `afe4f5c3-04e5-49ad-bfc6-7fbfbe806d7a` |
| 已签合同修订 | `23ab3428-960a-4f6d-93ec-8c765ea0d749` |
| 已释放订单   | `ce00844b-890c-4e76-8681-93d8e76d96c8` |

## 三类结果与回款闭环

`pnpm demo:verify` 从服务器重新读取精确引用并断言：

- 同一已签发报价存在 `APPROVED`、`REJECTED`、`EXPIRED` 三类信用决定；
- 订单精确引用批准的信用决定、已签发报价快照和已签合同证据；
- 订单与发票金额为 CNY 950,000；
- 银行收款 CNY 500,000 已全部核销；
- 应收开放项剩余 CNY 450,000；
- 核销运行可由收款 ID 追溯，并保留规范结果哈希。

## 浏览器 E2E

执行命令：

```sh
KINGTURF_ADMIN_PASSWORD='<admin password>' pnpm e2e:p1
```

Playwright 使用系统 Chrome，在真实 204 页面执行 3 个场景：

1. 批准、拒绝、过期信用卡片及额度/敞口解释；
2. 订单、部分应收、银行收款和核销哈希；
3. 390×844 移动端可用性，并断言 P1 工作台不存在原始 JSON 请求框。

每个场景将对应工作台 PNG 作为测试附件写入 `.test-results/playwright`；失败时保留页面截图、DOM
上下文和 Playwright trace。最终实测结果：`3 passed`。

## 完整门禁

- 格式、ESLint、TypeScript、全仓构建：通过；
- 高危生产依赖审计：`No known vulnerabilities found`；
- Web 单元测试：17 项通过；
- 204 隔离 `kingturf_test` 数据库测试：24 项通过；
- 204 API 全量测试（含 PostgreSQL）：99 项通过；
- Playwright 真实页面 E2E：3 项通过。

> 后续 KT-L08 佣金验收在同一可重复场景中补录 CNY 450,000 尾款，使应收余额归零；本节保留
> KT-L07 关闭时的历史快照，当前结果见 `KT-L08_ACCEPTANCE.md`。

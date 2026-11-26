# 登录入口 CSS 预算计量与样式审计（TD-GATE-005）

> 批号 G5。分支 `fix/w1-gate-005`，基线 `main@4a93003`（代码与第十次发布 `5dc88e5` 相同），隔离工作协议。完整 `pnpm ci:local` 没有在本批跑（由主协调在集成分支上串行跑），所以代码提交一律标 `[未测试]`。本文件里凡是写「实测」的数字都来自下文列出的命令，原始日志与截图在仓库之外的本批产物目录，不入库。

## 1. 范围

1. 样式审计：登录页实际加载的样式表实测；各源文件对合并后 gzip 体积的贡献；找出运行时代码里已经没有任何元素会匹配的规则（死样式），只删能机械证明的，按组单独提交。
2. 修计量：`apps/web/scripts/check-startup-budget.mjs` 按「入口 HTML 实际静态引用的样式表 ∪ manifest 入口可达分块的 `css`」统计 CSS，JS 口径不变，并补自测。
3. 预算处置：原任务以 25,000 B 为预算，清理后仍超额时先停下报告。该停止点已执行；主协调在 `2faef99` 落盘 27,000 B 技术裁定后，用户又明确要求沿原树完成该裁定。最终计量修复与 27,000 B 阈值在同一提交落地，完整轨迹见 §7。

本批保留 `cssCodeSplit:false` 与合并 CSS 的静态链接；工作区样式拆分、`packages/ui` 公共行为与客户域旧视图 `crm/customer-records.ts`、`crm/customer360-view.ts` 的专用规则均在范围之外（CRM 归属项只列不删）。

## 2. 基线实测

基线工作树 `4a93003` 执行 `pnpm --filter @kingturf/web exec vite build`（退出 0），产物存档在本批产物目录的 `baseline/dist`。

| 项                               | 值                                                         | 怎么量的                                                                |
| -------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------- |
| 合并样式表                       | `assets/style-DlE4ctgB.css`，原始 163,132 B                | `dist/assets/` 下唯一的 `.css`                                          |
| `index.html` 静态引用的样式表    | 只有上面这一个                                             | `<link rel="stylesheet" crossorigin href="/assets/style-DlE4ctgB.css">` |
| 样式表 gzip，`gzipSync` 默认级别 | **28,659 B**                                               | 与脚本量 JS 同一方法；与第十次发布记录的生产实测 28,659 B 相同          |
| 样式表 gzip，级别 9              | 28,371 B                                                   | `gzipSync(buf, { level: 9 })`，只作参考                                 |
| 登录入口 JS gzip                 | 11,753 B                                                   | 旧脚本自己的输出                                                        |
| 旧脚本输出                       | `Login critical path: JS 11753 bytes + CSS 0 bytes (gzip)` | `node apps/web/scripts/check-startup-budget.mjs` 退出 0                 |

漏计的原因：仓库用了 `cssCodeSplit: false`，全站 CSS 合并成一个 `style-*.css`，Vite 在 manifest 里把它单列为键 `style.css`，入口条目 `index.html` 没有 `css` 字段，于是按「入口可达分块的 `css`」累计得到 0 B。

## 3. 量法

### 3.1 入口可达性

用 TypeScript 编译器 API 从 `apps/web/src/main.ts` 沿静态 `import`、`export … from`、字面量 `import()` 遍历；只类型的导入不算；排除 `test`/`tests`/`spec`/`fixtures` 目录与 `*.test.*`、`*.spec.*`、`*.d.ts`；裸说明符 `@kingturf/ui` 按 `packages/ui/package.json` 的 `exports` 接到 `packages/ui/src/index.ts`。

- 运行时代码文件 356 个，从 `main.ts` 可达 320 个，非字面量动态导入 0 处；测试文件 66 个，不进语料。
- 不可达的 36 个：31 个只导出类型的 `*-ports.ts` / `*types.ts`；3 个已退役的 vanilla 视图 `crm/customer-records.ts`、`crm/customer360-view.ts`、`crm/lead-records.ts`；另 2 个 `governance/tenant-settings.ts`、`shared/document-connector-services.ts`。
- 16 个 CSS 源文件的导入方全部可达。

### 3.2 贡献表口径

用工作树自带的 Vite（JS API，`build.write: false`，不写盘）按 `apps/web/vite.config.ts` 在内存里重建两遍：一遍不加任何东西，产物必须与 `dist` 里的样式表逐字节相同（相同，才算内存重建等价）；一遍给每个 CSS 模块末尾追加一条互不相同的标记规则，在合并产物里按序定位 16 个标记，得到每个源文件的片段边界。不带标记时 16 个片段首尾相接盖满全文（产物末尾有 Vite 追加的一个换行），说明跨文件没有规则合并，边界精确。

三种口径，不可相加成总体（gzip 的字典在文件之间共享）：

- 源文件原始字节、源文件单独 gzip：看每个文件「自己有多大」。
- 合并产物内片段字节、片段单独 gzip：看压缩后每个文件「自己占多少」。
- 剔除重压：`gzip(合并全文) − gzip(合并全文去掉该片段)`，看拿掉这个文件「总体能降多少」。16 个剔除值之和为 28,037 B，而整体为 28,659 B；边际贡献不具可加性。全部贡献表统一使用 gzipSync 默认级别 6。每个片段先按字符边界切割，再编码为 UTF-8；标记去除后的整串与 dist 逐字节相同。

### 3.3 死样式判定

一条规则「死」的判据：它的每个选择器都含有至少一个「必选类名」，而这个类名在运行时不可能出现在任何元素上。

- 必选类名：选择器里不在 `:not()`、`:is()`、`:where()`、`:has()` 括号内的类名。只要有一个必选类名没有任何元素能带，这个选择器就匹配不到任何元素。
- 「不可能出现」要同时满足三条：
  1. 类名作为整词，在全部可达源码的字符串里零出现（字符串字面量、模板字面量的各静态片段、JSX 属性字符串都算），也不在 `apps/web/index.html` 里；
  2. 类名作为子串，在全部生产 JS 分块（`dist/assets/*.js`）里零出现——这一条兜住可达性算错的情况；
  3. 类名拼不出来：可达代码里全部 1,268 处模板与字符串拼接位点，凡是能拼出这个类名的，都必须不在类名上下文里，或者洞的取值是字面量闭集。
- 部分死规则：一条规则里有死选择器也有活选择器时，只删死选择器，保留活选择器。
- 只带元素名、属性选择器、伪类而不带类名的规则（例如 `dialog::backdrop`、`[data-state='loading']`）证明不了，一律保留。

删除不会改变任何元素的样式：从不匹配任何元素的规则本来就不参与级联。运行时也没有代码读取样式表规则（全仓 `styleSheets` / `cssRules` / `adoptedStyleSheets` / `insertRule` 零出现）。

### 3.4 动态类名逐处追定

能动态拼出类名的位点必须逐个追，否则会误删。类名上下文里的动态位点共 32 处，全部落在类名汇点的表达式内（`class=` / `className` / `el(tag, cls)` / `.className =` / `classList.*` / `setAttribute('class')`；`innerHTML` 模板里洞落在 `class="…"` 内的 0 处）。逐处结论：

- 24 处是字面量闭集，拼不出任何零引用类名：条件字面量（如 `` `nav-item${… ? ' active' : ''}` ``）、字面量表（`DIFF_CLASS`、`viewportFor()` 返回 mobile/tablet/desktop、`summaryMetrics` 与 `shell-frame` 的 tone 表、readiness 的 `step.state`）、参数（`finHostSection` 的 3 个调用点、`createConsoleHost` 的 9 个调用点及 `createLegacyCommercialPanel` 元组表传字面量；workspace/shell 的 className 赋值来自视口闭集与布尔条件；`openForm` 没有任何调用点传第 7 个参数）。
- 8 处是开放值，按模式保留：7 处 `` `state-${接口状态值.toLowerCase()}` ``（线索之外的合同、佣金、风险、质检、发货状态徽章）→ 凡以 `state-` 开头的类名一律不动；1 处 `` `tree-select-option depth-${n}` `` → 数值。

另外核对过类名的其它来路：`innerHTML` 共 11 处，7 处经 `sanitizeBusinessDocumentHtml`（它把允许标签上的全部属性都删掉，接口或用户内容带不进 `class`），其余是代码里的字面量 SVG / 打印模板；没有 SVG / HTML / JSON 资产导入；`@kingturf/ui` 只被 `apps/web` 引用。

独立复核（与探针不同的方法）：对 90 个候选逐个执行 `grep -rnwF --include='*.ts' --include='*.tsx' --include='*.html' --exclude='*.test.*' --exclude='*.spec.*' <类名> apps/web/src packages/ui/src apps/web/index.html`，再对 `dist/assets/*.js` 做子串计数。结果：构建产物命中 0；77 个在非测试源码里零出现，10 个只出现在 `crm/customer-records.ts`、`crm/customer360-view.ts`，3 个只出现在 `crm/lead-records.ts`。

## 4. 审计表与逐规则依据

以下定义位置均为基线行号。六个删除组已完成；`crm-wave` 与 `crm-wave-adjacent` 两组保留。四个 `state-*` 动态保留项不删。所有只靠属性选择器（包括 `data-route-view~=`）的规则也未据零类名引用判死。

### 各源文件对合并后 gzip 体积的贡献（基线）

合并产物 `style-DlE4ctgB.css`：原始 163,132 B，gzip（默认级别 6） 28,659 B；内存重建与 dist 逐字节相同：true；16 个片段首尾盖满：true。

| 序  | 源文件                                                         | 源文件原始 B | 源文件单独 gzip B | 合并产物内片段 B | 片段单独 gzip B | 剔除重压 Δ B |  占比 |
| --- | -------------------------------------------------------------- | -----------: | ----------------: | ---------------: | --------------: | -----------: | ----: |
| 1   | `apps/web/src/startup.css`                                     |        6,713 |             2,035 |            5,452 |           1,858 |        1,422 |  5.0% |
| 2   | `packages/ui/src/tokens.css`                                   |        2,395 |             1,108 |            1,662 |             630 |          497 |  1.7% |
| 3   | `packages/ui/src/components.css`                               |       17,064 |             4,655 |           12,496 |           2,741 |        2,097 |  7.3% |
| 4   | `apps/web/src/governance/console/console.css`                  |        2,831 |             1,007 |            2,023 |             554 |          221 |  0.8% |
| 5   | `apps/web/src/governance/governance-gov-ux.css`                |       12,735 |             2,852 |           10,279 |           1,980 |        1,461 |  5.1% |
| 6   | `apps/web/src/commercial/console/commercial-console.css`       |          575 |               419 |              287 |             165 |           35 |  0.1% |
| 7   | `apps/web/src/commercial/console/manufacturing-console.css`    |        6,260 |             1,600 |            4,802 |           1,016 |          640 |  2.2% |
| 8   | `apps/web/src/commercial/console/procurement-console.css`      |        5,871 |             2,580 |            2,149 |             564 |          310 |  1.1% |
| 9   | `apps/web/src/shared/console-notice.css`                       |          725 |               503 |              418 |             242 |           78 |  0.3% |
| 10  | `apps/web/src/commercial/console/fin-console.css`              |        2,897 |             1,281 |            1,799 |             604 |          260 |  0.9% |
| 11  | `apps/web/src/style.css`                                       |       99,839 |            20,019 |           79,079 |          16,504 |       16,214 | 56.6% |
| 12  | `apps/web/src/commercial/console/commercial-ux.css`            |       27,174 |             5,267 |           21,273 |           3,401 |        2,465 |  8.6% |
| 13  | `apps/web/src/crm/crm-ux.css`                                  |       16,323 |             3,356 |           12,537 |           2,141 |        1,331 |  4.6% |
| 14  | `apps/web/src/commercial/console/production-order-console.css` |        5,389 |             1,749 |            3,732 |             897 |          420 |  1.5% |
| 15  | `apps/web/src/commercial/console/mrp-console.css`              |        5,721 |             1,487 |            4,285 |             879 |          363 |  1.3% |
| 16  | `apps/web/src/commercial/console/procurement-ledger.css`       |        1,007 |               389 |              858 |             359 |          223 |  0.8% |
| —   | 合计                                                           |      213,519 |            50,307 |          163,131 |          34,535 |       28,037 | 97.8% |

### 各源文件贡献（终态）与基线对照

终态合并产物 `style-DcgEPQY3.css`：原始 146,172 B，gzip（默认级别 6） 25,673 B。

| 源文件                                                         | 片段 B（基线 → 终态） | 片段 gzip B（基线 → 终态） | 剔除重压 Δ B（基线 → 终态） |
| -------------------------------------------------------------- | --------------------: | -------------------------: | --------------------------: |
| `apps/web/src/startup.css`                                     |         5,452 → 5,452 |              1,858 → 1,858 |               1,422 → 1,402 |
| `packages/ui/src/tokens.css`                                   |         1,662 → 1,662 |                  630 → 630 |                   497 → 496 |
| `packages/ui/src/components.css`                               |       12,496 → 10,339 |              2,741 → 2,456 |               2,097 → 1,809 |
| `apps/web/src/governance/console/console.css`                  |         2,023 → 2,023 |                  554 → 554 |                   221 → 219 |
| `apps/web/src/governance/governance-gov-ux.css`                |       10,279 → 10,279 |              1,980 → 1,980 |               1,461 → 1,417 |
| `apps/web/src/commercial/console/commercial-console.css`       |             287 → 287 |                  165 → 165 |                     35 → 45 |
| `apps/web/src/commercial/console/manufacturing-console.css`    |         4,802 → 4,802 |              1,016 → 1,016 |                   640 → 604 |
| `apps/web/src/commercial/console/procurement-console.css`      |         2,149 → 2,149 |                  564 → 564 |                   310 → 306 |
| `apps/web/src/shared/console-notice.css`                       |             418 → 418 |                  242 → 242 |                     78 → 86 |
| `apps/web/src/commercial/console/fin-console.css`              |         1,799 → 1,799 |                  604 → 604 |                   260 → 250 |
| `apps/web/src/style.css`                                       |       79,079 → 64,276 |            16,504 → 13,811 |             16,214 → 13,456 |
| `apps/web/src/commercial/console/commercial-ux.css`            |       21,273 → 21,273 |              3,401 → 3,401 |               2,465 → 2,441 |
| `apps/web/src/crm/crm-ux.css`                                  |       12,537 → 12,537 |              2,141 → 2,141 |               1,331 → 1,307 |
| `apps/web/src/commercial/console/production-order-console.css` |         3,732 → 3,732 |                  897 → 897 |                   420 → 425 |
| `apps/web/src/commercial/console/mrp-console.css`              |         4,285 → 4,285 |                  879 → 879 |                   363 → 368 |
| `apps/web/src/commercial/console/procurement-ledger.css`       |             858 → 858 |                  359 → 359 |                   223 → 218 |
| 合计                                                           |     163,132 → 146,172 |                          — |                           — |

### 死规则分组与处置

| 分组              | 整条死规则 | 部分死规则（只删死选择器） | 死选择器总数 | 整条死规则源码字节 | 整条死规则声明数 | 涉及类名数 | 处置                                                                  |
| ----------------- | ---------: | -------------------------: | -----------: | -----------------: | ---------------: | ---------: | --------------------------------------------------------------------- |
| crm-wave          |         10 |                          7 |           21 |                957 |               35 |         10 | 只列不删（归 crm-wave：客户域旧视图专用规则）                         |
| crm-wave-adjacent |          2 |                          0 |            2 |                154 |                5 |          1 | 只列不删（零引用，但与客户 360 旧视图规则紧邻，留给 crm-wave 一并删） |
| lead-view         |          5 |                          0 |            5 |                688 |               28 |          3 | 删除（旧版线索池 vanilla 视图）                                       |
| shell-brand       |          7 |                          5 |           16 |                700 |               26 |          3 | 删除（旧版壳层品牌与导航文字标签）                                    |
| misc-orphan       |          9 |                          3 |           12 |                926 |               31 |          5 | 删除（零散孤儿规则）                                                  |
| ctr-solution      |         19 |                          4 |           23 |              1,709 |               56 |          8 | 删除（旧版 CTR / 方案 / 报价卡片 vanilla 视图）                       |
| cost-matrix       |        108 |                          2 |          156 |             13,217 |              351 |         51 | 删除（旧版成本矩阵 / 成本因子 vanilla 视图）                          |
| ui-unused         |         16 |                          1 |           17 |              2,437 |               60 |          9 | 删除（packages/ui 里没有任何组件输出的类名）                          |

### 类名证据表（零引用候选与动态保留项）

| 类名                           | 判定                      | 分组              | 定义位置（文件:行）                                                                                                            | 可达源码整词引用文件数 | 构建产物子串命中 | 不可达非测试文件中的引用 | 测试文件中的引用              |
| ------------------------------ | ------------------------- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------ | ---------------------- | ---------------- | ------------------------ | ----------------------------- |
| `attention-text`               | 已删（基线判定）          | cost-matrix       | style.css:2222                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `brand-caption`                | 已删（基线判定）          | shell-brand       | style.css:1053、style.css:3543、style.css:3870、style.css:4158、style.css:4170                                                 | 0                      | 0                | 无                       | 无                            |
| `brand-mark`                   | 已删（基线判定）          | shell-brand       | style.css:1038、style.css:3540、style.css:3958、style.css:4272                                                                 | 0                      | 0                | 无                       | 无                            |
| `console-toolbar`              | 已删（基线判定）          | ui-unused         | ui/components.css:398                                                                                                          | 0                      | 0                | 无                       | 无                            |
| `contact-card`                 | 不动（crm-wave）          | crm-wave          | style.css:219、style.css:224                                                                                                   | 0                      | 0                | crm/customer360-view.ts  | 无                            |
| `cost-calculation-ledger`      | 已删（基线判定）          | cost-matrix       | style.css:2253                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-calculation-row`         | 已删（基线判定）          | cost-matrix       | style.css:2280、style.css:2461、style.css:2540、style.css:2549、style.css:2554                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-amount`           | 已删（基线判定）          | cost-matrix       | style.css:2454                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-copy`             | 已删（基线判定）          | cost-matrix       | style.css:2143、style.css:2148                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-dialog`           | 已删（基线判定）          | cost-matrix       | style.css:2503、style.css:2506、style.css:2511、style.css:2528、style.css:2640、style.css:2644、style.css:2649                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-ledger`           | 已删（基线判定）          | cost-matrix       | style.css:2253                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-ledger-actions`   | 已删（基线判定）          | cost-matrix       | style.css:2457、style.css:2568、style.css:2575、style.css:2579                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-ledger-name`      | 已删（基线判定）          | cost-matrix       | style.css:2295、style.css:2304、style.css:2568                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-ledger-row`       | 已删（基线判定）          | cost-matrix       | style.css:2280、style.css:2435、style.css:2447、style.css:2540、style.css:2549、style.css:2554                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-ledger-source`    | 已删（基线判定）          | cost-matrix       | style.css:2295、style.css:2304、style.css:2568                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-list`             | 已删（基线判定）          | cost-matrix       | style.css:2127                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-row`              | 已删（基线判定）          | cost-matrix       | style.css:2133                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-factor-source`           | 已删（基线判定）          | cost-matrix       | style.css:2148、style.css:2152                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-action-status`    | 已删（基线判定）          | cost-matrix       | style.css:2170、style.css:2176、style.css:2179                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-audit-ledger`     | 已删（基线判定）          | cost-matrix       | style.css:2484                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-audit-row`        | 已删（基线判定）          | cost-matrix       | style.css:2488、style.css:2497、style.css:2500                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-back`             | 已删（基线判定）          | cost-matrix       | style.css:2390、style.css:2629                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-card`             | 已删（基线判定）          | cost-matrix       | style.css:2050、style.css:2060、style.css:2162、style.css:2167                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-card-heading`     | 已删（基线判定）          | cost-matrix       | style.css:2063、style.css:2069、style.css:2074                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-code`             | 已删（基线判定）          | cost-matrix       | style.css:2078                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-completeness`     | 已删（基线判定）          | cost-matrix       | style.css:2295、style.css:2304                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-count`            | 已删（基线判定）          | cost-matrix       | style.css:2038                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-detail-actions`   | 已删（基线判定）          | cost-matrix       | style.css:2394、style.css:2537、style.css:2633、style.css:2637                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-detail-heading`   | 已删（基线判定）          | cost-matrix       | style.css:2373、style.css:2381、style.css:2385、style.css:2626                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-detail-metric`    | 已删（基线判定）          | cost-matrix       | style.css:2199、style.css:2207、style.css:2211、style.css:2216、style.css:2222、style.css:2227、style.css:2615、style.css:2619 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-detail-summary`   | 已删（基线判定）          | cost-matrix       | style.css:2190、style.css:2611                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-details`          | 已删（基线判定）          | cost-matrix       | style.css:2113、style.css:2116、style.css:2124                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-filter`           | 已删（基线判定）          | cost-matrix       | style.css:2242                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-grid`             | 已删（基线判定）          | cost-matrix       | style.css:2044、style.css:2605                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger`           | 已删（基线判定）          | cost-matrix       | style.css:2253                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-actions`   | 已删（基线判定）          | cost-matrix       | style.css:2357、style.css:2568、style.css:2575、style.css:2579                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-cost`      | 已删（基线判定）          | cost-matrix       | style.css:2295、style.css:2304                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-identity`  | 已删（基线判定）          | cost-matrix       | style.css:2295、style.css:2304、style.css:2568                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-link`      | 已删（基线判定）          | cost-matrix       | style.css:2312、style.css:2329、style.css:2584                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-metric`    | 已删（基线判定）          | cost-matrix       | style.css:2199、style.css:2207、style.css:2211、style.css:2216、style.css:2222、style.css:2227、style.css:2615、style.css:2619 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-metrics`   | 已删（基线判定）          | cost-matrix       | style.css:2190、style.css:2611                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-row`       | 已删（基线判定）          | cost-matrix       | style.css:2263、style.css:2277、style.css:2280、style.css:2292、style.css:2540、style.css:2549、style.css:2554                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-state`     | 已删（基线判定）          | cost-matrix       | style.css:2333、style.css:2344、style.css:2348、style.css:2352                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-toolbar`   | 已删（基线判定）          | cost-matrix       | style.css:2231、style.css:2239、style.css:2623                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-ledger-workspace` | 已删（基线判定）          | cost-matrix       | style.css:2185、style.css:2608                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-meta`             | 已删（基线判定）          | cost-matrix       | style.css:2086                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-no-results`       | 已删（基线判定）          | cost-matrix       | style.css:2182                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-pagination`       | 已删（基线判定）          | cost-matrix       | style.css:2361、style.css:2369                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-quote-panel`      | 已删（基线判定）          | cost-matrix       | style.css:2473、style.css:2480                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-search`           | 已删（基线判定）          | cost-matrix       | style.css:2023、style.css:2033、style.css:2239、style.css:2602                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-section`          | 已删（基线判定）          | cost-matrix       | style.css:1966、style.css:2002、style.css:2008、style.css:2012、style.css:2594                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-tab-panel`        | 已删（基线判定）          | cost-matrix       | style.css:2432                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-tabs`             | 已删（基线判定）          | cost-matrix       | style.css:2409、style.css:2415、style.css:2428                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-toolbar`          | 已删（基线判定）          | cost-matrix       | style.css:2017、style.css:2598                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `cost-matrix-totals`           | 已删（基线判定）          | cost-matrix       | style.css:2090、style.css:2099、style.css:2104、style.css:2108、style.css:2591                                                 | 0                      | 0                | 无                       | 无                            |
| `ctr-evidence`                 | 已删（基线判定）          | ctr-solution      | style.css:1902、style.css:1909、style.css:3689                                                                                 | 0                      | 0                | 无                       | 无                            |
| `ctr-row`                      | 已删（基线判定）          | ctr-solution      | style.css:1610、style.css:1618、style.css:1622、style.css:1626、style.css:3685                                                 | 0                      | 0                | 无                       | 无                            |
| `ctr-specification`            | 已删（基线判定）          | ctr-solution      | style.css:1915、style.css:1922、style.css:1925、style.css:1930、style.css:1953、style.css:3693                                 | 0                      | 0                | 无                       | 无                            |
| `ctr-table`                    | 已删（基线判定）          | ctr-solution      | style.css:1607、style.css:3665                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `customer-360-content`         | 不动（crm-wave）          | crm-wave          | style.css:210                                                                                                                  | 0                      | 0                | crm/customer360-view.ts  | 无                            |
| `customer-list`                | 不动（crm-wave）          | crm-wave          | style.css:1356                                                                                                                 | 0                      | 0                | crm/customer-records.ts  | 无                            |
| `customer-row`                 | 不动（crm-wave）          | crm-wave          | style.css:157、style.css:332、style.css:1443                                                                                   | 0                      | 0                | crm/customer-records.ts  | 无                            |
| `data-table-empty`             | 已删（基线判定）          | ui-unused         | ui/components.css:216                                                                                                          | 0                      | 0                | 无                       | 无                            |
| `detail-grid`                  | 不动（crm-wave-adjacent） | crm-wave-adjacent | style.css:192、style.css:338                                                                                                   | 0                      | 0                | 无                       | 无                            |
| `detail-section`               | 不动（crm-wave）          | crm-wave          | style.css:215                                                                                                                  | 0                      | 0                | crm/customer360-view.ts  | 无                            |
| `empty-icon`                   | 不动（crm-wave）          | crm-wave          | style.css:1382                                                                                                                 | 0                      | 0                | crm/customer-records.ts  | 无                            |
| `empty-state-description`      | 已删（基线判定）          | ui-unused         | ui/components.css:483                                                                                                          | 0                      | 0                | 无                       | 无                            |
| `empty-state-icon`             | 已删（基线判定）          | ui-unused         | ui/components.css:472                                                                                                          | 0                      | 0                | 无                       | 无                            |
| `empty-state-title`            | 已删（基线判定）          | ui-unused         | ui/components.css:477                                                                                                          | 0                      | 0                | 无                       | 无                            |
| `evidence-card`                | 已删（基线判定）          | misc-orphan       | style.css:1457、style.css:4404                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `filter-empty`                 | 不动（crm-wave）          | crm-wave          | style.css:2862                                                                                                                 | 0                      | 0                | crm/customer-records.ts  | 无                            |
| `form-section-input`           | 已删（基线判定）          | ui-unused         | ui/components.css:505、ui/components.css:517、ui/components.css:521、ui/components.css:524、ui/components.css:527              | 0                      | 0                | 无                       | 无                            |
| `form-section-label`           | 已删（基线判定）          | ui-unused         | ui/components.css:496、ui/components.css:501                                                                                   | 0                      | 0                | 无                       | 无                            |
| `history-row`                  | 不动（crm-wave）          | crm-wave          | style.css:219、style.css:224、style.css:234                                                                                    | 0                      | 0                | crm/customer360-view.ts  | 无                            |
| `info-card`                    | 不动（crm-wave）          | crm-wave          | style.css:120、style.css:134、style.css:198、style.css:201、style.css:4306                                                     | 0                      | 0                | crm/customer360-view.ts  | 无                            |
| `lead-row`                     | 已删（基线判定）          | lead-view         | style.css:246                                                                                                                  | 0                      | 0                | crm/lead-records.ts      | lead-records-behavior.test.ts |
| `list-filters`                 | 不动（crm-wave）          | crm-wave          | style.css:2831                                                                                                                 | 0                      | 0                | crm/customer-records.ts  | 无                            |
| `nav-label`                    | 已删（基线判定）          | shell-brand       | style.css:1063、style.css:3543、style.css:3579、style.css:3870、style.css:3965、style.css:4158、style.css:4170                 | 0                      | 0                | 无                       | 无                            |
| `opportunity-alert`            | 已删（基线判定）          | ctr-solution      | style.css:1564                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `page-button`                  | 已删（基线判定）          | misc-orphan       | style.css:2877、style.css:2886                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `permission-note`              | 已删（基线判定）          | misc-orphan       | style.css:4106、style.css:4471、style.css:4497、style.css:4506                                                                 | 0                      | 0                | 无                       | 无                            |
| `pipeline-columns`             | 已删（基线判定）          | misc-orphan       | style.css:1531、style.css:3660                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `pipeline-summary`             | 已删（基线判定）          | misc-orphan       | style.css:1488、style.css:1590                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `queue-copy`                   | 已删（基线判定）          | lead-view         | style.css:1421                                                                                                                 | 0                      | 0                | crm/lead-records.ts      | 无                            |
| `queue-item`                   | 已删（基线判定）          | lead-view         | style.css:1407、style.css:1426、style.css:1432                                                                                 | 0                      | 0                | crm/lead-records.ts      | lead-records-behavior.test.ts |
| `quote-economics`              | 已删（基线判定）          | ctr-solution      | style.css:2755、style.css:2766                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `quote-total`                  | 已删（基线判定）          | ctr-solution      | style.css:2762                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `solution-card`                | 已删（基线判定）          | ctr-solution      | style.css:1945、style.css:1953、style.css:4740、style.css:4786                                                                 | 0                      | 0                | 无                       | 无                            |
| `state-approved`               | 待核实（动态）            | —                 | style.css:1640                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `state-inline`                 | 待核实（动态）            | —                 | style.css:2333、style.css:2352                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `state-rejected`               | 待核实（动态）            | —                 | style.css:1650                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `state-submitted`              | 待核实（动态）            | —                 | style.css:1645                                                                                                                 | 0                      | 0                | 无                       | 无                            |
| `tree-select-expand`           | 已删（基线判定）          | ui-unused         | ui/components.css:591                                                                                                          | 0                      | 0                | 无                       | 无                            |
| `tree-select-item`             | 已删（基线判定）          | ui-unused         | ui/components.css:570、ui/components.css:580、ui/components.css:583、ui/components.css:586、ui/components.css:591              | 0                      | 0                | 无                       | 无                            |

### 死规则清单（按组，文件:行号为基线行号）

清单中的「零匹配」是基线审计判定；`crm-wave`、`crm-wave-adjacent` 两组全部保留，其余六组已删除所列零匹配选择器。「同条活选择器」在每组中均保留原声明。

**crm-wave**

```text
style.css:120-126  零匹配： .info-card   同条活选择器： .metric , .panel
style.css:134-139  零匹配： .info-card span   同条活选择器： .metric span , .muted
style.css:157-167  零匹配： .customer-row
style.css:198-200  零匹配： .info-card
style.css:201-205  零匹配： .info-card strong
style.css:210-214  零匹配： .customer-360-content
style.css:215-218  零匹配： .detail-section h3
style.css:219-223  零匹配： .contact-card , .history-row   同条活选择器： .timeline-item
style.css:224-233  零匹配： .contact-card span , .contact-card p , .history-row span , .history-row time   同条活选择器： .timeline-item time
style.css:234-238  零匹配： .history-row   同条活选择器： .timeline-item
style.css:332-334  零匹配： .mobile .customer-row
style.css:1356-1360  零匹配： .customer-list   同条活选择器： .lead-pool
style.css:1382-1392  零匹配： .empty-state .empty-icon
style.css:1443-1445  零匹配： .customer-row
style.css:2831-2836  零匹配： .list-filters
style.css:2862-2865  零匹配： .filter-empty
style.css:4306-4314  零匹配： .info-card   同条活选择器： .metric , .panel , .commercial-panel , .production-order-card
```

**crm-wave-adjacent**

```text
style.css:192-197  零匹配： .detail-grid
style.css:338-340  零匹配： .mobile .detail-grid
```

**lead-view**

```text
style.css:246-253  零匹配： .lead-row
style.css:1407-1414  零匹配： .queue-item
style.css:1421-1425  零匹配： .queue-copy
style.css:1426-1431  零匹配： .queue-item small
style.css:1432-1442  零匹配： .queue-item b
```

**shell-brand**

```text
style.css:1038-1048  零匹配： .brand-mark
style.css:1053-1059  零匹配： .brand-caption
style.css:1063-1069  零匹配： .nav-label
style.css:3540-3542 @media (max-width: 1023px)  零匹配： .tablet .brand-mark
style.css:3543-3549 @media (max-width: 1023px)  零匹配： .tablet .brand-caption , .tablet .nav-label   同条活选择器： .tablet .brand , .tablet .nav-text , .tablet .sidebar-footer span:not(.online-dot)
style.css:3579-3584 @media (max-width: 639px)  零匹配： .mobile .nav-label   同条活选择器： .mobile .brand-lockup , .mobile .sidebar-toggle , .mobile .sidebar-footer
style.css:3870-3876 @media (min-width: 640px)  零匹配： .sidebar-collapsed .brand-caption , .sidebar-collapsed .nav-label   同条活选择器： .sidebar-collapsed .brand , .sidebar-collapsed .nav-text , .sidebar-collapsed .sidebar-footer span:not(.online-dot)
style.css:3958-3961  零匹配： .brand-mark
style.css:3965-3969  零匹配： .nav-label
style.css:4158-4164 @media (max-width: 1020px) and (min-width: 640px)  零匹配： .tablet .brand-caption , .tablet .nav-label   同条活选择器： .tablet .brand , .tablet .nav-text , .tablet .sidebar-footer span:last-child
style.css:4170-4176 @media (max-width: 1020px) and (min-width: 640px)  零匹配： .tablet.sidebar-collapsed .brand-caption , .tablet.sidebar-collapsed .nav-label   同条活选择器： .tablet.sidebar-collapsed .brand , .tablet.sidebar-collapsed .nav-text , .tablet.sidebar-collapsed .sidebar-footer span:last-child
style.css:4272-4274  零匹配： .brand-mark
```

**misc-orphan**

```text
style.css:1457-1461  零匹配： .evidence-card   同条活选择器： .production-order-card
style.css:1488-1493  零匹配： .pipeline-summary
style.css:1531-1537  零匹配： .pipeline-columns
style.css:1590-1592 @media (max-width: 720px)  零匹配： .pipeline-summary
style.css:2877-2885  零匹配： .page-button
style.css:2886-2889  零匹配： .page-button:disabled
style.css:3660-3664 @media (max-width: 639px)  零匹配： .mobile .pipeline-columns
style.css:4106-4109  零匹配： .permission-note
style.css:4404-4410  零匹配： .evidence-card
style.css:4471-4479  零匹配： .permission-note   同条活选择器： .status-badge
style.css:4497-4501  零匹配： .permission-note   同条活选择器： .status-badge.success
style.css:4506-4509  零匹配： .permission-note
```

**ctr-solution**

```text
style.css:1564-1571  零匹配： .opportunity-card .opportunity-alert
style.css:1607-1609  零匹配： .ctr-table
style.css:1610-1617  零匹配： .ctr-row
style.css:1618-1621  零匹配： .ctr-row > div:first-child
style.css:1622-1625  零匹配： .ctr-row strong
style.css:1626-1629  零匹配： .ctr-row > div:first-child span
style.css:1902-1908  零匹配： .ctr-evidence
style.css:1909-1914  零匹配： .ctr-evidence summary
style.css:1915-1921  零匹配： .ctr-specification
style.css:1922-1924  零匹配： .ctr-specification dt
style.css:1925-1929  零匹配： .ctr-specification dd
style.css:1930-1932  零匹配： .ctr-specification dd.changed
style.css:1945-1952  零匹配： .solution-card
style.css:1953-1955  零匹配： .solution-card .ctr-specification
style.css:2755-2761  零匹配： .quote-card .quote-economics   同条活选择器： .quote-card .eyebrow , .quote-card .version-pin , .quote-card .quote-lines , .quote-card .quote-actions
style.css:2762-2765  零匹配： .quote-total
style.css:2766-2771  零匹配： .quote-economics
style.css:3665-3668 @media (max-width: 639px)  零匹配： .mobile .ctr-table
style.css:3685-3688 @media (max-width: 639px)  零匹配： .ctr-row
style.css:3689-3692 @media (max-width: 639px)  零匹配： .ctr-evidence   同条活选择器： .ctr-actions
style.css:3693-3695 @media (max-width: 639px)  零匹配： .ctr-specification
style.css:4740-4753  零匹配： .solution-card   同条活选择器： .decision-card , .quote-card , .qtc-card , .order-360-card , .production-order-card , .risk-card
style.css:4786-4794 @media (max-width: 639px)  零匹配： .solution-card   同条活选择器： .decision-card , .quote-card , .qtc-card , .order-360-card , .production-order-card , .risk-card
```

**cost-matrix**

```text
style.css:1966-1974  零匹配： .cost-matrix-section
style.css:2002-2007  零匹配： .cost-matrix-section > .pipeline-heading
style.css:2008-2011  零匹配： .cost-matrix-section > .pipeline-heading h3 , .cost-matrix-section > .pipeline-heading p
style.css:2012-2016  零匹配： .cost-matrix-section > .pipeline-heading p
style.css:2017-2022  零匹配： .cost-matrix-toolbar
style.css:2023-2032  零匹配： .cost-matrix-search
style.css:2033-2037  零匹配： .cost-matrix-search:focus
style.css:2038-2043  零匹配： .cost-matrix-count
style.css:2044-2049  零匹配： .cost-matrix-grid
style.css:2050-2059  零匹配： .cost-matrix-card
style.css:2060-2062  零匹配： .cost-matrix-card > p
style.css:2063-2068  零匹配： .cost-matrix-card-heading
style.css:2069-2073  零匹配： .cost-matrix-card-heading > div
style.css:2074-2077  零匹配： .cost-matrix-card-heading strong
style.css:2078-2085  零匹配： .cost-matrix-code
style.css:2086-2089  零匹配： .cost-matrix-meta
style.css:2090-2098  零匹配： .cost-matrix-totals
style.css:2099-2103  零匹配： .cost-matrix-totals > div
style.css:2104-2107  零匹配： .cost-matrix-totals span
style.css:2108-2112  零匹配： .cost-matrix-totals strong
style.css:2113-2115  零匹配： .cost-matrix-details
style.css:2116-2123  零匹配： .cost-matrix-details summary
style.css:2124-2126  零匹配： .cost-matrix-details[open] summary
style.css:2127-2132  零匹配： .cost-factor-list
style.css:2133-2142  零匹配： .cost-factor-row
style.css:2143-2147  零匹配： .cost-factor-copy
style.css:2148-2151  零匹配： .cost-factor-copy span , .cost-factor-source
style.css:2152-2155  零匹配： .cost-factor-source
style.css:2162-2166  零匹配： .cost-matrix-card .inline-actions
style.css:2167-2169  零匹配： .cost-matrix-card .inline-actions button
style.css:2170-2175  零匹配： .cost-matrix-action-status
style.css:2176-2178  零匹配： .cost-matrix-action-status.pending
style.css:2179-2181  零匹配： .cost-matrix-action-status.error
style.css:2182-2184  零匹配： .cost-matrix-no-results
style.css:2185-2189  零匹配： .cost-matrix-ledger-workspace
style.css:2190-2198  零匹配： .cost-matrix-ledger-metrics , .cost-matrix-detail-summary
style.css:2199-2206  零匹配： .cost-matrix-ledger-metric , .cost-matrix-detail-metric
style.css:2207-2210  零匹配： .cost-matrix-ledger-metric:last-child , .cost-matrix-detail-metric:last-child
style.css:2211-2215  零匹配： .cost-matrix-ledger-metric span , .cost-matrix-detail-metric span
style.css:2216-2221  零匹配： .cost-matrix-ledger-metric strong , .cost-matrix-detail-metric strong
style.css:2222-2226  零匹配： .cost-matrix-ledger-metric.attention strong , .cost-matrix-detail-metric.attention strong , .attention-text
style.css:2227-2230  零匹配： .cost-matrix-ledger-metric.success strong , .cost-matrix-detail-metric.strong strong
style.css:2231-2238  零匹配： .cost-matrix-ledger-toolbar
style.css:2239-2241  零匹配： .cost-matrix-ledger-toolbar .cost-matrix-search
style.css:2242-2252  零匹配： .cost-matrix-filter
style.css:2253-2262  零匹配： .cost-matrix-ledger , .cost-factor-ledger , .cost-calculation-ledger
style.css:2263-2276  零匹配： .cost-matrix-ledger-row
style.css:2277-2279  零匹配： .cost-matrix-ledger-row:last-child
style.css:2280-2291  零匹配： .cost-matrix-ledger-row.header , .cost-factor-ledger-row.header , .cost-calculation-row.header
style.css:2292-2294  零匹配： .cost-matrix-ledger-row:not(.header):hover
style.css:2295-2303  零匹配： .cost-matrix-ledger-identity , .cost-matrix-completeness , .cost-matrix-ledger-cost , .cost-factor-ledger-name , .cost-factor-ledger-source
style.css:2304-2311  零匹配： .cost-matrix-ledger-identity small , .cost-matrix-completeness small , .cost-matrix-ledger-cost small , .cost-factor-ledger-name small , .cost-factor-ledger-source small
style.css:2312-2328  零匹配： .cost-matrix-ledger-link
style.css:2329-2332  零匹配： .cost-matrix-ledger-link:hover , .cost-matrix-ledger-link:focus-visible
style.css:2333-2343  零匹配： .cost-matrix-ledger-state span   同条活选择器： .state-inline
style.css:2344-2347  零匹配： .cost-matrix-ledger-state.attention span
style.css:2348-2351  零匹配： .cost-matrix-ledger-state.ready span
style.css:2352-2356  零匹配： .cost-matrix-ledger-state.success span   同条活选择器： .state-inline.success
style.css:2357-2360  零匹配： .cost-matrix-ledger-actions
style.css:2361-2368  零匹配： .cost-matrix-pagination
style.css:2369-2372  零匹配： .cost-matrix-pagination button
style.css:2373-2380  零匹配： .cost-matrix-detail-heading
style.css:2381-2384  零匹配： .cost-matrix-detail-heading h3 , .cost-matrix-detail-heading p
style.css:2385-2389  零匹配： .cost-matrix-detail-heading h3
style.css:2390-2393  零匹配： .cost-matrix-back
style.css:2394-2408  零匹配： .cost-matrix-detail-actions
style.css:2409-2414  零匹配： .cost-matrix-tabs
style.css:2415-2427  零匹配： .cost-matrix-tabs button
style.css:2428-2431  零匹配： .cost-matrix-tabs button.active
style.css:2432-2434  零匹配： .cost-matrix-tab-panel[hidden]
style.css:2435-2446  零匹配： .cost-factor-ledger-row
style.css:2447-2449  零匹配： .cost-factor-ledger-row:last-child
style.css:2454-2456  零匹配： .cost-factor-amount
style.css:2457-2460  零匹配： .cost-factor-ledger-actions
style.css:2461-2472  零匹配： .cost-calculation-row
style.css:2473-2479  零匹配： .cost-matrix-quote-panel
style.css:2480-2483  零匹配： .cost-matrix-quote-panel h4
style.css:2484-2487  零匹配： .cost-matrix-audit-ledger
style.css:2488-2496  零匹配： .cost-matrix-audit-row
style.css:2497-2499  零匹配： .cost-matrix-audit-row:last-child
style.css:2500-2502  零匹配： .cost-matrix-audit-row strong
style.css:2503-2505  零匹配： .form-dialog.cost-factor-dialog
style.css:2506-2510  零匹配： .cost-factor-dialog .entity-form
style.css:2511-2520  零匹配： .cost-factor-dialog .dialog-heading , .cost-factor-dialog .form-section-heading , .cost-factor-dialog .full-width , .cost-factor-dialog .operation-warning , .cost-factor-dialog .operation-confirmation , .cost-factor-dialog .form-error , .cost-factor-dialog .form-progress , .cost-factor-dialog .dialog-actions
style.css:2528-2535  零匹配： .cost-factor-dialog .dialog-actions
style.css:2537-2539 @media (max-width: 800px)  零匹配： .cost-matrix-detail-actions
style.css:2540-2548 @media (max-width: 800px)  零匹配： .cost-factor-ledger-row , .cost-calculation-row , .cost-matrix-ledger-row
style.css:2549-2553 @media (max-width: 800px)  零匹配： .cost-factor-ledger-row.header , .cost-calculation-row.header , .cost-matrix-ledger-row.header
style.css:2554-2559 @media (max-width: 800px)  零匹配： .cost-factor-ledger-row > * , .cost-calculation-row > * , .cost-matrix-ledger-row > *
style.css:2568-2574 @media (max-width: 800px)  零匹配： .cost-factor-ledger-name , .cost-factor-ledger-source , .cost-factor-ledger-actions , .cost-matrix-ledger-identity , .cost-matrix-ledger-actions
style.css:2575-2578 @media (max-width: 800px)  零匹配： .cost-factor-ledger-actions , .cost-matrix-ledger-actions
style.css:2579-2583 @media (max-width: 800px)  零匹配： .cost-factor-ledger-actions button , .cost-matrix-ledger-actions button
style.css:2584-2588 @media (max-width: 800px)  零匹配： .cost-matrix-ledger-link
style.css:2591-2593 @media (max-width: 800px)  零匹配： .cost-matrix-totals
style.css:2594-2597 @media (max-width: 800px)  零匹配： .cost-matrix-section > .pipeline-heading
style.css:2598-2601 @media (max-width: 800px)  零匹配： .cost-matrix-toolbar
style.css:2602-2604 @media (max-width: 800px)  零匹配： .cost-matrix-search
style.css:2605-2607 @media (max-width: 800px)  零匹配： .cost-matrix-grid
style.css:2608-2610 @media (max-width: 800px)  零匹配： .cost-matrix-ledger-workspace
style.css:2611-2614 @media (max-width: 800px)  零匹配： .cost-matrix-ledger-metrics , .cost-matrix-detail-summary
style.css:2615-2618 @media (max-width: 800px)  零匹配： .cost-matrix-ledger-metric:nth-child(2) , .cost-matrix-detail-metric:nth-child(2)
style.css:2619-2622 @media (max-width: 800px)  零匹配： .cost-matrix-ledger-metric:nth-child(-n + 2) , .cost-matrix-detail-metric:nth-child(-n + 2)
style.css:2623-2625 @media (max-width: 800px)  零匹配： .cost-matrix-ledger-toolbar
style.css:2626-2628 @media (max-width: 800px)  零匹配： .cost-matrix-detail-heading
style.css:2629-2632 @media (max-width: 800px)  零匹配： .cost-matrix-back
style.css:2633-2636 @media (max-width: 800px)  零匹配： .cost-matrix-detail-actions
style.css:2637-2639 @media (max-width: 800px)  零匹配： .cost-matrix-detail-actions button
style.css:2640-2643 @media (max-width: 800px)  零匹配： .form-dialog.cost-factor-dialog
style.css:2644-2648 @media (max-width: 800px)  零匹配： .cost-factor-dialog .entity-form
style.css:2649-2653 @media (max-width: 800px)  零匹配： .cost-factor-dialog .dialog-actions
```

**ui-unused**

```text
ui/components.css:216-220  零匹配： .data-table .data-table-empty
ui/components.css:398-407  零匹配： .console-toolbar
ui/components.css:472-476  零匹配： .empty-state .empty-state-icon
ui/components.css:477-482  零匹配： .empty-state .empty-state-title
ui/components.css:483-488  零匹配： .empty-state .empty-state-description
ui/components.css:496-500  零匹配： .form-section .form-section-label
ui/components.css:501-504  零匹配： .form-section .form-section-label .required
ui/components.css:505-516  零匹配： .form-section .form-section-input
ui/components.css:517-520  零匹配： .form-section .form-section-input:focus
ui/components.css:521-523  零匹配： .form-section .form-section-input[aria-invalid='true']
ui/components.css:524-526  零匹配： .form-section .form-section-input::placeholder
ui/components.css:527-535  零匹配： select.form-section .form-section-input   同条活选择器： .form-section select
ui/components.css:570-579  零匹配： .tree-select .tree-select-item
ui/components.css:580-582  零匹配： .tree-select .tree-select-item:last-child
ui/components.css:583-585  零匹配： .tree-select .tree-select-item:hover
ui/components.css:586-590  零匹配： .tree-select .tree-select-item[aria-selected='true']
ui/components.css:591-600  零匹配： .tree-select .tree-select-item .tree-select-expand
```

终态重新扫描：658 个必选类名，643 个有引用、4 个动态保留、11 个零引用候选；11 个全在 CRM 归属的保留清单里。`style.css` 规则 869 → 721，`components.css` 规则 103 → 87；合计删除 164 条整条规则及 15 条规则中的死选择器，共 229 个选择器。压缩产物按「上下文 + 选择器 + 声明块」机械对照：1,856 → 1,627 对，新增 0、存活声明改变 0、非预期删除 0。

七个 `@keyframes` 均有 CSS 引用，未删。四个没有内部 `var()` 引用的公共令牌定义（`--kt-color-surface-raised`、`--kt-z-drawer`、`--kt-drawer-width`、`--kt-toolbar-height`）保留，未把无内部引用等同于可删除公共令牌。

## 5. 提交与文件职责

| 提交      | 主题（均为 Conventional Commits，均标 `[未测试]`）                       | 组                                                                    | 本组后 CSS gzip B | 相对上一组 B |
| --------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------: | -----------: |
| `351cd88` | refactor(web): drop unreferenced cost matrix styles TD-GATE-005          | 成本矩阵，108 整条 + 2 部分，156 选择器                               |            26,681 |       −1,978 |
| `d947dd9` | refactor(web): drop unreferenced legacy quote and CTR styles TD-GATE-005 | CTR／方案／报价，19 + 4，23 选择器                                    |            26,407 |         −274 |
| `69573e8` | refactor(web): drop unreferenced UI class rules TD-GATE-005              | UI 孤儿类，16 + 1，17 选择器                                          |            26,147 |         −260 |
| `8235bc9` | refactor(web): drop unreferenced shell branding styles TD-GATE-005       | 旧品牌标签，7 + 5，16 选择器                                          |            25,943 |         −204 |
| `6313992` | refactor(web): drop unreferenced shared view styles TD-GATE-005          | 零散共享旧视图，9 + 3，12 选择器                                      |            25,792 |         −151 |
| `4af49bf` | refactor(web): drop unreferenced legacy lead styles TD-GATE-005          | 旧线索行，5 条，5 选择器                                              |            25,673 |         −119 |
| `861ee16` | fix(web): count static startup stylesheets TD-GATE-005                   | HTML ∪ manifest 去重计量、27,000 B 技术裁定、自测与根 guardrails 接线 |            25,673 |            0 |

代码文件：

- `apps/web/src/style.css`：删除五个应用样式组，保留 CRM 归属规则；CSS 声明不重写为新的视觉取值。
- `packages/ui/src/components.css`：删除九个没有任何生产组件输出的类名规则，保留所有活规则；组件 TSX、API、默认交互行为均未改。
- `apps/web/scripts/check-startup-budget.mjs`：从 HTML 提取静态 stylesheet，和 manifest 的入口静态依赖 CSS 做归一化去重并集；JS 静态图算法不变。先输出两个实测值，再执行断言。对缺文件、无法在本地计量的外部资源明确失败。
- `scripts/analysis/startup-budget.test.mjs`：13 个 Node 自测，真实 CLI 子进程读取独立夹具；包括「entry 没有 css、HTML 有静态链接」、重叠／不同集合的并集、缺文件、延迟分块排除、JS 共享分块去重、两项预算失败与工作区泄漏。
- 根 `package.json`：仅在 `test:release-guardrails` 末尾追加上述 Node 自测，没有增加依赖或改锁文件。

文档作为最后一个独立 docs 提交：本证据、`docs/index.md` 的一行收录、`docs/GATES.md` 第 10 步 build 检查名格、技术债台账顶部本批小节及 TD-GATE-005 整行内的状态单元格。未修改其他台账行或该行其余列。

## 6. 验证与原始证据

产物根目录：`/home/jinhuit/Kingturf/kingturf-coord/wave1/gate-005-artifacts`（下文简称 A）。所有连接串经环境变量传入，未写入仓库、文档或日志。专用 CI 库实际名为 `w1_gate_005_test`（容器预置名称，任务书文字为 `w1_gate005_test`），位于本批 5442 实例；已向主协调报告名称差异。e2e 自建库为 `w1_gate005_test_e2e`。

### 6.1 定向门禁

六组删除提交各自运行下表；计量修复提交再次运行（G7）。重活通过 `/home/jinhuit/Kingturf/kingturf-coord/bin/heavy`，Web 全量限制 `--maxWorkers=4`。每步独立退出码与完整日志在 `A/logs/gates-g1…g7-*.log`，汇总在 `gates-g1…g7.txt`。

| 实际命令                                                           | G1…G6                | 计量修复 G7          | 关键数                                                    |
| ------------------------------------------------------------------ | -------------------- | -------------------- | --------------------------------------------------------- |
| `pnpm format:check`                                                | 每组 0               | 0                    | 格式一致                                                  |
| `pnpm doc:lint`                                                    | 每组 0               | 0                    | docs 收录与台账主表结构通过                               |
| `pnpm structure:check`                                             | 每组 0               | 0                    | 强制违规 0，白名单 30，G5 精确限期豁免 0                  |
| `pnpm lint`                                                        | 每组 0               | 0                    | API 现有两条 unused-eslint-disable warning，未修          |
| `pnpm typecheck`                                                   | 每组 0               | 0                    | 全包类型检查通过                                          |
| `heavy pnpm --filter @kingturf/web exec vitest run --maxWorkers=4` | 每组 0               | 0                    | 65 文件、1,024 例                                         |
| `heavy pnpm --filter @kingturf/ui test`                            | G3 为 0              | 无新 UI 改动，不重复 | 9 文件、101 例                                            |
| `heavy pnpm --filter @kingturf/web build`                          | 每组 0               | 0                    | 终态 JS 11,753 B、CSS 25,673 B；唯一 CSS 静态引用守卫通过 |
| `heavy pnpm test:release-guardrails`                               | 未修改根接线前未重复 | 0                    | 保留原链，末尾新增计量 13 例                              |

G1…G6 的旧预算脚本仍打印 CSS 0 B；上表 CSS 实测来自独立 gzip／选择器核对工具，不能把当时 build 退出 0 表述为真实 25KB 预算通过。G7 修复后脚本真实打印 25,673 B，并按主协调裁定的 27,000 B 断言。根 guardrails 的 Node 六组分别 32／48／63／26／75／13 例，合计 257 例全部通过；Python 发布演练 145 例通过，整条命令退出 0。G7 汇总回执为 `A/logs/gates-g7-run.log`；文档收尾的格式与链接检查另存 `A/logs/docs-final-checks.log`。

G3 首次队列在旧 heavy 脚本里固定等 slot-1，其他槽释放也不前进；当时测试日志为 0 字节、尚未开测。我仅结束自己的等待任务（没有测试结果，不能记绿），保留此前五项通过记录；重新用 heavy 排队后 Web／UI／build 实跑退出 0。主协调随后修复共享 helper 的所有槽轮询。没有结束其他会话进程或绕过闸。

### 6.2 真浏览器

使用任务书指定 `scripts/e2e-local/e2e-local.mjs` 与 Docker 官方 Playwright `v1.62.1-noble`，容器 `e2e-harness-gate005`。`up --skip-build` 使用已在干净基线上构建的产物，退出 0。

基线命令 `heavy node scripts/e2e-local/e2e-local.mjs walk --viewport <desktop|1024x768|mobile> --out A/e2e/walk-baseline`，三档各退出 0，分别 45/45 条路由；类名普查每档另开 21 个详情抽屉，三档合计观察到 499 个类名，90 个死样式候选全部未出现。静态可达性和动态来源检查才是删除的主要证据，普查只是交叉佐证。

每组还运行登录页截图探针（`A/probe/login-shots.mjs`）与下表路由子集，视口 1440×900、1024×768、390×844。每个 walk 均退出 0，所选路由全部到达，无页面异常／接口失败。登录页有预期的未登录会话 GET 401，三档基线和新构建相同，不计为回归。

| 组  | `--routes`                                                        | 每视口到达 | 截图根目录                   |
| --- | ----------------------------------------------------------------- | ---------: | ---------------------------- |
| G1  | `costing`                                                         |        1/1 | `A/e2e/walk-g1/<视口>/shots` |
| G2  | `technical-requirements,technical-solutions,quotes,opportunities` |        4/4 | `A/e2e/walk-g2/<视口>/shots` |
| G3  | `ui-kit,governance/identity`                                      |        2/2 | `A/e2e/walk-g3/<视口>/shots` |
| G4  | `overview`                                                        |        1/1 | `A/e2e/walk-g4/<视口>/shots` |
| G5  | `overview,opportunities,sales-orders`                             |        3/3 | `A/e2e/walk-g5/<视口>/shots` |
| G6  | `leads`                                                           |        1/1 | `A/e2e/walk-g6/<视口>/shots` |

登录图在 `A/e2e/login/{baseline,g1…g6}/{1440x900,1024x768,390x844}/login.png`。原始整页／抽屉图均保留。使用 Read 逐张查看原图或带标签的基线／新图对照页（`A/e2e/review-g2…g6/*.png`，manifest 逐张列出原图路径），结论来自目检：没有样式丢失，布局、徽章、表单、详情抽屉与基线保持。三档登录图像素完全相同。

旧全站 baseline 与单页 walk 的侧栏展开状态不同，不能直接宣称全页像素相同。成本页早期对照曾有 2px 高度差；随后确认 19 个 JS 资源与基线逐字节相同，在同样新上下文和导航步骤中分别使用精确基线 CSS／当前 CSS，三档成本页像素差均为 0（`A/e2e/paired-checkpoint/{1440x900,1024x768,390x844}/{baseline,current}/costing.png`；`pixels.json`）。该配对过程 6 页、页面错误和失败请求均为 0。

计量修复只改构建后的检查脚本及其自测／接线，不改产品代码。计量修复前后全部 48 个 dist 文件（其中 20 个为 JS/CSS 资源）SHA-256 完全一致，回执在 `A/logs/product-identity.json`，逐文件清单在 `product-before-measurement.json` 与 `product-after-measurement.json`，故按主协调要求没有重跑六组浏览器。

### 6.3 计量红绿与可复核探针

- 同一 13 例夹具跑旧脚本：退出 1，5 过 8 败；首条为 **`0 !== 59`**，HTML 静态样式 59 B 被漏成 0。原始日志 `A/logs/startup-budget-red.log`。
- 原 25,000 B 候选：退出 0，13/13；对真实基线／六组终态执行预算断言均退出 1，分别打印 CSS 28,659／25,673 B，证明确实抓到了存量超额（`startup-budget-green.log`、`candidate-baseline-budget.log`、`candidate-final-budget.log`）。原候选 patch 保留在 `A/measurement-candidate.patch`。
- 按 27,000 B 裁定落地后的同组自测：退出 0，13/13；超额 CSS 夹具使用 40,000 个随机字节编码，实际 gzip 超过 27,000 B，仍断言非零退出；JS 12,000 B 反例保持。日志 `A/logs/startup-budget-approved-green.log`，根接线结果见 `release-guardrails-g7.log`。
- 正式贡献表：`heavy node A/probe/css-contrib.mjs <工作树> <dist> <json> [4a93003]`，基线与终态均退出 0；JSON 的 `identityBuildEqualsDist`、`markerStrippedEqualsDist`、`segmentLengthsCoverDist` 均为 true。原始输出 `css-contrib-baseline-corrected.log` 与 `css-contrib-final.log`；初版旧口径文件保留供追溯，不作为最终数字。
- `node A/probe/dead-css.mjs <工作树> <dist> A/probe/out <标签>`：静态图、类名、动态来源、逐规则清单；基线加 `G5_CSS_REF=4a93003` 只读 Git CSS 内容，不改工作树。独立 grep 交叉结果在 `probe/out/grep-verify-all.txt`。
- `node A/probe/verify-removal.mjs <工作树> <旧 dist> <新 dist> <类名表> <输出>`：各组与总体均退出 0，总体 229 个预期删除、新增／存活声明变化／非预期删除均 0（`logs/removal-total.json`）。

## 7. 预算处置与裁定轨迹

### 7.1 原 25,000 B 下的停止点

六组终态 `style-DcgEPQY3.css` 原始 **146,172 B**，gzip **25,673 B**；JS gzip **11,753 B**。相对 28,659 B 减少 **2,986 B（10.42%）**，仍超 25,000 B **673 B**。此时没有提交计量修复或改阈值，而是向主协调提交三类方案。

下表均为 `heavy node A/probe/budget-options.mjs <工作树> A/options` 的隔离试构建（退出 0），产物不覆盖仓库 dist，日志 `A/logs/budget-options.log`、完整数据 `A/options/options.json`。未把试算当作已实施代码。

| 方案                                                      | 登录 JS gzip B | 登录 CSS gzip B | 相对六组终态的节省 | 代价与结论                                                                          |
| --------------------------------------------------------- | -------------: | --------------: | -----------------: | ----------------------------------------------------------------------------------- |
| (a1) 删除所有 CRM 归属保留规则                            |         11,753 |          25,446 |              227 B | 仍超 446 B；归 CRM 批，本分支没删                                                   |
| (a2) 同上下文、同选择器、同完整声明块的规则去重           |         11,753 |          25,668 |                5 B | 2 条规则；超出「选择器无人匹配」的本批删除口径，未实施                              |
| (a3) 同上下文／选择器／属性／值／important 的重复声明去重 |         11,753 |          25,638 |               35 B | 27 处重复声明，3 条变空规则；需独立级联复核，未实施，收益不足                       |
| (b) 仅在试构建恢复 `cssCodeSplit:true`                    |         11,769 |           1,898 |           23,775 B | 4 个 CSS 资源；JS +16 B 仍在 12KB 内，但会重新依赖动态 CSS 注入，不能只翻开关就交付 |
| (c) CSS 预算 27,000 B，保持合并静态加载                   |         11,753 |          25,673 |                0 B | 余量 1,327 B；不增加产品载荷，原 25KB 预算契约改变，需技术裁定                      |

(b) 的 4 个 CSS gzip 为 1,898／19,016／5,577／361 B。试算不包含可靠加载改造或浏览器验收，不能以此声称拆分已经修好。

### 7.2 裁定 15 的依据与本次选择

查阅本分支 `docs/` 与 Git 历史：`f8219a1`（2026-11-20）同时引入 `cssCodeSplit:false`、唯一 CSS 静态引用守卫，并把旧 4KB 阈值改成 25KB。`apps/web/vite.config.ts` 注释和该提交明确说明：多 chunk 场景中 `__vitePreload` 的 CSS 分支在真实登录流被跳过，bootstrap CSS 从未请求，生产页成为纯文本列表；合并并以 `<link>` 静态加载是当时消除故障的选择。后续文档 `crm-ux-customer-domain-2026-11-23.md` 与 `u3-mfg-1-item-console-2026-11-23.md` 继续记录合并／静态引用约束，但不能替代该根因记录。

我向主协调建议，如另开加载策略批，应显式区分登录与工作区样式，并在挂载前建立 stylesheet 链接、等待 load/error，覆盖首次登录、缓存、重登录和动态控制台路径，再调整唯一 CSS 守卫。该改造有明确代价，本批未做。

主协调在集成提交 **`2faef99` 的技术债台账顶部「登录 CSS 计量与预算的技术裁定」小节**落盘选择 (c)：保留合并 CSS 与静态 `<link>`，**真实 CSS 预算 27,000 B、JS 预算 12,000 B**。这是依任务书第 3 步的技术方案处置委托作出的主协调裁定；连接 EOF 后，用户进一步明确要求「沿原会话／原树续做 2faef99 已落盘的 27000 真实计量」，并要求单独 fix 与 docs 提交、不重复六组或浏览器。最终实施按该指令完成，现存长命令回执复用。该决定处理的是门禁预算，产品载荷不变；最终集成分支叠加其他批次后仍必须按真实计量重新过门禁。

## 8. 偏离、失败记录与未验证项

- 任务书原默认 25,000 B；在六组清理后超 673 B 时确实停报。之后按 `2faef99` 技术裁定将阈值与计量一起落地为 27,000 B，完整保留停止点和试算，未把过程改写成 25KB 已达标。
- 基线是在开工干净 `4a93003` 上、改动前直接构建并存档，没有另开临时基线工作树。后续用只读 Git CSS 内容在内存重建，逐字节一致验证通过；没有用 stash，也未操作其他会话工作树。
- 早期贡献探针试写出现过语法／API 使用错误，首版还把字符偏移误当 UTF-8 字节偏移；均修正后重新实测。最终正式表使用标记去除后逐字节一致与字节总量相等双重断言，且 gzip 级别统一为预算脚本默认 6。旧表曾用级别 9，只作历史记录。
- 早期贡献探针的部分内存构建试跑遗漏 heavy 包装；正式贡献重算、方案试构建、各组测试／build／走查均经重活闸。未以早期试跑充作正式验收。
- G3 旧 helper 的未开测队列被我结束并重新排队，已在 §6.1 区分；没有假报测试失败或通过。
- 准备 27KB patch 时第一次预检查因误改旧上下文而拒绝，未写入仓库代码；重新从原脚本生成 diff 后通过并应用。
- 没有跑完整 `pnpm ci:local`、API 全量／真库套件、P1 spec、写冒烟、Firefox／WebKit、生产访问／发布。完整集成门禁与发布归主协调；本批所有代码提交保持 `[未测试]`。
- 没有恢复 CSS 拆分或实现显式加载方案；(b) 只有构建量测。没有修改 `check-console-css.mjs`、`vite.config.ts`、AGENTS、active 计划或发布工作流，没有新增运行时依赖。
- 文档收尾首轮 `format:check` 退出 1（GATES 与台账排版），同轮 `doc:lint` 退出 0。Prettier 曾因 GATES 检查名过长而扩宽整列；已压缩第 10 步单元格文字并重新格式化，随后逐字节核对：GATES 仅该单元格变化，台账仅新增顶部小节及目标状态格，index 仅一行。首轮与最终检查结果同存 `A/logs/docs-final-checks.log`。
- API lint 两条现存 unused-eslint-disable warning 位于 `server-fastify.ts:36–37`，退出 0，该文件未改；按 R4 不顺手清理。

## 9. 新发现与资源收尾

- **G5-N1（待核实，未修）**：`scripts/e2e-local/walk.mjs:27–28` 的自定义 `宽x高@倍率` 把 `deviceScaleFactor` 放在 `preset.viewport` 内，而 `:188–189` 读取 `preset.deviceScaleFactor`，因此自定义倍率未传入浏览器 context。静态路径已确认，未做专项倍率实验。本批手机使用既有 `mobile` 预设（正确放在外层、倍率 2），平板 1024×768 为倍率 1，三档 CSS 视口没有受到该问题影响。按任务书限制只报告，不改工具或其他台账行。

原工作树执行 `node scripts/e2e-local/e2e-local.mjs down`，使用原有 `E2E_LOCAL_CONTAINER=e2e-harness-gate005`、`E2E_LOCAL_DATABASE=w1_gate005_test_e2e` 与本批输出目录，退出 0。`A/logs/e2e-down.log` 记录自有容器已删除、专用 e2e 数据库已删除；随后容器列表与数据库名查询独立复核相同。专用 PostgreSQL 容器 `w1-gate-005-pg` 继续运行，CI 库 `w1_gate_005_test` 保留；分支、工作树与全部原始日志／截图保留。没有删除其他容器或工作树，没有创建待拆除的临时基线工作树。

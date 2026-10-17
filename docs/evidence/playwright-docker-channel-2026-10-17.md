# Playwright 补跑通道核查：Docker playwright 镜像替代宿主安装 Linux Chrome（2026-10-17）

核查人：批次验收代理（响应「docker 中有 mcr playwright 镜像，能否代替安装 Linux Chrome」）。
基线：harnessing 分支 2e22837（工作树干净，核查现场已复原）。全部命令可复跑。

## 结论

**可以代替。** 本地 `mcr.microsoft.com/playwright:v1.62.1-noble` 镜像 + 容器内以 root `npx playwright install chrome` 补装 Google Chrome stable + 网关 IPv4 直访宿主 preview，可**零改动 playwright.config.ts** 地履行 Playwright 9 spec 补跑义务（channel:'chrome' 原样生效）。已端到端实测：真实 Chrome 启动、经 `KINGTURF_BASE_URL` 覆盖访问宿主 preview，冒烟 spec `1 passed (945ms)`。

## 四项匹配事实（实测）

| #   | 核查点                        | 结果                                                                                                                                                                                                                                                                                                |
| --- | ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | 版本匹配                      | 镜像 `v1.62.1-noble` 与仓库 `@playwright/test` **1.62.1 精确一致**                                                                                                                                                                                                                                  |
| 2   | 镜像内浏览器                  | 仅 Chromium 1234 / headless shell / firefox / webkit；**无 Google Chrome** → `channel:'chrome'` 不能直接跑                                                                                                                                                                                          |
| 3   | 补装可行                      | 容器用户为 **root**：`npx playwright install chrome` 退出码 0，`/usr/bin/google-chrome` 与 `google-chrome-stable` 落位（宿主 sudo 阻断不适用于容器）                                                                                                                                                |
| 4   | 网络（Docker Desktop 29.8.1） | ①`--network host` 不通（000，指向 Desktop VM 非 WSL 宿主）；②`host.docker.internal` 域名形式被 vite preview Host 校验 403；③**网关 IPv4 直访通**：`getent ahostsv4` → `192.168.65.254`，宿主 `vite preview --host 0.0.0.0`（CLI 参数，不改仓库文件），容器 `curl http://192.168.65.254:4173/` → 200 |

## 端到端冒烟（复现命令）

```bash
# 宿主：起 preview（CLI 参数，不改仓库；--allowedHosts 非 vite7 preview CLI 选项，勿用）
pnpm --filter @kingturf/web exec vite preview --port 4173 --strictPort --host 0.0.0.0

# 容器：补装 Chrome + 用仓库 config 跑（channel:'chrome'/单 worker 原样生效）
GW=$(docker run --rm --add-host=h:host-gateway mcr.microsoft.com/playwright:v1.62.1-noble getent ahostsv4 h | awk '{print $1}' | head -1)
docker run --rm --add-host=h:host-gateway -v "$PWD":/work -w /work \
  -e PLAYWRIGHT_BROWSERS_PATH=/ms-playwright -e KINGTURF_BASE_URL=http://$GW:4173 \
  -e no_proxy='*' -e NO_PROXY='*' \
  mcr.microsoft.com/playwright:v1.62.1-noble bash -c \
  "npx playwright install chrome && npx playwright test <spec> --reporter=line"
```

实测输出（5 行临时探针 `tests/e2e/zz-accept-smoke.spec.ts`，goto `/` + `#app` attached；跑后已删）：

```text
install-rc=0 /usr/bin/google-chrome /usr/bin/google-chrome-stable
Running 1 test using 1 worker
[1/1] tests/e2e/zz-accept-smoke.spec.ts:2:5 › docker chrome smoke
  1 passed (945ms)
```

## 实施注意（阶段 5 补跑时）

1. **Chrome 持久化**：`--rm` 容器内装的 Chrome 随容器丢弃。推荐 `docker commit` 固化本地 tag（如 `kingturf-e2e:pw1.62.1-chrome`），一次装、反复跑；不推荐每次重装（每次 +1-2 分钟）。
2. **网络环境**：本次容器内 `no_proxy='*'` 直连外网下载成功；若环境需代理，传 `-e https_proxy=http://<GW>:8888`（宿主代理在 127.0.0.1:8888，容器内须经网关 IP）。
3. **重 spec 前置**：p1-demo/production-readonly 等 spec 需后端 API+DB：宿主起 API（127.0.0.1:3000）后，preview 的 `/api` 代理或容器 baseURL/路由按 spec 实际依赖接线（届时按 spec 清单定，不在本核查范围）。PG 经宿主端口映射 5432，容器内以 `<GW>:5432` 可达。
4. **config 零改动契约**：本方案不改 `playwright.config.ts` 任何字符；baseURL 覆盖走 config 自带的 `KINGTURF_BASE_URL` env（既有设计）。
5. 义务登记不变：Playwright 9 spec 补跑仍为**阶段 5 终验硬前提**；本核查只解决执行通道，不免除义务本身。

## 变更历史

| 日期       | 变更                                                | 原因                                                |
| ---------- | --------------------------------------------------- | --------------------------------------------------- |
| 2026-10-17 | 建档：容器通道核查通过（四项匹配 + 端到端冒烟证据） | 解除「宿主安装 Linux Chrome」环境依赖的替代路径确认 |

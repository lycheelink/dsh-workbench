# @lycheelink/dsh-workbench

**Enterprise Agent Workbench** for DeepSeek Harness (DSH) Web UI.

## Overview

企业 Agent 工作台以"场景卡片"为入口、以交互式表单收集参数、以 Session 为执行单元的定制化工作台。它基于 DSH 插件式架构构建，是一个纯增量插件，不替换、不禁用任何官方插件。

> **阶段边界（Phase boundary）**："启动"会通过宿主 `sessionController`（web 端新建会话
> 同一个服务）**真实创建 agent 会话并注入 prompt**——会话出现在对话列表、agent 真正执行。
> 卡片配置的 agentPreset 在宿主可解析时挂载；若未安装则自动降级为默认会话继续运行，
> 控制室 stepDescription 会说明。`spawnAgent: false` 可显式关闭真启动（仅记录）。
>
> 尚未做的是：把 card 的 `agentConfig.skills` 显式挂进 preset 组合（preset 本身可带 skills，
> 但卡片级 skills 尚未透传）。

### Architecture

```
用户点击卡片 → 参数采集面板滑出（含条件子表单联动）
    → 用户填写/上传（file 字段为服务端绝对路径，启动时校验存在性）
    → 点击"启动"
    → 组装Prompt + 校验（必填/体积/服务端路径）
    → sessionController.create({sessionId, agentPreset}) 创建真实会话
    → sessionController.prompt({sessionId, content}) 注入 prompt → agent 执行
    → 控制室通过宿主 session/event 驱动会话状态
```

## Features

- **Scene Card Grid**: Responsive entry-point grid with category filtering and search
- **Dynamic Form**: Parameter collection panel with conditional field expansion (e.g., Profiling mode selects trigger different field sets)
- **Conditional Field Evaluation**: `key == 'value'` expressions dynamically show/hide sub-forms（逻辑与宿主端共享单一来源 `src/conditions.js`）
- **Session Launch**: 通过宿主 `sessionController` **真实创建 agent 会话**并注入组装好的 prompt（`spawnAgent: false` 可关闭真启动、仅记录）
- **Server-path validation**: `file` 字段是**服务端绝对路径**（如 `/mnt/share_space/profiling`），启动时逐条校验存在性
- **Control Room**: Real-time session status monitoring (created / running / awaiting decision / completed / failed)，由宿主 `session/event` 驱动；每张会话卡可删除（失败/完成直接删，运行中需两步确认，只删工作台记录不动真实会话）
- **Sidebar Entry**: "工作台" 菜单项常驻左侧栏（"工作区"上方），点击切换整页视图；侧栏折叠为窄条时保留图标入口
- **Full-page View**: 工作台以无边框整页覆盖中间对话列（非抽屉），左侧栏保持可交互，切换去会话时视图状态保留
- **Launch → Conversation**: 启动成功后关闭整页并跳到新会话的对话视图，agent 实时执行

## Built-in Scene Cards

| Card | Skill | Preset | Category |
|------|-------|--------|----------|
| 开箱寻优 | `model-oob-perf-optimize` | `model-oob-perf-optimize` | 寻优 |
| Profiling 采集 | `ascend-profiler` | `ascend-profiler` | 寻优 |
| 验证流测试 | `veriflow` | `veriflow` | 测试 |

## Installation

```bash
# Clone or copy this package into your DSH profile's node_modules
dsh plugin --profile web add @lycheelink/dsh-workbench
```

The package exposes a host typert artifact (`./typert`): the typert-loader
discovers it and registers the `workbench/*` Remote endpoints on the host. This
artifact is mandatory — without it the host never exposes any `workbench/*`
endpoint.

## Development Setup

```bash
# Symlink into the web profile:
node scripts/install-dev.mjs

# Build host (Node.js) + client (browser):
npm run build

# Test:
npm test          # requires a build first (imports lib/)
```

## Build

```bash
npm run build:host    # Build host side (src/index.js + typert/remote/descriptors → lib/)
npm run build:client  # Build client side (src/client/index.jsx → lib/client.js)
npm run build         # Build both
npm run pack:release  # Build + npm pack
```

## Static Pages + Publish

三个参数控制台（寻优参数采集台 / Profiling 参数采集台 / 验证流测试台）是**双模单文件 HTML**：既在插件内嵌运行（`src/client/artifacts/*.html`，经 `npm run sync:artifact` 从 `pages/cloudflare-pages/dist/` 同步），也独立部署在 Cloudflare Pages。**`pages/cloudflare-pages/dist/` 是唯一权威源**——改页面只改这里，然后：

```bash
npm run sync:artifact   # 刷新插件内嵌副本（幂等剥离 builder node-id 噪音）
./pages/publish.sh      # 部署 → https://dsh-workbench.pages.dev（需 pages/publish.env，勿提交）
```

`publish.sh` 支持 `--check` / `--dry-run` / `--force` / `--help`；包含发布前污染自检与发布后字节数抽查。凭证从 `pages/publish.env` 读取（模板见 `pages/publish.env.example`）。

## Publishing to npm

`@lycheelink/dsh-workbench` is published to [npm](https://www.npmjs.com/package/@lycheelink/dsh-workbench) from GitHub Actions on a version tag. Pushing a `vX.Y.Z` tag whose version equals `package.json` version triggers `.github/workflows/publish.yml`, which runs the full gate (tag ↔ version check → `npm ci` → `npm run build` → `npm test` → `npm pack` + artifact validation) and publishes the validated tarball to registry.npmjs.org with a sigstore provenance statement.

```bash
npm version patch -m "chore: release %s"  # bumps package.json + package-lock.json, creates commit + tag
# keep dsh.plugin.json version in sync (npm version does not touch it)
git push origin main
git push origin v0.1.2                     # ← this push triggers the action
```

- **dist-tag semantics**: stable versions (no `-` prerelease suffix) publish to `latest`; prereleases (e.g. `0.1.2-alpha.0`, via `npm version prerelease --preid alpha`) publish to `next`.
- The tag must equal `v{package.json.version}` exactly or the workflow aborts at the first step.
- Requires the `NODE_AUTH_TOKEN` **org-level** GitHub Actions secret — a granular npm token with **Bypass 2FA** enabled (the npm account requires 2FA for publish; CI cannot answer OTP). `--provenance` additionally requires the repo to be **public**.
- Versions must be new: npm rejects re-publishing an existing version, and the workflow refuses to move `latest` backwards.

## Slot Injections

- `shell.overlay` — Full-page workbench layer + left-sidebar "工作台" nav entry
- `settings.plugins.tab` — Card management settings page

## License

MIT

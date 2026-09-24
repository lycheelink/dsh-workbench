---
title: DSH 安装使用手册
updated: 2026-09-23
footer_source: DeepSeek Harness（DSH）安装使用手册 · v1.1
footer_applies: "@deepseek-ai/dsh 0.1.5-rc.1 · dsh web"
footer_note: 本文仅覆盖安装、使用与常见问题处理，不涉及插件开发与源码实现；全部结论基于 0.1.5-rc.1 实测验证。
---

<!--
语法说明见 dsh-tui-quick-start.md 顶部注释（同一构建器 scripts/build-doc.py，全部生成页共用词表）。
改完本文件后运行：python3 scripts/build-doc.py 重新生成；--check 校验与已提交 HTML 一致。
-->

::hero
eyebrow: DeepSeek Harness · 面向最终用户

# DSH 安装使用手册

覆盖安装、启动、插件与技能管理、MCP 接入、故障排查与安全备份。核心规则只有一条：**安装与升级都必须显式锁定版本号**——本文以 `0.1.5-rc.1` 为基线，所有命令可直接复制执行。

chips: v1.1 · 2026-09-23 · macOS / Node v22.22.2 实测

card 锁定版本 | 宿主 `@deepseek-ai/dsh@0.1.5-rc.1`；插件以 npm 精确版本或 GitHub `#commit` 哈希锁定。
card 访问方式 | 只认启动日志打印的、带 `?token=` 的完整地址；手输 `127.0.0.1:3080` 会 401。
card 生效条件 | 安装或卸载**插件**后必须重启 `dsh web`，刷新浏览器无效；**技能**则无需重启。
::

::stat
523 | 一次全局安装引入的依赖包数：约 7 分钟，期间请勿中断
12 | 已实测插件：4 个推荐 · 6 个按需 · 2 个运维（版本见 §5.3）
5 | 必守规则：锁版本 · 带 token 访问 · 装后重启 · 装后验证 · 勿装重复能力
::

## 0. 三分钟上手

四步完成从零到可用；动手前先记住本节末的五条守则。

::timeline
1. **安装** | 约 7 分钟 · 勿中断
   ```sh
   # 必须锁定版本号，不要安装最新版
   npm install -g @deepseek-ai/dsh@0.1.5-rc.1
   ```
   共引入约 523 个包，属正常现象；完成后核对 `dsh --version`（见 §2.1）。
2. **安装插件** | 无需 dsh web 运行中
   ```sh
   dsh plugin --profile web add "github:caoyiwei850/dsh-ssh-ops#6fdd0c33869dd9824860eb6295574736b8360634"
   dsh plugin --profile web add "github:lycheelink/dsh-skill-manager.git#f3703dca136bab14032dd5e1ae7d5754bbef7e1a"
   dsh plugin --profile web add "@lycheelink/dsh-workbench"
   ```
   插件清单与选择建议见 §5.3；`--profile web` 的位置有讲究（见 §5.2）。
3. **启动** | 在目标工作区目录
   ```sh
   cd ~/your-project
   dsh web
   ```
4. **打开界面** | 复制完整地址
   ```text
   dsh web: http://127.0.0.1:3080/?token=xxxxxxxxxx
   ```
   必须复制包含 `?token=` 的完整地址在浏览器打开；手动输入 `127.0.0.1:3080` 将返回 401（见 §3.2）。
::

**安装与使用五条守则**：

1. **安装时须显式指定版本号 `0.1.5-rc.1`**。当前版本迭代频繁且不稳定，请勿安装默认最新版（见 §2.1）；
2. **使用启动日志中打印的、带 `?token=` 的完整地址访问**，勿自行拼接地址（见 §3.2）；
3. **安装或卸载插件后须重启 `dsh web`**，仅刷新浏览器不起作用；
4. **插件安装后须以命令验证其已加载**，不能仅以安装无报错为准（见 §5.5）；
5. **安装插件须锁定版本**：npm 包指定精确版本号，GitHub 包附 `#` 加 commit 哈希。软件处于 0.1.x 预览阶段，版本间兼容性无法保证。

## 1. 安装前准备

装前三件事自查：Node 版本、网络、git。

### 1.1 Node.js 版本

| Node 版本 | 能不能用 |
|---|---|
| 22.19.0 及以上（22.x） | 可用（推荐） |
| 24.0.0 及以上 | 可用 |
| 22.0 ~ 22.18 | 不可用：版本过低，无法安装或运行 |
| 23.x（任何小版本） | 不可用：不支持 |

版本检查：

```sh
node -v     # 需 v22.19+ 或 v24+
npm -v
```

版本不符请先升级 Node（建议使用 nvm 或官方安装包）。

### 1.2 网络要求

安装过程需联网访问 npm 与 GitHub。建议预先配置 npm 镜像源，否则可能因网络延迟导致安装缓慢或超时。

### 1.3 安装前检查清单

> [!ok] **装前自检三项**：`node -v` 输出 v22.19+ 或 v24+；能访问 npm（可 `npm ping` 测试）；已安装 git（部分插件从 GitHub 安装时需要）。

## 2. 安装 DSH

两种路径：全局锁定版本（推荐），或 npx 临时体验。

### 2.1 全局安装（推荐）

> [!warn] **安装时务必携带版本号。**DSH 目前处于快速迭代期，新版本不稳定且可能与插件互不兼容；不带版本号会安装到最新的版本，容易遇到问题。**请统一安装 `0.1.5-rc.1`**，本文所有内容均基于该版本验证。

```sh
npm install -g @deepseek-ai/dsh@0.1.5-rc.1
```

安装成功时，终端末尾输出类似 `added 523 packages in 7m`。首次安装约需数分钟，耗时较长属正常现象，期间请勿中断。

安装完成后请核对版本号，确认实际安装版本为 `0.1.5-rc.1`：

```sh
dsh --version
# 预期输出：0.1.5-rc.1
# 若版本不符，说明未锁定，请重新执行安装命令
```

> [!note] **`dsh: command not found`？**检查 npm 全局目录是否已加入 PATH（可通过 `npm bin -g` 查看）；Windows 用户请重新打开终端后重试。

### 2.2 临时体验（不想装进系统）

```sh
npx @deepseek-ai/dsh@0.1.5-rc.1 web
```

该方式按需下载，不写入全局环境，仅适合临时试用：每次执行均需联网解析，且后续插件安装命令较长。如需长期使用，建议采用 §2.1 的全局安装方式（同样须指定版本号）。

### 2.3 卸载

```sh
npm uninstall -g @deepseek-ai/dsh
```

> [!note] 卸载不会删除用户数据（`~/.dsh` 目录，含配置、API Key 与会话记录）。如需彻底清除，见 §10。

## 3. 启动与首次使用

启动后只有一件事不能错：**用带 token 的完整地址访问**。

### 3.1 启动

```sh
cd ~/your-project      # 该目录即默认工作区
dsh web                # 默认地址 http://127.0.0.1:3080，并自动打开浏览器
```

常用参数：

| 场景 | 命令 |
|---|---|
| 换端口（3080 被占用时） | `dsh web --port 3081` |
| 让系统自动挑空闲端口 | `dsh web --port 0` |
| 不要自动弹浏览器（SSH 远程时） | `dsh web --no-open` |

> [!note] 默认情况下，服务仅监听本机回环地址（127.0.0.1），同一局域网内的其他设备无法访问。此为默认的安全策略。

### 3.2 必须使用启动日志输出的地址访问

启动后，终端会打印类似如下一行：

```text
dsh web: http://127.0.0.1:3080/?token=EXE40B9n8zI6Aq4QwWsvwyXlrCYzsuUaxSySblgtLHY
```

**请复制该完整地址在浏览器中打开。** 若直接输入 `http://127.0.0.1:3080`，将返回 `401 — dsh web authentication required; reopen the URL printed by dsh web.`。要点：

- 该 token 在首次访问时兑换为浏览器 Cookie，有效期 30 天；
- Cookie 与「地址 + 端口」绑定。若更换端口或使用其他域名/IP 访问，将再次返回 401，此时重新复制启动日志中的地址即可；
- 每次重启 `dsh web` 都会签发新的 token，原有地址随之失效；
- 使用 `--no-open` 时不会自动打开浏览器，需手动复制地址。

### 3.3 首次使用的三步配置

1. **内测声明**：首次打开会弹出内测声明，点击「继续」即可；
2. **填 API Key**：于 `Settings → Models` 的 DeepSeek 卡片中填入 Key（前往 platform.deepseek.com 创建），保存后立即生效，无需重启；
3. **选工作区**：在首页 `Choose workspace` 中选定一个目录，方可开始对话。

> [!warn] API Key 以明文形式保存于 `~/.dsh/.credentials.yaml`。设置页不回显原文，仅显示引用占位。请勿将该文件提交至版本库。

如需使用其他模型服务，可在 `Settings → Models` 中添加自定义提供方，支持任意 OpenAI 兼容接口。

## 4. 日常使用

工作区、数据落点与重启时机——日常使用的三块常识。

### 4.1 工作区

- 启动时的当前目录即为默认工作区，亦可在界面中随时切换；
- 切换项目时，建议在对应目录下启动 `dsh web`。

### 4.2 数据都存在哪

| 路径 | 内容 |
|---|---|
| `~/.dsh/.credentials.yaml` | 模型 API Key |
| `~/.dsh/settings.yaml` | 全局设置（含内测声明确认状态等） |
| `~/.dsh/profiles/web/` | Web 版的配置、插件、会话记录 |

可通过设置 `DSH_HOME` 环境变量，将整个数据目录迁移至其他路径：

```sh
export DSH_HOME=/path/to/your/dsh-home
```

### 4.3 关闭与重启

- **关闭**：在运行 `dsh web` 的终端中按 `Ctrl + C`；
- **重启**：安装或卸载插件后必须重启方可生效（仅刷新浏览器无效）。

## 5. 安装插件

安装规则、常用命令、已实测清单与生效验证。

### 5.1 安装规则

1. **锁定版本**：npm 包指定精确版本（如 `dsh-at-file@0.6.3`），GitHub 包附 commit 哈希；
2. **安装完成后须重启 `dsh web`**；
3. **安装后须验证**（§5.5）。命令执行无报错并不等同于插件已生效。

### 5.2 常用命令

| 操作 | 命令 |
|---|---|
| 装插件（npm） | `dsh plugin --profile web add dsh-at-file@0.6.3` |
| 装插件（GitHub） | `dsh plugin --profile web add "github:omdsh-dev/dsh-paste-input#cc02be15"` |
| 卸插件 | `dsh plugin --profile web remove dsh-at-file` |
| 升插件 | `dsh plugin --profile web update dsh-at-file` |
| 看装了哪些 | `dsh plugin --profile web list` |
| **验证是否生效** | `dsh --profile web --dump-config \| grep 插件名` |

> [!note] `--profile web` 须置于 `plugin` 之后、`add` 之前，位置错误会报 `unknown option`。安装失败具有原子性，失败时不会破坏已有配置，可直接重试。

### 5.3 推荐插件

> [!note] 版本基线：宿主 `0.1.5-rc.1`，下表版本均于 2026-09-10 实测可用；表中 `...` 为 `dsh plugin --profile web` 的缩写。

#### 推荐安装（低风险）

| 插件 | 功能描述 | 安装命令 |
|---|---|---|
| `dsh-plugin-check` | 插件体检，装新插件前先查一遍，避免把 DSH 搞崩 | `... add dsh-plugin-check@0.1.0` |
| `dsh-at-file` | 输入框打 `@` 搜索并引用工作区文件 | `... add dsh-at-file@0.6.3` |
| `dsh-paste-input` | Ctrl+V 粘贴 / 拖拽文件作为附件 | `... add "github:omdsh-dev/dsh-paste-input#cc02be15"` |
| `dsh-session-health` | 会话健康检查，防止历史记录损坏丢失 | `... add dsh-session-health@0.6.0` |

> [!note] 0.1.5 宿主已内置 `@` 引用能力且较为完善，安装 `dsh-at-file` 前可先评估原生功能是否满足需求。

#### 按需安装

| 插件 | 功能描述 | 安装命令 | 注意事项 |
|---|---|---|---|
| `dsh-knowledge-base` | 知识库：导入文档、目录管理、全文检索 | `... add dsh-knowledge-base@0.1.5` | — |
| `dsh-better-sidebar` | VSCode 风格侧边栏（文件树/终端/Git） | `... add dsh-better-sidebar@0.18.1` | 勿装 0.17.x（会崩）；含原生模块，可能被拦截，见 §8.1 |
| `dsh-genui` | 回复里渲染图表/表格/表单 | `... add dsh-genui@0.2.1` | 依赖 GitHub，网络不稳会超时 |
| `dsh-office` | 读写 Office 文档（docx/pdf/pptx） | `... add dsh-office@0.4.2` | — |
| `dsh-message-edit` | 编辑已发送的消息并重新生成 | `... add dsh-message-edit@0.2.3` | — |
| `dsh-skill-manager` | 设置页管理已加载的技能（含 ZIP 装技能） | `... add "git+https://github.com/lycheelink/dsh-skill-manager.git#f3703dc"` | npm 上的同名包是另一套旧实现，勿用 npm 版；**装技能的用法见 §6** |

#### 运维类

| 插件 | 功能描述 | 注意事项 |
|---|---|---|
| `dsh-ssh-ops` | SSH 运维：终端、SFTP、数据库面板、多机批量执行 | 凭据**明文**存于 `~/.dsh/.credentials.yaml`；主机指纹默认「首次连接即信任」，生产服务器建议改严格模式 |
| `deepseek-harness-auth` | 加一层密码认证 | **仅当需将 DSH 暴露至局域网/公网时才需要**（本机用不上，宿主自带 token 认证）。npm 版在 0.1.2 上有问题，需用 fork 版 |

> [!warn] **避免重复安装**：`@` 文件引用、MCP 客户端等能力已由宿主内置，重复安装将引发冲突。

### 5.4 批量安装

可将待安装插件写入清单文件 `~/dsh-plugins.list`（以 `#` 开头的行视为注释）：

```text
dsh-plugin-check@0.1.0
dsh-at-file@0.6.3
dsh-session-health@0.6.0
dsh-knowledge-base@0.1.5
github:omdsh-dev/dsh-paste-input#cc02be15
```

使用以下命令批量安装：

```sh
while read -r p; do
  [ -z "$p" ] && continue
  case "$p" in \#*) continue;; esac
  echo "→ $p"
  dsh plugin --profile web add "$p" </dev/null
done < ~/dsh-plugins.list
```

> [!danger] 末尾的 `</dev/null` 不可省略。否则部分插件的安装脚本会读取标准输入，吞掉清单中后续行，导致静默漏装。

全部安装完成后，统一重启一次 `dsh web`，再按 §5.5 验证。

### 5.5 验证插件真的生效

建议通过以下三个层面逐级验证：

```sh
# 1) 依赖层：包是否进入依赖清单
cat ~/.dsh/profiles/web/package.json

# 2) 装配层（最关键）：是否进入最终加载树
dsh --profile web --dump-config | grep -n "dsh-knowledge-base"

# 3) 功能层：于 Web UI 中人工确认
#    知识库 → 侧边栏出现入口；@ 文件 → 输入框可检索到文件；粘贴 → Ctrl+V 可贴入图片
```

| 现象 | 原因 | 处理方式 |
|---|---|---|
| 命令执行无报错，但界面无变化 | 未重启 `dsh web` | 重启 |
| `--dump-config` 中检索不到 | 该包仅为普通依赖而非可加载插件 | 以界面实际表现判断（部分插件本就不出现在加载树中） |
| 安装后 DSH 无法启动 | 插件与当前版本不兼容 | 执行 `dsh plugin --profile web remove <刚安装的包>`，切勿删除 `~/.dsh` |
| 报 `unknown option` | `--profile` 位置错误 | 见 §5.2 注意事项 |

## 6. 安装技能（Skill）

> [!note] **插件与技能是两个不同的概念**：插件为 DSH 扩展功能（通过命令行 `dsh plugin` 管理），技能则是提供给模型的任务操作指引（于设置页「技能管理」面板管理）。本节以 GitCode 上的 `model-oob-perf-optimize` 为例。

### 6.1 前置：装好技能管理器

```sh
dsh plugin --profile web add "github:lycheelink/dsh-skill-manager.git#f3703dca136bab14032dd5e1ae7d5754bbef7e1a"
```

安装完成后须重启 `dsh web`（所有插件均须重启，见 §5.1）。重启后进入 **设置 → 技能管理**，即可查看当前已加载的技能列表。

### 6.2 准备技能 ZIP

技能仓库大多托管于 GitHub 之外的平台，而插件内置的「GitHub 技能市场」仅支持 `github.com` 源，因此安装 GitCode 上的技能须采用 ZIP 方式。

GitCode 网页支持将技能目录直接导出为 ZIP，无需手动打包：

1. 浏览器打开技能目录页，例如 `https://gitcode.com/Ascend-SACT/ling/tree/main/skills/model-oob-perf-optimize/`；
2. 点击右上角的「下载当前目录」按钮（位于「下载 zip」左侧）；
3. 下载得到 `ling-main-skills-model-oob-perf-optimize.zip`，无需解压或修改目录结构即可用于安装（经实测无需登录，匿名亦可下载）。

该压缩包解压后的目录结构如下（外层额外嵌套两级路径，不影响安装）：

```text
ling-main-skills-model-oob-perf-optimize/     ← GitCode 自动加的外层：仓库-分支-路径
└── skills/
    └── model-oob-perf-optimize/              ← 插件就装这一层
        ├── SKILL.md                          ← 技能入口，缺了它装不上
        ├── README.md
        ├── asset/  design/  references/
        ├── scripts/  sdd/  system_validation/
        └── test/
```

**为何此结构可被正确识别**：插件以「包含 `SKILL.md` 的目录」作为技能根目录进行定位，外层嵌套层级无关紧要，技能名称取该目录名。经实测，将 GitCode 下载的原包直接导入后，技能名正确解析为 `model-oob-perf-optimize`，897 个文件完整落盘，`asset`、`design`、`references`、`scripts`、`sdd`、`system_validation`、`test` 等子目录均完整保留。

> [!warn] 目录地址末尾须包含斜杠（`/`）。`.../model-oob-perf-optimize` 不带 `/` 时会被站点跳转到「文件预览」页，该页面**无下载按钮**；补为 `.../model-oob-perf-optimize/` 后才会停留在目录页，右上角两个按钮方才显示。

> [!warn] 务必进入目标技能目录后再点击该按钮。该按钮下载的是「当前所在目录」：若在仓库根目录或 `skills/` 层级点击，ZIP 中将包含该层级下的全部技能（实测：包内含两个技能时，安装将一次性导入两个）。

> [!note] ZIP 体积上限为 64 MiB。技能的子目录不可省略：`SKILL.md` 中以相对路径引用了 `./references/...`、`./scripts/...` 等资源，缺失将导致技能无法运行。使用「下载当前目录」可自动包含全部子目录。

#### 备选方案：页面未提供下载按钮时

部分页面可能不提供该按钮，此时可通过命令行获取（以 `ling` 仓库为例）：

```sh
# 浅克隆并稀疏检出，仅获取该技能目录
git clone --depth 1 --filter=blob:none --sparse https://gitcode.com/Ascend-SACT/ling.git
cd ling
git sparse-checkout set skills/model-oob-perf-optimize

# 进入 skills/ 打包，确保 ZIP 根目录下即为技能目录
cd skills && zip -r model-oob-perf-optimize.zip model-oob-perf-optimize
```

Windows 环境请使用以下命令替代：

```powershell
Compress-Archive -Path model-oob-perf-optimize -DestinationPath model-oob-perf-optimize.zip
```

### 6.3 在页面里安装

1. 于 DSH 页面进入 **设置 → 技能管理**；
2. 在 **ZIP 安装** 区块点击「选择 ZIP 文件…」；
3. 选中刚下载的 `ling-main-skills-model-oob-perf-optimize.zip`，等待按钮状态变为「已安装」；
4. 列表中随即出现 **model-oob-perf-optimize**，状态为「已启用」。

技能文件保存于 `~/.dsh/skills/model-oob-perf-optimize/`，DSH 会自动识别，无需重启（仅插件需要重启）。

### 6.4 日常管理

| 操作描述 | 操作方法 |
|---|---|
| 确认已安装 | 「技能管理」列表中可见该技能且状态为「已启用」 |
| 临时停用 | 于列表中点击「停用」，实质为将 `SKILL.md` 重命名，内容不会丢失 |
| 重新启用 | 点击「启用」 |
| 查看技能全文 | 点击列表中的卡片展开 |
| 卸载 | 删除 `~/.dsh/skills/model-oob-perf-optimize/` 目录 |

> [!note] 列表中亦会显示 `~/.codex/skills`、`~/.claude/skills` 下的技能（若曾安装 Codex / Claude）。它们默认处于停用状态，不影响 DSH 使用。

### 6.5 注意事项

- **重复安装不会覆盖**：同名技能已存在时，安装将被跳过并提示冲突，内容不会更新。如需升级，须先删除 `~/.dsh/skills/<技能名>/`，再重新安装。
- **GitHub 技能市场不支持 GitCode 源**：该功能仅按 `github.com` 地址拉取，填入 GitCode 仓库坐标将无法检索到内容。来自 GitCode / Gitee 等平台的技能一律采用上述 ZIP 方式安装。

## 7. 可选：连接外部 MCP 工具

如需接入外部 MCP 服务器，编辑 `~/.dsh/profiles/web/cordis.patch.yml`，追加如下内容：

```yaml
- insert:
    - id: mcp-eval-suite
      name: '@deepseek-ai/dsh-mcp-client'
      config:
        serverName: eval-suite
        transport: streamable-http
        url: http://127.0.0.1:8900/mcp
        failOnStartupError: false
```

- 新条目须以 `insert:` 包裹，否则会报 `patch: entry not found`；
- 修改后重启 `dsh web`；
- 接入后工具名称形如 `mcp__<server>__<tool>`。

> [!warn] 该文件支持内嵌 JS 表达式，等价于可执行代码，请勿授予他人写权限；敏感信息（如密码）建议使用环境变量引用，避免硬编码。

## 8. 常见问题排查

按现象查表；表内条目均来自实测或已知 issue。

| 现象 | 原因 | 处理方式 |
|---|---|---|
| 安装失败，提示 Node 版本不符 | Node 版本低于 22.19 或为 23.x | 升级 Node |
| `dsh: command not found` | 全局命令目录未加入 PATH | 通过 `npm bin -g` 查看并加入 PATH；Windows 用户重开终端 |
| 浏览器返回 **401** | 未使用带 token 的地址，或更换过端口/域名 | 复制终端打印的 `dsh web: http://.../?token=...` 重新打开 |
| 端口 3080 被占用 | 已有实例或其他进程占用 | `dsh web --port 3081`，或 `--port 0` 由系统分配 |
| 安装插件后 DSH 无法启动 | 插件与当前版本不兼容 | `remove` 掉刚安装的包再启动，**切勿删除 `~/.dsh`** |
| 安装含原生模块的插件报 `ERR_PNPM_IGNORED_BUILDS` | 包管理器默认拦截构建脚本 | 见 §8.1 |
| 从 GitHub 源安装时超时 | 网络不稳定 | 可多次重试，或改用 `git+https://` 形式地址 |
| 点击内测声明「继续」后报 **「暂时无法保存确认状态，请重试。」** | 写入成功与否需核实 | 见 §8.2 |
| 安装插件时报 `EEXIST: symlink` 或文件被拒绝 | 在受管控的终端环境中执行（如部分 AI 工具内置的 shell） | 请改用系统自带的标准终端执行。此为执行环境限制，并非 DSH 缺陷 |
| 设置页提示「设置不可用」 | 仅可通过 localhost/127.0.0.1 访问以读写设置 | 改用 `http://127.0.0.1:3080` 访问 |
| 局域网内其他设备无法打开 / 报 Web Crypto 错误 | 明文 HTTP 不满足安全上下文要求 | 须配置 HTTPS，或通过 SSH 隧道将端口映射至本机 |

### 8.1 原生模块被拦截（`ERR_PNPM_IGNORED_BUILDS`）

安装含原生模块的插件（如 `dsh-better-sidebar`）时可能出现，处理方法如下：

```sh
cat >> ~/.dsh/profiles/web/pnpm-workspace.yaml <<'EOF'

allowBuilds:
  node-pty: true
EOF

# 随后重新执行安装命令
dsh plugin --profile web add dsh-better-sidebar@0.18.1
```

> [!warn] 放行构建即允许该插件以当前用户权限执行代码。请仅对可信插件放开，并锁定其版本。

### 8.2 「暂时无法保存确认状态，请重试。」

该报错出现在点击内测声明弹窗「继续」时（与 API Key 保存无关）。多数情况下状态已成功写入，刷新页面即可。按以下顺序排查：

```sh
cat ~/.dsh/settings.yaml
```

| 现象 | 说明 | 处理方式 |
|---|---|---|
| 包含 `welcomeNoticeVersion` | 伪失败：写入成功但页面未同步 | **刷新页面（F5）** |
| 不包含 | 确未写入 | 检查 `~/.dsh` 目录权限与磁盘空间；并确认 `~/.dsh/settings.yaml.lock` 中记录的进程号是否仍在运行，若进程已退出可安全删除该 lock 文件 |
| 以上均无效 | 页面地址非回环地址 | 改用 `http://127.0.0.1:<端口>/?token=...` 访问 |

## 9. 安全提醒与备份

默认配置按「本机单人使用」设计；要多人或跨网访问，先补齐认证与 HTTPS。

- 服务仅监听 `127.0.0.1`，外部无法访问；
- 访问需提供启动 token（§3.2）；
- 但该 token 为单一共享值，无用户名/密码，亦无操作审计。

> [!danger] **若需多人访问或将服务暴露至局域网/公网，必须先安装认证插件（如 `deepseek-harness-auth`）并配置 HTTPS。**

**需重点保护的文件**：

| 路径 | 说明 |
|---|---|
| `~/.dsh/.credentials.yaml` | API Key 明文保存，权限应设为 600，切勿提交至版本库 |
| `~/.dsh/profiles/web/cordis.patch.yml` | 用户配置文件，支持内嵌 JS 表达式，切勿放开写权限 |

**备份**（`node_modules` 无需备份，重装即可恢复）：

```sh
tar czf ~/dsh-backup-$(date +%Y%m%d).tar.gz \
  ~/.dsh/.credentials.yaml \
  ~/.dsh/profiles/web/cordis.patch.yml \
  ~/.dsh/profiles/web/package.json
```

## 10. 升级、重装与彻底删除

覆盖本体与插件的升级、修复与彻底卸载路径。

| 场景 | 操作 |
|---|---|
| 升级 DSH 本体 | 执行 `npm install -g @deepseek-ai/dsh@<版本号>`，随后逐一确认各插件在新版本上仍可正常工作 |
| 升级单个插件 | 执行 `dsh plugin --profile web update <包名>`，重启后按 §5.5 验证 |
| 升级后插件异常 | 移除该插件，重新安装原先锁定的旧版本 |
| 配置损坏无法修复时 | 先备份 `cordis.patch.yml` → 删除 `~/.dsh/profiles/web` 目录 → 重新启动将自动重建 → 重装插件 |
| 彻底卸载 | 执行 `npm uninstall -g @deepseek-ai/dsh && rm -rf ~/.dsh`（将删除凭据、配置及全部会话记录，操作前请先备份） |

> [!warn] **升级守则：单次仅变更一个组件。**先升级宿主并确认可用，再逐个升级插件，每升级一个验证一次。同时变更多个变量将导致问题难以定位。

## 11. 附录：速查

命令与路径的浓缩版，供日常翻查。

| 项 | 值 |
|---|---|
| npm 包名 | `@deepseek-ai/dsh` |
| 官方仓库 | [github.com/deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) |
| 数据目录 | `~/.dsh`（Windows：`C:\Users\<用户>\.dsh`） |
| 技能目录 | `~/.dsh/skills`（ZIP 安装的落点，见 §6） |
| 默认访问地址 | `http://127.0.0.1:3080`（需带 token，见 §3.2） |
| **本文锁定版本** | **`0.1.5-rc.1`** —— 安装时须显式指定，见 §2.1 |
| 站点头页 | [index.html](index.html) —— 插件说明与全部工具入口 |
| 姊妹篇 | [dsh-TUI Quick Start](dsh-tui-quick-start.html) —— 终端 TUI 版上手指南 |

**命令速查**

```sh
dsh --version                                   # 查看版本
dsh web                                         # 启动（默认 3080）
dsh web --port 3081 --no-open                   # 换端口且不自动打开浏览器
dsh plugin --profile web add <包>@<版本>          # 安装插件
dsh plugin --profile web remove <包>             # 卸载插件
dsh plugin --profile web list                    # 查看已安装插件
dsh --profile web --dump-config                  # 查看最终加载内容
```

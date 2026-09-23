---
title: dsh-TUI 上手
updated: 2026-09-20
footer_source: 资料库文档「dsh-TUI 上手」
footer_applies: "@deepseek-harness-tui/dsh-tui · ccch1mneyyy/dsh-TUI"
footer_note: 启用“完全访问”将放开文件系统与命令执行权限，且不再有审批拦截，请自行评估风险后使用。
---

<!--
dsh-workbench 文档源 · 由 scripts/build-doc.py 渲染成 dist/index.html（零依赖 python3）。
改完本文件后运行：python3 scripts/build-doc.py 重新生成；--check 校验与已提交 HTML 一致。

标准 markdown（优先用这些）：
  > 文本                          普通引用（.quote）
  > [!note|warn|danger|ok] 文本   提示块（GFM callout 风格，单段即可）
  > [!aside] 文本                 段落小注（灰小字）
  - 项 / - ~项                    ~ 前缀 = dash 变体列表项
  ### 3.1 标题 / ### A · 标题     前导 token 即 h3-tag（无 token 不进目录）
  ## 1. 标题                      自动编 SECTION 01；## OVERVIEW · 主线 标题 为自定义标签
  ```语言 · 标签```               代码块双段标注（· 后仅展示，运行时 Prism 自取语言）

仅无标准等价物者用指令块（:: 起 / :: 止）：
  ::hero       页面头（eyebrow: / # 标题 / 正文 / chips: / card 键 | 值）
  ::stat       数字条（每行：数字 | 描述）
  ::timeline   环节线（每项：1. **标题** | 步骤标签，缩进正文）
  ::acc        折叠面板（每项：1. **摘要**，缩进正文；首项默认展开）
  ::cmp        对比网格（col [pick] **名** [badge: x]，k: v 行 + 描述段）
  ::grid2      场景小卡（每行：tile 键 | 描述）
  ::quote 标签 带 q-label 的引用块（可含列表/多段）
-->

::hero
eyebrow: DSH · 社区 TUI 插件

# dsh-TUI 上手

本指南按「安装 → 装技能 → 启动 → 配置 → 授权 → 寻优参数配置」六个环节组织，并附「**启用完全访问 / 免审批**」说明。技能以文件复制（`cp`）方式安装；授权通过 `Shift+Tab`。

chips: @deepseek-harness-tui/dsh-tui · ccch1mneyyy/dsh-TUI

card 适用版本窗口 | dsh：`0.1.5-rc.1`，dsh-TUI 插件：`0.10.1`。
card 环境前提 | Node `^22.19` 或 `>=24`（**23.x 不支持**）· pnpm **≥ 10** · 真实交互 TTY
card 一句话心智 | DSH 技能**没有注册表文件、没有安装命令、也没有 lockfile**——`cp -R` 复制目录即完成安装。
::

::stat
6 | 上手环节：安装 → 装技能 → 启动 → 配置 → 授权 → 寻优参数配置
3 | 权限档位：默认 / 计划模式 / 完全访问
::

## OVERVIEW · 主线 全流程六个环节

六个环节依次覆盖安装、装技能、启动、配置、寻优参数配置与授权；每个环节均提供验证方式。

::timeline
1. **安装** | 安装两个全局包
   ```sh
   npm i -g @deepseek-ai/dsh @deepseek-harness-tui/dsh-tui
   ```
   以一条命令安装 dsh CLI 与 dsh-tui 插件两个全局包；pnpm 用于首次启动时初始化 profile。
2. **安装技能** | 以文件复制方式安装
   ```sh
   mkdir -p ~/.dsh/skills
   cp -R /path/to/my-skill ~/.dsh/skills/
   ```
   技能目录由宿主自动监听，无需重启，在下一次模型步骤中即生效。
3. **启动** | 首次启动自动创建 profile
   ```sh
   cd ~/your-project && dsh-tui
   ```
   在项目目录启动 dsh-tui；首次启动自动创建 profile，无需手动执行 dsh plugin add。
4. **配置模型** | 三种方式任选
   会话内通过 `/provider` 配置路由与密钥、`/model` 选择模型（首次配置推荐）；或修改 profile 补丁；或设置环境变量。
5. **启用完全访问** | 关闭审批拦截
   会话内按 `Shift+Tab` 循环至「完全访问」——即时生效，但仅作用于当前会话；如需每次启动均默认启用，见第六章。
6. **寻优参数采集** | 生成提交 SKILL 的 JSON
   用采集台（model-oob-perf-optimize-params.html）一次性采齐部署拓扑、业务建模与寻优目标，实时输出结构化 JSON，直接提交给寻优 SKILL。打开采集台：[寻优参数采集台](perf-optimize-params.html)。
::

## 1. 前置条件

安装前需满足以下四项要求，缺任一项均无法正常运行。

| 项 | 要求 | 说明 |
|---|---|---|
| Node.js | `^22.19` 或 `>=24` | **23.x 不支持**（与 dsh 本体一致） |
| pnpm | **≥ 10** | 首次启动初始化 profile 时需要。**pnpm 9 会导致启动后立即退回 shell 且几乎无报错**（issue #60） |
| 终端 | 真实交互 TTY | 不能用管道（`tee` 之类）或重定向 stdout 启动 |
| 凭证 | `DEEPSEEK_API_KEY` | 用官方端点只需这一个；自建/代理端点再加 `DEEPSEEK_BASE_URL` |

> [!warn] **本机环境提醒：**安装全局包与插件请在**普通终端**执行。受管（AI 托管）终端会拦截 pnpm 的 symlink 操作。

## 2. 安装

一条命令安装 dsh 与 dsh-tui 两个全局包。

```sh
# 1) 安装官方 CLI 与 TUI 插件（一条命令安装两个全局包）
npm install -g @deepseek-ai/dsh @deepseek-harness-tui/dsh-tui

# 2) 安装 pnpm（若尚未安装；首次启动用于初始化 profile）
npm install -g pnpm
# 或：corepack enable pnpm
```

> **版本兼容窗口：**本插件 0.10.1 的 `peerDependencies` 上界为 dsh `0.1.5-rc.1`，与 npm 上 dsh 的 latest 恰好对齐。**升级 dsh 前应先行升级 dsh-tui**，否则容易超出兼容区间。

## 3. 以文件复制方式安装技能

本章信息密度较高，且多处涉及易错操作，建议逐节阅读。

### 3.1 核心认知：技能即目录，以 cp 方式安装

DSH 技能**没有注册表文件、没有安装命令、也没有 lockfile**。宿主每次扫描固定目录，看到 `<name>/SKILL.md` 即予以收录。因此：

```sh
cp -R <技能目录> ~/.dsh/skills/     # 安装完成
```

无需 `dsh plugin add`，也无需重启（详见 3.5）。

### 3.2 两个落点

| 落点 | 路径 | 生效范围 | 优先级 rank |
|---|---|---|---|
| **用户级**（最常用） | `~/.dsh/skills/<name>/` | 所有项目 | 400 |
| **项目级** | `<项目根>/.dsh/skills/<name>/` | 仅该项目（可提交 git 共享团队） | 100 |
| 用户级（Claude 系共享） | `~/.agents/skills/<name>/` | 所有项目 | 500 |
| 项目级（Claude 系共享） | `<项目根>/.agents/skills/<name>/` | 仅该项目 | 200 |

- **rank 数值越小优先级越高**：项目级优先于用户级。
- `<项目根>` 即最近的含 `.git` 的祖先目录；**若无 `.git`，则回退至当前 cwd**。
- `~/.dsh/skills` 下的 `.system` 子目录会被**忽略**。

### 3.3 目录形态（发现深度仅一层）

```text
<root>/<name>/SKILL.md      ← 目录形态（可带 references/ scripts/ assets/）
<root>/<name>.md            ← 平铺单文件形态
```

- `<name>` 建议采用 kebab-case，即 `/skills` 中显示的名称。
- ~**不支持嵌套发现**：`<root>/a/b/SKILL.md` 不会被收录。这一点直接决定 cp 命令的写法（见下文）。

### 3.4 三种复制场景

::grid2
tile 场景 1 | 直接获得**一个技能目录**
tile 场景 2 | 获得 zip，**解压后顶层即为技能目录**
tile 场景 3 | 压缩包内**嵌套层级过深**（典型：从代码托管平台「下载当前目录」，包内为 `<repo>-<branch>-<路径…>/skills/<技能名>/`）
tile 共同点 | 最终都必须使 `~/.dsh/skills/<name>/SKILL.md` **直接可见**
::

```sh · 场景 1
mkdir -p ~/.dsh/skills
cp -R /path/to/my-skill ~/.dsh/skills/
# 结果：~/.dsh/skills/my-skill/SKILL.md
```

```sh · 场景 2
unzip -q my-skill.zip -d ~/.dsh/skills/
# 结果：~/.dsh/skills/my-skill/SKILL.md
```

```sh · 场景 3
unzip -q pkg.zip -d /tmp/pkg
find /tmp/pkg -name SKILL.md          # 定位包含 SKILL.md 的目录
cp -R /tmp/pkg/some-repo-main-skills/my-skill ~/.dsh/skills/
```

> `find` 输出中，**取 SKILL.md 所在的目录**（而非其父级或更高层目录）作为 cp 源。

::quote 本工作区内的两个 zip 恰好各对应一种场景
- `model-oob-perf-optimize.zip` → **场景 2**（顶层即为技能目录，`unzip -d ~/.dsh/skills/` 即可）
- `ling-main-skills-model-oob-perf-optimize.zip` → **场景 3**（包内为 `<repo>-<branch>/skills/<技能名>/`，需先 `find` 定位）
::

> [!danger] **覆盖升级前必须先删除旧目录**：这是 cp 方式最常见的错误：

```sh
# 错误：目标目录已存在时会形成嵌套 ~/.dsh/skills/my-skill/my-skill/SKILL.md，技能直接消失
cp -R /path/to/my-skill ~/.dsh/skills/

# 正确：
rm -rf ~/.dsh/skills/my-skill && cp -R /path/to/my-skill ~/.dsh/skills/
```

### 3.5 安装后的确认方式与生效时机

**验证步骤：**

```sh
# 1) 检查目录结构（必须直接看到 SKILL.md，中间不得再隔一层）
ls ~/.dsh/skills/my-skill/

# 2) 确认 frontmatter 包含 name 与 description
head -6 ~/.dsh/skills/my-skill/SKILL.md
```

回到会话中执行 `/skills`，在列表中查找该技能：

| 显示形态 | 含义 |
|---|---|
| `/my-skill` | `user-invocable` 为真，可直接在输入行键入 `/my-skill` 调用 |
| `my-skill`（无斜杠） | 仅模型可调用（`disable-model-invocation: true`），只能由模型自动调用 |

`/skills` 是**全量目录浏览器**（所列为模型可见技能的完整集合）；选中后按 `Enter` 仅将 `/my-skill ` **填入输入行**，不会代为执行。

::quote 生效时机
cp 属于外部文件变更，由宿主文件监视器捕获（深度 1），**下一个模型步骤刷新技能目录**，因此**无需重启**。如需立即生效，`/restart` 最为可靠。
::

**改内容 vs 改目录：**

| 改动 | 是否触发刷新 |
|---|---|
| 新增 / 改名 / 删除技能目录、改 frontmatter | **触发** |
| 改技能正文（`SKILL.md` 内文） | 不触发目录刷新；但**每次加载都会重新读取正文**，下次使用即为最新内容 |
| 改 `references/`、`scripts/`、`assets/` 下的文件 | **不触发刷新**（不影响目录结构） |

### 3.6 frontmatter 写错的后果：技能会被静默丢弃

DSH **仅识别 `name` 与 `description` 两个必填字段**，其余为可选。字段写错不会显示错误，仅表现为技能不再出现。以下为本机实测结果：

| 写法 | 结果 |
|---|---|
| 缺 `name` 或 `description` | **丢弃**（日志：`frontmatter requires name and description`） |
| 完全没有 frontmatter | **丢弃**（日志：`missing YAML frontmatter`） |
| `user-invocable: yesplease` | **丢弃**（日志：`field "user-invocable" must be a boolean`） |
| `user-invocable: yes` / `disable-model-invocation: no` | **正常收录** |
| 合法布尔写法 | `true/false`、`yes/no`、`on/off`、`1/0`（不分大小写） |

> [!note] **排错方法：**界面仅表现为技能不可见，具体原因需查看 DSH 日志。加 `DSH_TUI_DEBUG=1` 启动并观察 stderr，或检查 DSH 运行日志中是否存在 `skill file ... ignored`。

一个最小可用模板：

```markdown
---
name: my-skill
description: 一句话说清它做什么、什么时候该用（这句话决定模型会不会调用它）
---

# my-skill

（正文：执行步骤、约束、示例）
```

### 3.7 同名技能会静默冲突

实测表明：当项目级与用户级存在**同名技能时，两层均会被扫描**（rank 100 与 400 各一份），最终由注册表层按“近层遮蔽远层”的规则裁决，**仅生效其中一个，且无任何提示**。

因此应避免在不同层级放置同名技能；升级用户级技能前，须先确认项目中不存在同名副本。

## 4. 启动

进入项目目录启动 dsh-tui，首次启动自动创建 profile。

```sh
# 进入项目目录后启动（启动目录即 Agent 的默认工作区）
cd ~/your-project
dsh-tui
```

::quote 首次启动做了什么
启动时自动执行等价于 `dsh plugin --profile dsh-tui add @deepseek-harness-tui/dsh-tui`，在 `~/.dsh/profiles/dsh-tui/` 创建 profile 并写入 `cordis.patch.yml`。因此**不需要**预先手动执行 `dsh plugin add`。
::

三个等价入口：

| 命令 | 说明 |
|---|---|
| `dsh-tui` | 标准命令 |
| `dst` | 短别名 |
| `dsh --profile dsh-tui` | 长写法（等价） |

> [!warn] **dsh-tui 不在 PATH 中：**若执行 `dsh-tui` 报 `command not found`，说明安装位置未加入 PATH。以下脚本以 npm 的实际链路反推 Node 的 bin 目录并写入 `~/.bashrc`（适配 npm 本身为软链接、且 `readlink` 返回相对路径的常见场景）：

```sh
# which npm → /usr/local/bin/npm
NPM_LINK=$(which npm)
# 只解析一层软链接，拿到 /usr/share/node-linux-arm64/bin/npm
NPM_TARGET=$(readlink "${NPM_LINK}")
# 如果readlink返回相对路径，转为绝对路径
if [[ "${NPM_TARGET}" != /* ]]; then
  LINK_DIR=$(dirname "${NPM_LINK}")
  NPM_TARGET="${LINK_DIR}/${NPM_TARGET}"
fi
NODE_BIN_DIR=$(dirname "${NPM_TARGET}")
echo "第一层软链接目标：${NPM_TARGET}"
echo "目标bin目录：${NODE_BIN_DIR}"
if ! grep -qxF "export PATH=\$PATH:${NODE_BIN_DIR}" ~/.bashrc; then
  echo "export PATH=\$PATH:${NODE_BIN_DIR}" >> ~/.bashrc
  echo "已写入 ~/.bashrc"
else
  echo "PATH配置已存在"
fi
source ~/.bashrc
```

> [!ok] **验证：**`dsh-tui --version` 应有版本输出；进入会话后 `/doctor` 不应出现 FAIL；`/status` 应能显示 provider / model / cwd。

## 5. 配置模型

三种配置方式，按使用场景选择；**首次配置推荐 5.1（交互式向导）**。

### 5.1 交互式向导（推荐）

进会话后依次：

| 命令 | 作用 |
|---|---|
| `/provider` | 添加 / 编辑 / 删除模型路由 |
| `/model` | 切换模型（运行中被拒绝：回合中不可切换） |
| `/effort` | 调整推理等级，`←/→` 或 `/effort <档位>` |
| `/login` · `/balance` | 查看凭证状态 · 查询官方账户余额 |

`/provider` 里三种添加方式：

1. **内置 provider**：从 catalog 中选择（`deepseek`、`openai`、`anthropic` 等），仅需填写 API Key；可选覆盖 baseURL（用于代理网关）
2. **自定义 API 端点**：填写路由名 / Key / baseURL / 协议（`openai-completions`、`openai-responses`、`anthropic-messages`）；向导将以草稿凭据探测端点公布的模型供勾选
3. **订阅账号登录（OAuth）**：使用 ChatGPT / Claude / Grok 等订阅账号登录，**无需 API Key**（`@deepseek-harness-tui/dsh-auth` 已作为依赖随包安装）

向导写两个产物：

| 产物 | 位置 | 权限 |
|---|---|---|
| provider 路由 | `~/.dsh/settings.yaml` → `llm-pi-ai.providers.<路由名>` | — |
| API Key | `~/.dsh/.credentials.yaml`，引用名 `<路由名大写>_API_KEY` | `0600` |

与 dsh web 的 Models 设置页**互通**（同一 settings section）。会话记录中密钥仅显示为 `••••••`。

### 5.2 声明式：修改 profile 补丁

`$DSH_HOME/profiles/dsh-tui/cordis.patch.yml`（顶层为 YAML 数组）：

```yaml
- id: dsh-tui
  config:
    provider: deepseek-official
    model: deepseek-flash
    effort: max
```

四个注意点：

- **`config` 为整块替换而非深合并**：所修改字段所在的 `config` 块将被整段覆盖，原依赖 base 继承的其他字段需一并重写。
- **`provider` 与 `model` 必须同时配置**才构成显式路由；只写一个不生效。
- **修改后必须重启进程**（`/restart` 或退出重进）；`/reload` **不会**应用补丁。
- 不要在补丁中写入 `cwd: !!js process.cwd()`：这会把工作区固定于启动子目录（issue #96）。默认解析为启动目录所在的 git worktree 根，通常无需处理。

### 5.3 最简方式：环境变量

```sh
export DEEPSEEK_API_KEY=sk-xxxxxxxx
# 自建/代理端点：
export DEEPSEEK_BASE_URL=https://your-endpoint/v1
```

当进程环境已存在同名变量时，`/provider` 向导会**跳过写入，运行时直接从环境解析**（删除时亦不触碰环境变量）。适用于 CI 与临时试跑。

> **优先级：**环境变量 > profile 补丁 > `/settings`。`/model` 的持久化选择存储于 `~/.dsh-tui/model.json`；`effort` 存储于 `~/.dsh-tui/effort.json`。

## 6. 启用「完全访问」

授权工具自动执行，不再弹出审批提示。

::quote 先对齐术语
dsh-TUI 的三个权限档位中**并不存在名为“自动模式”的档位**。日常所说的“自动模式”即第三档「**完全访问**」：沙箱限制完全放开且审批关闭，工具调用不再弹出审批提示。
::

### 6.1 三个权限档位的说明

::cmp
col **默认（基础档）**
  sandbox: `workspace-write`
  approval: `ask`
  可在工作区内读写；越界操作将弹出审批。
col **计划模式**
  sandbox: `read-only`
  approval: `ask`
  仅只读探索，不修改文件、不执行命令。
col pick **完全访问** [badge: 别称：自动模式]
  sandbox: `danger-full-access`
  approval: `never`
  不受限读写，**无审批拦截**。
::

### 6.2 原理：为何切换档位后下次又恢复默认

**模式状态不保存于任何配置文件，而是由会话日志折叠推导得出**——`plan/mode`、`sandbox/mode`、`approval/policy` 三类会话事件，取最后一次生效的值。新会话不存在这些事件，因而回落到 **`modes` 数组的第 0 项（基础档）**。

由此得到两条结论：

- **Shift+Tab 与 `/permission` 仅对当前会话生效**，切换会话即恢复基础档；
- 如需让“自动”成为**每次启动的默认**，须修改配置（见 6.4）。

> [!aside] （附带效果：循环起点取自“日志推导出的档”而非存储索引，因此手动执行 `/plan` 不会导致 Shift+Tab 档位顺序错乱。）

### 6.3 方式一：会话内切换（仅作用于当前会话）

| 操作 | 说明 |
|---|---|
| **Shift+Tab** | 循环切换档位，底部提示「模式 → 完全访问」 |
| `/permission` | 打开权限预设选择器（沙箱模式与审批策略） |
| `/permission danger-full-access` | 直接切换至完全访问 |
| `/permission status` | 查看当前预设 |

### 6.4 方式二：设为每次启动的默认权限档位（长期使用推荐）

```yaml
# $DSH_HOME/profiles/dsh-tui/cordis.patch.yml
- id: dsh-tui
  config:
    provider: deepseek-official      # config 为整块替换，原有字段需一并写全
    model: deepseek-flash
    modes:
      - id: auto                     # 置于首位 = 启动即生效该档位
        label: 自动
        sandbox: danger-full-access
        approval: never
      - id: default
        plan: false
        sandbox: workspace-write
        approval: ask
      - id: plan
        plan: true
        sandbox: read-only
        approval: ask
```

要点：

- **数组顺序即 Shift+Tab 的循环顺序；第 0 项为无标记的基础档**，新会话默认落于此处。
- ~**不应保留内置的 `full` 档**：它与新增的 `auto` 档原子完全相同，匹配时永远命中靠前的条目，导致后一档在循环中成为**死档**（Shift+Tab 永远无法到达）。
- 每个条目支持 `plan` / `sandbox` / `approval` / `permission`；`permission` 可与 `plan` 并用，但与 `sandbox`、`approval` **互斥**；**未声明任何原子的条目将被丢弃**。
- 修改后通过 `/restart` 生效；`/reload` **不应用**补丁。

### 6.5 方式三：环境变量（临时，不写入磁盘）

```sh
DSH_PERMISSION_MODE=danger-full-access dsh-tui
```

非 Windows 平台以该变量覆盖沙箱策略。沙箱限制已完全放开后，不再出现需要提升权限的场景，审批自然不再弹出——适用于 CI 或一次性试跑。

### 6.6 折中方案：保留边界、关闭审批

不采用完全放开，仅关闭审批：将 6.4 中的 `auto` 档替换为：

```yaml
- id: auto
  label: 半自动
  sandbox: workspace-write     # 保留工作区边界
  approval: never              # 不再打断操作
```

### 6.7 风险与平台差异

> [!danger] **完全访问意味着模型可任意读写文件系统、执行命令，且无任何审批拦截。**配合第三方插件风险较高，建议先在容器 / VM 或专门的测试目录中验证通过后再放开。

> [!warn] **Windows 情况相反：**dsh-tui 在 Windows 的 profile 默认就是 `danger-full-access` ＋ 免审批，出厂即处于“自动档”，需主动收紧，注意安全风险。

::quote 证据来源
官方 `docs/configuration.md` 的 `modes` 字段说明 ＋ 源码 `src/sessionModes.ts`（三档原子与 `DEFAULT_SESSION_MODES`）＋ `src/dsh-adapter/channel/mode-actions.ts`（模式由会话日志折叠推导）。
::

## 7. 使用寻优参数配置（model-oob-perf-optimize）

在 dsh-TUI 完成配置与授权之后，用采集台把昇腾推理性能自动寻优所需的参数一次性采齐，实时生成可直接提交给寻优 SKILL 的结构化 JSON。

::quote 这一步解决什么
model-oob-perf-optimize 的寻优 SKILL 需要一组严格结构化的输入（部署拓扑、业务建模、寻优目标、软硬件版本等）。手工拼 JSON 易漏字段、易错格式；采集台把这些字段做成表单，实时校验并输出可直接提交的 JSON，避免来回返工。
::

### 7.1 打开配置

采集台是一个独立的单文件 HTML（`model-oob-perf-optimize-params.html`），无需后端、无需联网，双击或在浏览器打开即用。本指南在线版也附带同款入口：[打开寻优参数采集台](perf-optimize-params.html)。

三张场景卡片（开箱寻优 / Profiling 采集 / 验证流测试）还有整页统一入口——「企业 Agent 工作台」静态演示，卡片数据可通过 URL 参数或导入对话框注入：[打开企业 Agent 工作台](workbench.html)。

> [!warn] **定位提醒：**采集台只负责“采集参数并生成 JSON”，真正的寻优执行发生在目标机（昇腾环境）；采集台本身不要求运行在昇腾机器上。

### 7.2 选择运行模式

| 模式 | 确认方式 | 适用 |
|---|---|---|
| **智能模式** | 零确认，首条消息一次性解析全部字段，选择点采用默认策略 | 大多数情况；请求数量等字段必填，缺失会标 [自动补全] |
| **离线推理** | 全部字段必须由人工填写，Agent 不自行决定 | 目标机无 Agent 协助、需全人工导出配置包 |

### 7.3 填写部署拓扑（Phase 0）

选择部署形态，决定后续哪些字段必填：

- **单机标准**：自动采集 NPU，无需额外输入。
- **多机**：需填 node0 通信 IP、worker SSH 信息；拓扑 JSON 智能模式可留空（由 SKILL 推导），离线模式必填。
- **PD 分离**：需填 PD SSH 节点（多节点必填），其余（速记部署、端口、connector、proxy 等）可留空由 SKILL 推导。

### 7.4 填写业务建模（Phase 2）

描述压测负载，标 * 为必填：

| 字段 | 说明 |
|---|---|
| 测试工具 * | evalscope / vllm_benchmark / ais_bench，采集台会归一化为标准名（如 evalscope → evalscopeperf） |
| 并发数 * | 映射为 CONCURRENCY |
| 输入 / 输出长度 * | 支持固定值（4096）或范围（4096~8192） |
| 请求数量 *（智能模式） | 智能模式必填，缺失会标 [自动补全]；离线模式可留空由公式推算 |
| 测试数据集 | 默认 random；Prefix 命中率 > 0 时仅 random 支持前缀构造 |
| 测试 / 服务寻优变量 | 格式 --参数 默认值=$[min~max]（连续）/ $[min~max+step]（步长）/ $[v1,v2,...]（枚举）；留空走甩手模式由 SKILL 推导 |
| Prefix cache 命中率 | 固定常量 0~1，不参与寻优；影响测试集构造与 KV 预算推导 |

> [!warn] **ais_bench 限制：**其 input_len / output_len 不支持寻优，若填写范围，SKILL 会提示并降为固定值。

### 7.5 填写寻优需求（Phase 3）

指定模型与寻优目标：

- **模型权重路径 ***：如 /mnt/weight/llama-7b。
- **硬件要求**：留空用 Phase 0 检测值；PD/多机须含节点数（如“2节点×8张A3卡”），禁止裸集群总量。
- **寻优目标 ***：吞吐优先 / TTFT < Xms 下最大吞吐 / TPOT < Xms 且 TTFT < Yms 下最大吞吐，阈值可自定义。
- **启动 / 测试脚本、寻优变量、环境变量**：可选；留空由 SKILL 推导或保持脚本固定值。

### 7.6 离线推理：全字段人工输入（仅离线模式）

切到“离线推理”后，采集台展开独立的“全字段人工输入”区，要求逐项手填：

- **硬件信息**：npu_type、card_count（必填）；chip_count / soc_version / hbm_size_gb 留空按型号推断（A2 = 卡数，A3/A5 = 卡数×2）。
- **软件版本**：vllm_version、vllm_ascend_version、cann_version（仅数字，必填）；torch / torch_npu / transformers 可选。
- **平台微架构 9 项**：platform_l2_size_mb 等，缺省用内建默认值。
- **模型 config.json 路径 / 链接 ***：无法提供将阻断流程。

### 7.7 获取并提交结构化 JSON

右侧“实时输出”面板随表单即时更新：

- **必填项完成度**：进度条显示“已完成 / 总数”，缺失项以红色 badge 列出并支持点击跳转。
- **实时 JSON**：按当前填写生成结构化 JSON，语法高亮。
- **复制 / 下载**：“复制 JSON”得到提交给 SKILL 的纯参数；“复制触发指令”会附带模式与拓扑触发词（如“一键寻优（单机）”）；“下载 .json”存为本地文件。

```提交示例（示意）
一键寻优（单机）

{
  "mode": "智能模式",
  "topology": "单机标准",
  "business_modeling": { "tool": "evalscope", "concurrency": "64", "input_len": "4096", "output_len": "1024" },
  "optimization_requirement": { "weight_path": "/mnt/weight/llama-7b", "goal": "吞吐优先" }
}
```

把复制到的 JSON（或触发指令）直接提交给 model-oob-perf-optimize SKILL，即可进入自动寻优流程。

## 8. 速查表

集中整理全流程常用命令，供随时查阅。

```sh · 全流程
# 安装
npm install -g @deepseek-ai/dsh @deepseek-harness-tui/dsh-tui
npm install -g pnpm            # ≥10
cd ~/your-project && dsh-tui

# 配置模型（会话内）
/provider                      # 添加路由与 API Key
/model                         # 选择模型
/effort                        # 调整推理等级
/login  /balance               # 凭证 / 余额查询

# 配置模型（环境变量，最简方式）
export DEEPSEEK_API_KEY=sk-xxx
export DEEPSEEK_BASE_URL=https://your-endpoint/v1   # 可选

# 权限：授权工具自动执行、不再弹出审批提示（见第六章）
Shift+Tab                      # 会话内循环切换档位，直至完全访问
/permission danger-full-access # 或直接指定权限预设
DSH_PERMISSION_MODE=danger-full-access dsh-tui   # 临时生效（不写入磁盘）
# 永久默认：修改 cordis.patch.yml 的 modes[0]（数组第一项即基础档位）

# 安装技能（以文件复制方式）
mkdir -p ~/.dsh/skills
cp -R /path/to/my-skill ~/.dsh/skills/              # 首次
rm -rf ~/.dsh/skills/my-skill && cp -R /path/to/my-skill ~/.dsh/skills/   # 升级

# 验证
ls ~/.dsh/skills/my-skill/     # 须直接看到 SKILL.md
head -6 ~/.dsh/skills/my-skill/SKILL.md   # 须包含 name 与 description
# 会话内：通过 /skills 查找名称，/doctor 检查整体健康
```

### 常见错误与规避

::acc
1. **cp -R 覆盖已有技能，形成嵌套目录，技能消失**
   目标目录已存在时，`cp -R src ~/.dsh/skills/` 会生成 `~/.dsh/skills/my-skill/my-skill/`；因发现深度仅一层，技能将静默消失。**升级前一律先执行 `rm -rf ~/.dsh/skills/my-skill`。**
2. **frontmatter 缺少 name 或 description，技能被丢弃且界面无提示**
   DSH 仅识别 `name` 与 `description` 两个必填字段。字段写错不会显示错误，仅表现为技能不再出现；原因需在 DSH 日志中检索 `skill file ... ignored`。
3. **修改 cordis.patch.yml 后使用 /reload 不生效，须 /restart**
   `/reload` **不会**应用补丁；profile 补丁变更后一律执行 `/restart` 或退出重进。
4. **自定义 modes 时保留内置 full 档，原子相同，后一档成为死档**
   新增的自动档与内置 `full` 档原子完全相同，匹配时永远命中靠前的条目，因而重复的那一档在 Shift+Tab 循环中**永远无法到达**。修改 `modes[0]` 时应一并删除原 `full` 档。
::

## LINKS 相关延伸阅读

- [dsh-TUI 官网](https://dshtui.com/) —— DeepSeek Harness 的 Claude Code 风格全屏终端界面：安装、功能、命令、快捷键与架构说明。

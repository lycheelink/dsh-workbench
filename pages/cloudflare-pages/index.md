---
title: dsh-workbench · 企业 Agent 工作台
updated: 2026-09-23
footer_source: dsh-workbench 站点头页
footer_applies: "@lycheelink/dsh-workbench 0.1.2 · DSH Web 插件 · 独立参数采集工具"
footer_note: 插件在 dsh web 宿主内运行，会话操作以宿主权限为准；采集工具为单文件 HTML，可下载离线使用，生成的 JSON 只在自行复制/下载后才会离开本机。
---

<!--
dsh-workbench 站点头页 · 由 scripts/build-doc.py 渲染成 dist/index.html（零依赖 python3）。
语法词表见 dsh-tui-quick-start.md 顶部注释（全部生成页共用）；改完运行 python3 scripts/build-doc.py，--check 校验。
-->

::hero
eyebrow: DSH Web · 企业 Agent 工作台

# dsh-workbench

一套工作台，两种用法：**装成 dsh web 插件**——场景卡片即参数表单，点卡即建真实宿主会话并注入组装好的提示词；**或免安装直接用**——本站托管的独立参数采集工具离线填表，实时产出结构化 JSON 与触发指令，直接粘给 dsh-TUI 触发 SKILL 执行。

chips: npm @lycheelink/dsh-workbench · v0.1.2 · 纯增量注入

card 插件形态 | 侧栏「工作台」入口 + 整页场景卡 + 控制房监控，不替换任何官方插件；启动的会话在宿主会话列表中可见。
card 工具形态 | 三个参数采集台（寻优 / Profiling / 验证流）+ 工作台在线预览，全部为单文件 HTML，支持离线使用。
card 文档 | 宿主安装看 [DSH Quick Start](dsh-quick-start.html)，终端上手看 [dsh-TUI Quick Start](dsh-tui-quick-start.html)。
::

## 1. 两种用法

同一套场景卡与参数表单，两种打开方式；参数定义遵循同一份结构化约定。

::cmp
col pick **装进 dsh · 插件** [badge: npm @lycheelink/dsh-workbench]
  形态: DSH Web插件（peer `cordis ^4.0.1`）
  入口: 侧栏「工作台」场景卡网格
  产出: 真实宿主会话 + 注入组装提示词
  场景卡成为宿主内的表单层：点卡建会话、注入提示词，「控制房」整页跟踪会话状态。插件为纯增量注入——不替换、不禁用任何官方插件。
col **独立工具 · 生成提示词** [badge: 零安装 · 离线可用]
  形态: 单文件 HTML 采集台
  输入: 表单 + 实时校验（必填完成度计）
  产出: 结构化 JSON / 触发指令
  不想装任何东西时直接用采集台：填齐部署拓扑、业务建模与寻优目标，把实时生成的 JSON（或触发指令）复制给 dsh-TUI 触发 SKILL 执行。
col **接收端 · dsh-TUI + SKILL** [badge: 提示词消费方]
  宿主: dsh-TUI（社区 TUI 插件）
  技能: model-oob-perf-optimize 等
  文档: [dsh-TUI Quick Start](dsh-tui-quick-start.html)
  采集台的 JSON 配一句触发词就是完整任务指令；粘贴进 dsh-TUI 即可运行。
::

> [!note] **想先试插件？**在 dsh web 侧执行 `dsh plugin --profile web add @lycheelink/dsh-workbench`；不装任何东西、只想看交互，先开[Agent 工作台](workbench.html)。

## 2. 工具与文档

六个入口：三个参数采集台、一个Agent 工作台、两份 quick-start 手册。

::grid2
tile [寻优参数采集台](perf-optimize-params.html) | 部署拓扑、业务建模、寻优需求一次采齐，输出可直接提交 model-oob-perf-optimize SKILL 的寻优 JSON。
tile [Profiling 参数采集台](profiling-collect-params.html) | ascend-profiler 场景的参数采集台，生成结构化 Profiling 配置 JSON。
tile [验证流测试台](veriflow-params.html) | veriflow 验证流测试的参数采集台，输出对应结构化 JSON 与触发指令。
tile [企业 Agent 工作台](workbench.html) | 插件的场景卡网格与参数表单的免安装预览版；卡数据可经 URL 参数或导入注入。
tile [dsh-TUI Quick Start](dsh-tui-quick-start.html) | 社区 TUI 插件上手六环节：安装、装技能、启动、配置、授权、寻优参数配置。
tile [DSH Quick Start](dsh-quick-start.html) | 宿主本体（dsh web）：版本要求、插件与技能管理、排错与备份，基于 0.1.2-rc.1 实测。
::

## 3. 站点地图

本站全部页面一览；均为相对链接，子页可直接收藏。

| 页面 | 类型 | 内容 |
|---|---|---|
| [index.html](index.html) | 首页 | 定位说明、两种用法、工具与文档入口 |
| [dsh-quick-start.html](dsh-quick-start.html) | 文档 | DSH Quick Start（锁版本 0.1.2-rc.1） |
| [dsh-tui-quick-start.html](dsh-tui-quick-start.html) | 文档 | dsh-TUI 社区插件上手指南 |
| [perf-optimize-params.html](perf-optimize-params.html) | 工具 | 寻优参数采集台（model-oob-perf-optimize） |
| [profiling-collect-params.html](profiling-collect-params.html) | 工具 | Profiling 参数采集台（ascend-profiler） |
| [veriflow-params.html](veriflow-params.html) | 工具 | 验证流测试台（veriflow） |
| [workbench.html](workbench.html) | 预览 | 企业 Agent 工作台（插件预览版） |

/**
 * Built-in workbench card definitions. Each card describes a "scene" with
 * formSchema, conditional fields, and agent configuration.
 *
 * Aligned with the PDR §3 data model. New cards can be added at runtime
 * through the workbench service, or loaded from domain storage.
 */

/** @type {import('./index.js').WorkbenchCard[]} */
export const BUILTIN_CARDS = [
  {
    id: "model-oob-perf-optimize",
    title: "开箱寻优",
    description: "开箱即用的推理性能自动寻优工具，根据用户输入的寻优需求（模型权重路径、硬件型号、测试工具、寻优目标、寻优要求），自动完成业务建模、寻优参数配置、启动寻优测试、分析寻优结果。支持智能模式（一键寻优免交互）、PD 分离寻优、多机寻优、阶梯寻优。",
    icon: "shield-check",
    category: "寻优",
    formSchema: [
      {
        key: "model_path",
        label: "模型权重路径",
        type: "text",
        required: true,
        placeholder: "请输入模型权重目录路径，如 /models/Qwen2.5-7B-Instruct",
        description: "服务端本地权重目录（须含 config.json），Phase 4.1 据此采集模型结构信息"
      },
      {
        key: "hardware_model",
        label: "硬件型号",
        type: "select",
        required: true,
        options: [
          { label: "Atlas 800I A2", value: "atlas-800i-a2" },
          { label: "Atlas 800I A3（每卡 2 芯片）", value: "atlas-800i-a3" },
          { label: "Atlas 300I Duo", value: "atlas-300i-duo" },
          { label: "Ascend 910B", value: "ascend-910b" }
        ],
        description: "目标昇腾 NPU 硬件型号；预检阶段可自动检测本机 NPU，此选择用于覆盖检测值"
      },
      {
        key: "test_tool",
        label: "测试工具",
        type: "select",
        required: true,
        options: [
          { label: "evalscope（evalscope perf）", value: "evalscopeperf" },
          { label: "vllm_benchmark（vllm bench serve）", value: "vllm_benchmark" },
          { label: "ais_bench", value: "ais_bench" }
        ],
        description: "性能压测工具，写入 business_modeling_result.json 前按标准名归一化"
      },
      {
        key: "optimization_goal",
        label: "寻优目标",
        type: "select",
        required: true,
        options: [
          { label: "吞吐量优先（tokens/s）", value: "throughput_token" },
          { label: "吞吐量优先（req/s）", value: "throughput_req" },
          { label: "时延优先（TTFT 首 Token）", value: "latency_ttft" },
          { label: "时延优先（TPOT 每 Token）", value: "latency_tpot" }
        ],
        description: "映射为 4 种寻优 strategy 之一，写入 optimization_goal_structured"
      },
      {
        key: "optimization_requirement",
        label: "寻优要求",
        type: "textarea",
        required: false,
        placeholder: "如：TTFT 不超过 500ms；并发数 10~100；prefix cache 命中率 90%；生成模式（甩手/手动/混合）等约束条件"
      }
    ],
    agentConfig: {
      preset: "model-oob-perf-optimize",
      systemPrompt: "你是一名推理性能寻优助手，严格按 Skill 流程执行 Pre → Phase 0~7...",
      allowedTools: ["file_read", "benchmark_run", "param_search", "bash"],
      skills: ["model-oob-perf-optimize"]
    }
  },
  {
    id: "ascend-profiler",
    title: "Profiling 采集",
    description: "昇腾推理 Profiling 采集与分析：可对已运行在线服务 attach 采集，可由 profiler 拉起推理服务并驱动 workload 采集，也可直接分析已有 profiling 数据，产出瓶颈分析结果。",
    icon: "chart-bar",
    category: "寻优",
    formSchema: [
      {
        key: "model_name",
        label: "模型名称",
        type: "text",
        required: true,
        placeholder: "如 Qwen3-235B-A22B-W8A8",
        description: "报告上下文增强项（--model-name）"
      },
      {
        key: "mode",
        label: "采集模式",
        type: "select",
        required: true,
        options: [
          { label: "在线服务采集（服务已运行，attach 采集）", value: "live_service_collection" },
          { label: "拉起服务采集（profiler 启动服务并驱动 workload）", value: "launch_service_collection" },
          { label: "已有数据分析（直接分析已有 profiling）", value: "existing_profiling_analysis" }
        ],
        description: "基础模式（--mode），不可自动推断，须用户显式选择"
      },
      {
        key: "collect_mode",
        label: "采集维度",
        type: "select",
        required: false,
        options: [
          { label: "auto（自动）", value: "auto" },
          { label: "all（全量）", value: "all" },
          { label: "computation（计算）", value: "computation" },
          { label: "schedule（调度）", value: "schedule" },
          { label: "cluster（集群）", value: "cluster" }
        ],
        description: "--collect-mode，默认 auto；analysis-mode=schedule 时 preflight 常归一化为 schedule"
      },
      {
        key: "analysis_mode",
        label: "分析模式",
        type: "select",
        required: false,
        options: [
          { label: "all（全量）", value: "all" },
          { label: "computation（计算）", value: "computation" },
          { label: "schedule（调度）", value: "schedule" },
          { label: "cluster（集群分析）", value: "cluster" },
          { label: "comparison（对比分析）", value: "comparison" }
        ],
        description: "--analysis-mode，默认 schedule"
      },
      {
        key: "duration",
        label: "采集时长（秒）",
        type: "text",
        required: false,
        placeholder: "如 20",
        description: "--duration，正整数秒，默认 10"
      },
      {
        key: "profiling_root",
        label: "Profiling 输出根目录",
        type: "text",
        required: false,
        placeholder: "如 /mnt/share_space/profiling",
        description: "--profiling-root，强烈建议显式给出；无 run-root 时默认 /mnt/share_space/profiling"
      }
    ],
    conditionalFields: [
      {
        when: "mode == 'live_service_collection'",
        fields: [
          {
            key: "service_pid",
            label: "服务进程 PID",
            type: "text",
            required: true,
            placeholder: "如 19475",
            description: "--service-pid，该模式唯一硬依赖"
          },
          {
            key: "base_url",
            label: "服务地址",
            type: "text",
            required: false,
            placeholder: "如 http://127.0.0.1:8000",
            description: "--base-url，可选，用于报告保留服务访问上下文"
          }
        ]
      },
      {
        when: "mode == 'launch_service_collection'",
        fields: [
          {
            key: "service_start_script",
            label: "服务启动脚本",
            type: "file",
            required: true,
            description: "--service-start-script，由 profiler 拉起推理服务"
          },
          {
            key: "workload_script",
            label: "Workload 驱动脚本",
            type: "file",
            required: true,
            description: "--workload-script，由 profiler 执行的压测脚本"
          },
          {
            key: "warmup_seconds",
            label: "预热时长（秒）",
            type: "text",
            required: false,
            placeholder: "默认 30",
            description: "--warmup-seconds，workload 启动后、正式采集前预热等待"
          }
        ]
      },
      {
        when: "mode == 'existing_profiling_analysis'",
        fields: [
          {
            key: "profiling_input_root",
            label: "Profiling 输入目录",
            type: "text",
            required: true,
            description: "非 comparison 模式必填，最低依赖为原始 PROF_* 目录"
          },
          {
            key: "output_path",
            label: "分析结果输出目录",
            type: "text",
            required: true,
            description: "--output-path，与 profiling-root 同一轮硬依赖确认"
          },
          {
            key: "benchmark_profiling_path",
            label: "基准 profiling 目录",
            type: "text",
            required: false,
            description: "--benchmark-profiling-path，仅 analysis-mode=comparison 时必填"
          },
          {
            key: "comparison_profiling_path",
            label: "对比 profiling 目录",
            type: "text",
            required: false,
            description: "--comparison-profiling-path，仅 analysis-mode=comparison 时必填"
          }
        ]
      }
    ],
    agentConfig: {
      preset: "ascend-profiler",
      systemPrompt: "你是一名昇腾推理 Profiling 采集与分析助手，严格遵守首轮交互协议与 preflight 流程...",
      allowedTools: ["file_read", "bash", "python_exec"],
      skills: ["ascend-profiler"]
    }
  },
  {
    id: "veriflow",
    title: "验证流测试",
    description: "面向 LLM 推理服务的验证流框架：按声明式 YAML 配置自动启动 vLLM 推理服务（本地或 SSH 跨节点，支持多机数据并行与 PD 分离），运行精度 / 性能 / 长稳测试（vllm bench、lm-eval、evalscope），并与验收标准逐条比对，产出通过/失败全景报告（veriflow_report.md + veriflow_summary.json）。",
    icon: "document-text",
    category: "测试",
    formSchema: [
      {
        key: "config",
        label: "项目配置文件",
        type: "file",
        required: true,
        description: "YAML 配置（一个配置 = 一个项目）：定义模型、数据集、节点、vllm 参数与测试用例；对应 -c/--config（项目名或完整路径）"
      },
      {
        key: "test_case",
        label: "测试用例筛选",
        type: "text",
        required: false,
        placeholder: "如 acc-gsm8k,perf-gsm8k（留空运行全部用例）",
        description: "--test-case，逗号分隔多个用例名；失败不中断，最终产出完整通过/失败全景"
      },
      {
        key: "limit",
        label: "样本数限制",
        type: "text",
        required: false,
        placeholder: "如 8（快速冒烟）",
        description: "--limit 统一回退字段：evalscope/lm_eval → --limit，vllm bench → --num-prompts，evalscope perf → --number；工具参数块显式值优先"
      },
      {
        key: "run_mode",
        label: "运行方式",
        type: "select",
        required: true,
        options: [
          { label: "正式运行", value: "run" },
          { label: "预览（dry-run，打印各节点服务+测试命令，不启动）", value: "dry_run" },
          { label: "列出项目模型/数据集/用例", value: "list" }
        ],
        description: "dry-run 用于预览；--list 用于核对配置内容"
      },
      {
        key: "results_dir",
        label: "结果输出目录",
        type: "text",
        required: false,
        placeholder: "默认 results/",
        description: "--results-dir 覆盖结果输出目录；每次运行生成 run_* 子目录存放报告与日志"
      }
    ],
    agentConfig: {
      preset: "veriflow",
      systemPrompt: "你是一名推理服务验证流测试助手，负责执行 VeriFlow 测试、读取失败信息、分析原因并给出修复建议...",
      allowedTools: ["file_read", "bash", "python_exec"],
      skills: ["veriflow"]
    }
  }
];
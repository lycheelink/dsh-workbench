/**
 * dsh-workbench host half: a Typert Remote service named `workbench` that
 * manages the scene-card definitions, user form submissions and session launch.
 *
 * Wire contract (descriptors.js + typert.js):
 *   - Every method takes a single JSON `request` and returns a business
 *     envelope `{ ok: true, value } | { ok: false, error }` validated by the
 *     strict codecs the typert-loader registers from the `./typert` artifact.
 *   - Without that artifact the host never exposes `workbench/*` endpoints.
 *
 * Session semantics:
 *   - launchCardSession calls the host `sessionController` (the same service
 *     the web client uses for new conversations) to CREATE a real agent
 *     session and PROMPT it with the assembled instruction. The session then
 *     appears in the conversation list and actually runs.
 *   - The card's agentPreset is mounted when the host can resolve it; an
 *     unknown preset falls back to a default session so the launch still runs.
 *   - Workbench keeps its own record (formData + prompt + status) and tracks
 *     the real session via the `session/event` stream for the control room.
 */
import { randomUUID } from "node:crypto";
import { isAbsolute } from "node:path";
import { stat } from "node:fs/promises";
import { Service } from "@deepseek-ai/cordis";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";
import { defineDomain, domainTable } from "@deepseek-ai/dsh-storage-domain";

import { BUILTIN_CARDS } from "./cards.js";
import {
  workbenchCardRecordSchema,
  cardSessionRecordSchema
} from "./schemas.js";
import {
  missingRequiredFields,
  activeConditionalGroups
} from "./conditions.js";

// ── Bounds (H4) ─────────────────────────────────────────────────────────────

/** Maximum serialized formData payload a client may submit per launch. */
const MAX_FORM_BYTES = 64 * 1024;
/** Maximum number of sessions returned by listSessions (newest first). */
const MAX_SESSIONS_RETURNED = 200;

// ── Domain ─────────────────────────────────────────────────────────────────

const cardDomainSpec = defineDomain({
  name: "workbench_cards",
  version: 1,
  tables: {
    cards: domainTable(workbenchCardRecordSchema)
  }
});

const sessionDomainSpec = defineDomain({
  name: "workbench_sessions",
  version: 1,
  tables: {
    sessions: domainTable(cardSessionRecordSchema)
  }
});

// ── Built-in card IDs ──────────────────────────────────────────────────────

const BUILTIN_CARD_IDS = new Set(BUILTIN_CARDS.map((c) => c.id));

/**
 * Cards whose config surface is a vendored HTML console (the 寻优参数采集台)
 * rendered by the client inside an iframe, rather than a DynamicForm. For
 * these cards the console's own readiness meter is the gate: the host skips
 * the formSchema required-field check and takes the console's structured
 * SKILL input (formData.perfConfig) as the user-input block. Keep in sync
 * with src/client/artifacts.js.
 */
const ARTIFACT_FORM_CARD_IDS = new Set(["model-oob-perf-optimize", "ascend-profiler", "veriflow"]);

// ── Session event → workbench status mapping (F3) ───────────────────────────
// Conservative: unknown event types keep the current status. Only transitions
// we are certain about from the host vocabulary are mapped.

function mapSessionEventStatus(eventType) {
  switch (eventType) {
    case "approval/asked": return "awaiting_decision";
    case "approval/decided": return "running";
    case "command/run": return "running";
    case "command/done": return "running";
    default: return null;
  }
}

function stepForEventType(eventType) {
  switch (eventType) {
    case "approval/asked": return "等待你的决定";
    case "approval/decided": return "已收到决定，继续执行";
    case "command/run": return "正在执行步骤";
    case "command/done": return "步骤完成";
    default: return null;
  }
}

/** Strip server-local payloads (formData / assembled prompt) off the wire. */
function toWireSession(record) {
  const wire = {
    sessionId: record.sessionId,
    cardId: record.cardId,
    cardTitle: record.cardTitle,
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
  if (record.stepDescription !== undefined) wire.stepDescription = record.stepDescription;
  if (record.spawnedSessionId !== undefined) wire.spawnedSessionId = record.spawnedSessionId;
  return wire;
}

// ── Service ─────────────────────────────────────────────────────────────────

export default class WorkbenchService extends TypertRemoteService {
  static inject = ["storageDomain", "sessionController"];

  /** cardId → WorkbenchCard (built-in + user cards) */
  cardCache = new Map();
  /** sessionId → CardSession record */
  sessionStore = new Map();
  cardTable = null;
  sessionTable = null;

  constructor(ctx, config = {}) {
    super(ctx, "workbench");
    this.ctx = ctx;
    this.config = { ...config };
    // Pre-populate card cache with built-in cards
    for (const card of BUILTIN_CARDS) {
      this.cardCache.set(card.id, card);
    }
    // Cleanup on unload
    ctx.effect(() => () => {
      this.cardCache.clear();
      this.sessionStore.clear();
    }, "dsh-workbench: cleanup");
  }

  async [Service.init]() {
    // Open storage domains
    const cardDomain = await this.ctx.storageDomain.open(cardDomainSpec);
    this.cardTable = cardDomain.table("cards");
    this.ctx.effect(() => () => cardDomain.close(), "dsh-workbench: card domain close");

    const sessionDomain = await this.ctx.storageDomain.open(sessionDomainSpec);
    this.sessionTable = sessionDomain.table("sessions");
    this.ctx.effect(() => () => sessionDomain.close(), "dsh-workbench: session domain close");

    // Load user-defined cards from storage (built-ins stay in cache)
    for (const [id, record] of this.cardTable.entries()) {
      if (!BUILTIN_CARD_IDS.has(id)) {
        this.cardCache.set(id, {
          id: record.id,
          title: record.title,
          description: record.description,
          icon: record.icon,
          category: record.category,
          formSchema: record.formSchema,
          conditionalFields: record.conditionalFields,
          agentConfig: record.agentConfig
        });
      }
    }

    // Load persisted sessions
    for (const [sessionId, record] of this.sessionTable.entries()) {
      this.sessionStore.set(sessionId, record);
    }

    // Track real host session events → workbench session status (F3). The
    // listener is ctx-scoped and removed with the service's context.
    if (typeof this.ctx.on === "function") {
      this.ctx.on("session/event", (session, event) => {
        if (!session || this.sessionStore.has(session.id) === false) return;
        const eventType = event?.type;
        const next = mapSessionEventStatus(eventType);
        if (next === null) return;
        const record = this.sessionStore.get(session.id);
        record.status = next;
        record.updatedAt = new Date().toISOString();
        const step = stepForEventType(eventType);
        if (step !== null) record.stepDescription = step;
        if (this.sessionTable !== null) {
          this.sessionTable.put(record.sessionId, record).catch(() => {});
        }
      }, "dsh-workbench: session event tracking");
    }
  }

  // ── Remote methods ─────────────────────────────────────────────────────────

  /**
   * List all available cards (built-in + user-defined).
   */
  async listCards() {
    const cards = [...this.cardCache.values()].map((card) => ({ ...card }));
    return { ok: true, value: { cards } };
  }

  /**
   * Get a single card by id.
   */
  async getCard(input) {
    const card = this.cardCache.get(input?.id);
    if (card === undefined) {
      return { ok: false, error: { code: "card-not-found", message: `Card "${input?.id}" not found` } };
    }
    return { ok: true, value: { card: { ...card } } };
  }

  /**
   * Launch a session for a given card with the submitted form data.
   *
   * Steps:
   *   1. Look up the card definition
   *   2. Reject oversized payloads (H4)
   *   3. Validate required fields (basic + active conditional) — shared logic
   *   4. Validate server-path `file` fields actually exist (H1)
   *   5. Assemble a structured prompt and record the session
   *   6. Launch a REAL host agent session through `sessionController`
   *      (unless config.spawnAgent === false): create + prompt with the
   *      assembled instruction. The session appears in the conversation list
   *      and runs; the `session/event` stream drives control-room status.
   */
  async launchCardSession(input) {
    const { cardId, formData } = input ?? {};
    const card = this.cardCache.get(cardId);
    if (card === undefined) {
      return { ok: false, error: { code: "card-not-found", message: `Card "${cardId}" not found` } };
    }

    // Bound the payload before anything else.
    const values = formData ?? {};
    let payloadBytes;
    try {
      payloadBytes = JSON.stringify(values).length;
    } catch {
      return { ok: false, error: { code: "validation-error", message: "formData is not JSON-serializable" } };
    }
    if (payloadBytes > MAX_FORM_BYTES) {
      return { ok: false, error: { code: "validation-error", message: `formData too large (${payloadBytes} bytes, max ${MAX_FORM_BYTES})` } };
    }

    // Validate required fields (basic + active conditional). Artifact-format
    // cards skip this — the console's own 必填完成度 meter is authoritative —
    // but still require a parseable structured input object (the payload size
    // bound above applies to the whole submission).
    const isArtifactForm = ARTIFACT_FORM_CARD_IDS.has(card.id);
    if (isArtifactForm) {
      const perf = values.perfConfig;
      if (perf === null || typeof perf !== "object" || Array.isArray(perf)) {
        return {
          ok: false,
          error: {
            code: "validation-error",
            message: "perfConfig 必须为寻优参数采集台产出的结构化 JSON 对象"
          }
        };
      }
    } else {
      const missing = missingRequiredFields(card, values);
      if (missing.length > 0) {
        return { ok: false, error: { code: "validation-error", message: `Missing required fields: ${missing.join(", ")}` } };
      }
    }

    // `file` fields are server paths: they must exist and be absolute.
    const pathErrors = await this.validateServerPaths(card, values);
    if (pathErrors.length > 0) {
      return { ok: false, error: { code: "validation-error", message: `Invalid file paths: ${pathErrors.join(", ")}` } };
    }

    // Assemble structured prompt
    const prompt = this.buildPrompt(card, values);

    // Create the workbench session record
    const now = new Date().toISOString();
    const sessionId = randomUUID();
    const record = {
      sessionId,
      cardId: card.id,
      cardTitle: card.title,
      formData: values,
      prompt,
      status: "created",
      createdAt: now,
      updatedAt: now,
      stepDescription: "正在创建会话..."
    };

    // Launch a REAL host agent session unless explicitly disabled.
    if (this.config.spawnAgent !== false) {
      await this.launchRealSession(record, card, sessionId);
    }

    await this.persistSession(record);
    return { ok: true, value: { session: toWireSession(record) } };
  }

  /**
   * List all sessions with their current status (for control room).
   * Newest first, capped, and sanitized: `formData` / `prompt` never leave the
   * host (H2).
   */
  async listSessions() {
    const sessions = [...this.sessionStore.values()]
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, MAX_SESSIONS_RETURNED)
      .map(toWireSession);
    return { ok: true, value: { sessions } };
  }

  /**
   * Get a single session by id (sanitized view, same as listSessions).
   */
  async getSession(input) {
    const record = this.sessionStore.get(input?.sessionId);
    if (record === undefined) {
      return { ok: false, error: { code: "session-not-found", message: `Session "${input?.sessionId}" not found` } };
    }
    return { ok: true, value: { session: toWireSession(record) } };
  }

  /**
   * Delete a workbench session record from the in-memory store and the
   * persistent domain. Only the workbench's own record is removed — the real
   * host session (spawnedSessionId), if any, is left untouched so the user can
   * clean it up in the conversation list on their own terms.
   */
  async deleteSession(input) {
    const sessionId = input?.sessionId;
    const record = this.sessionStore.get(sessionId);
    if (record === undefined) {
      return { ok: false, error: { code: "session-not-found", message: `Session "${sessionId}" not found` } };
    }
    this.sessionStore.delete(sessionId);
    if (this.sessionTable !== null) {
      await this.sessionTable.delete(sessionId);
    }
    return { ok: true, value: { deleted: true } };
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /**
   * Persist a session record to the in-memory store and the storage domain.
   * A failed domain write is logged but does not corrupt the in-memory result.
   */
  async persistSession(record) {
    this.sessionStore.set(record.sessionId, record);
    if (this.sessionTable !== null) {
      await this.sessionTable.put(record.sessionId, record);
    }
  }

  /**
   * Launch a REAL host agent session for a workbench card via the host
   * `sessionController` service — the same service the web client uses to
   * start a new conversation.
   *
   * Flow:
   *   sessionController.create({ sessionId, agentPreset })  → real session
   *   sessionController.prompt({ sessionId, content })      → inject the prompt
   *
   * The workbench sessionId doubles as the host sessionId, so the session
   * shows up in the conversation list and its `session/event` stream drives
   * control-room status through the init() subscription.
   *
   * Robustness:
   *   - The card preset is only passed when the host's `agentPresets` roster
   *     actually lists it. This avoids create-with-unknown-preset followed by
   *     a retry on the same id — the host's adopt path cannot recover from
   *     that without a cancellation signal and dies on `signal.throwIfAborted`.
   *   - A missing `sessionController` service degrades to a record-only
   *     workbench session instead of crashing.
   */
  async launchRealSession(record, card, sessionId) {
    const controller = this.ctx.sessionController;
    if (controller === undefined || typeof controller.create !== "function") {
      record.status = "created";
      record.stepDescription = "宿主未提供 sessionController，仅记录会话";
      return;
    }

    // Resolve the card preset only if the host ships it (single clean create;
    // never retry a failed create on the same sessionId).
    const requestedPreset = card.agentConfig?.preset;
    let presetId;
    if (requestedPreset) {
      try {
        const presets = this.ctx.get("agentPresets");
        if (presets !== undefined && typeof presets.list === "function") {
          const available = await presets.list();
          if (Array.isArray(available) && available.some((p) => p?.id === requestedPreset)) {
            presetId = requestedPreset;
          }
        }
      } catch {
        presetId = undefined; // availability unknown → launch without preset
      }
    }

    try {
      const spawned = await controller.create(
        presetId ? { sessionId, agentPreset: presetId } : { sessionId }
      );
      record.spawnedSessionId = spawned?.sessionId ?? sessionId;
      // prompt is a cancellation-signaled Remote method (descriptor declares
      // `cancellation: { parameter: "signal" }`); supply a live signal so an
      // in-process call matches the gateway contract. On host ≥0.1.5 the
      // SessionPromptRequest also requires a unique requestId and a delivery
      // mode — without them the prompt is rejected ("prompt rejected" /
      // agent-busy).
      await controller.prompt(
        {
          sessionId,
          requestId: randomUUID(),
          mode: "queue",
          content: [{ type: "text", text: record.prompt }]
        },
        new AbortController().signal
      );
      record.status = "running";
      if (presetId) {
        record.stepDescription = `会话已启动（preset: ${presetId}），agent 执行中`;
      } else if (requestedPreset) {
        record.stepDescription = "会话已启动（场景预设未安装，以默认配置运行）";
      } else {
        record.stepDescription = "会话已启动，agent 执行中";
      }
    } catch (error) {
      record.status = "failed";
      record.stepDescription = `会话启动失败: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  /**
   * Check every populated `file` field: the value must be an absolute server
   * path pointing at an existing file. Returns the list of problems.
   */
  async validateServerPaths(card, formData) {
    const problems = [];
    const check = async (field) => {
      const value = formData[field.key];
      if (field.type !== "file" || value === undefined || value === null || value === "") return;
      if (typeof value !== "string" || !isAbsolute(value)) {
        problems.push(`${field.key}: 必须为绝对服务端路径`);
        return;
      }
      try {
        const info = await stat(value);
        if (!info.isFile()) problems.push(`${field.key}: 不是文件`);
      } catch {
        problems.push(`${field.key}: 路径不存在`);
      }
    };
    for (const field of card.formSchema ?? []) await check(field);
    for (const group of activeConditionalGroups(card, formData)) {
      for (const field of group.fields ?? []) await check(field);
    }
    return problems;
  }

  /**
   * Build a structured prompt from card config and user form data.
   * In Phase 3, this prompt is injected as the first message of the agent session.
   */
  buildPrompt(card, formData) {
    if (ARTIFACT_FORM_CARD_IDS.has(card.id)) {
      return this.buildArtifactPrompt(card, formData);
    }
    const lines = [
      `# 场景：${card.title}`,
      ``,
      `## 任务说明`,
      card.description,
      ``,
      `## 系统指令`,
      card.agentConfig.systemPrompt,
      ``,
      `## 用户输入参数`,
      ``
    ];
    const pushValues = (fields) => {
      for (const field of fields) {
        const value = formData[field.key];
        if (value !== undefined && value !== "") {
          const cliArg = `--${field.key.replace(/_/g, "-")}`;
          lines.push(`- **${field.label}**（\`${cliArg}\`）: ${value}`);
        }
      }
    };
    pushValues(card.formSchema ?? []);

    // Include active conditional field values
    for (const group of activeConditionalGroups(card, formData)) {
      pushValues(group.fields ?? []);
    }

    if (card.agentConfig.allowedTools && card.agentConfig.allowedTools.length > 0) {
      lines.push(``, `## 可用工具`, card.agentConfig.allowedTools.map((t) => `- \`${t}\``).join("\n"));
    }

    return lines.join("\n");
  }

  /**
   * Prompt for artifact-format cards: keep the scene shell (任务说明 / 系统指令
   * / 可用工具) and present the console's structured SKILL input as a JSON
   * block in the user-input section — the console JSON is already the exact
   * shape model-oob-perf-optimize consumes, so no flat field transcription.
   */
  buildArtifactPrompt(card, formData) {
    const json = formData.perfConfig;
    const jsonText = json === undefined ? "" : JSON.stringify(json, null, 2);
    const lines = [
      `# 场景：${card.title}`,
      ``,
      `## 任务说明`,
      card.description,
      ``,
      `## 系统指令`,
      card.agentConfig.systemPrompt,
      ``,
      `## 用户输入参数（寻优参数采集台结构化输出）`,
      ``,
      "```json",
      jsonText,
      "```"
    ];
    if (card.agentConfig.allowedTools && card.agentConfig.allowedTools.length > 0) {
      lines.push(``, `## 可用工具`, card.agentConfig.allowedTools.map((t) => `- \`${t}\``).join("\n"));
    }
    return lines.join("\n");
  }
}

/**
 * Smoke tests for dsh-workbench host logic + wire artifacts.
 * Run with: node test/smoke.mjs  (after `npm run build`)
 *
 * Covers:
 *   - evaluateCondition / missingRequiredFields / activeConditionalGroups
 *   - buildPrompt
 *   - launchCardSession: validation, bounds, server-path check, spawnAgent
 *   - session sanitization (formData / prompt never cross the wire)
 *   - InvocationDescriptor shape + business-envelope parsing
 *   - TYPERT host manifest shape (the typert-loader boundary)
 */
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Service } from "@deepseek-ai/cordis";
import WorkbenchService from "../lib/index.js";
import { DESCRIPTORS } from "../lib/descriptors.js";
import { TYPERT } from "../lib/typert.js";
import { evaluateCondition, missingRequiredFields, activeConditionalGroups } from "../src/conditions.js";

// Build a service instance without a live cordis context (pure helpers only).
function makeService(overrides = {}) {
  const service = Object.create(WorkbenchService.prototype);
  service.cardCache = new Map();
  service.sessionStore = new Map();
  service.cardTable = null;
  service.sessionTable = null;
  service.config = {};
  const services = overrides.services ?? {};
  service.ctx = {
    storageDomain: {
      open: async () => ({ table: () => ({ entries: () => [], put: async () => {}, close: async () => {} }), close: async () => {} })
    },
    get: (key) => services[key],
    ...(overrides.sessionController ? { sessionController: overrides.sessionController } : {})
  };
  return service;
}

// Seed a test card with a conditional group + a server-path file field.
const profCard = {
  id: "prof",
  title: "Profiling",
  description: "d",
  icon: "x",
  category: "寻优",
  formSchema: [
    { key: "mode", label: "模式", type: "select", required: true },
    { key: "service_start_script", label: "启动脚本", type: "file", required: false }
  ],
  conditionalFields: [
    { when: "mode == 'live_service_collection'", fields: [{ key: "service_pid", label: "PID", type: "text", required: true }] }
  ],
  agentConfig: { preset: "ascend-profiler", systemPrompt: "SP", allowedTools: ["bash"], skills: ["s"] }
};

// ── Shared conditions module ─────────────────────────────────────────────────

assert.equal(
  evaluateCondition("mode == 'live_service_collection'", { mode: "live_service_collection" }),
  true,
  "exact match must be true"
);
assert.equal(
  evaluateCondition("mode == 'live_service_collection'", { mode: "existing_profiling_analysis" }),
  false,
  "different value must be false"
);
assert.equal(evaluateCondition("mode == 'x'", {}), false, "missing control field must be false");
assert.equal(evaluateCondition("mode === 'x'", { mode: "x" }), false, "unsupported syntax must be false");

assert.deepEqual(
  missingRequiredFields(profCard, { mode: "live_service_collection" }),
  ["service_pid"],
  "missing required conditional field must be reported"
);
assert.deepEqual(
  missingRequiredFields(profCard, { mode: "live_service_collection", service_pid: "19475" }),
  [],
  "filled conditional field must not be reported"
);
assert.deepEqual(
  missingRequiredFields(profCard, { mode: "other" }),
  [],
  "inactive conditional fields must not be required"
);
assert.equal(
  activeConditionalGroups(profCard, { mode: "live_service_collection" }).length,
  1,
  "active group is detected"
);
assert.equal(
  activeConditionalGroups(profCard, { mode: "other" }).length,
  0,
  "inactive group is skipped"
);

// ── buildPrompt ─────────────────────────────────────────────────────────────

const service = makeService();
const prompt = service.buildPrompt(
  {
    id: "test",
    title: "测试卡片",
    description: "描述",
    icon: "x",
    category: "通用",
    formSchema: [
      { key: "model_path", label: "模型权重路径", type: "text", required: true },
      { key: "test_tool", label: "测试工具", type: "select", required: true }
    ],
    agentConfig: { systemPrompt: "SP", allowedTools: ["bash"], skills: ["s"] }
  },
  { model_path: "/models/Qwen2.5-7B", test_tool: "evalscopeperf" }
);
assert.match(prompt, /测试卡片/, "prompt must include card title");
assert.match(prompt, /--model-path/, "prompt must include CLI arg for model_path");
assert.match(prompt, /--test-tool/, "prompt must include CLI arg for test_tool");
assert.match(prompt, /evalscopeperf/, "prompt must include field value");
assert.match(prompt, /bash/, "prompt must include allowed tools");

// Conditional field values must be included when their group is active
const conditionalPrompt = service.buildPrompt(profCard, { mode: "live_service_collection", service_pid: "19475" });
assert.match(conditionalPrompt, /--service-pid/, "active conditional field must be included");
assert.match(conditionalPrompt, /19475/, "conditional field value must be included");

// ── launchCardSession ────────────────────────────────────────────────────────

service.cardCache.set("prof", profCard);

// Missing required conditional field must fail validation
let result = await service.launchCardSession({ cardId: "prof", formData: { mode: "live_service_collection" } });
assert.equal(result.ok, false, "missing required conditional field must fail");
assert.equal(result.error.code, "validation-error");

// Oversized formData must be rejected (H4)
const bigForm = { mode: "live_service_collection", service_pid: "x".repeat(70 * 1024) };
result = await service.launchCardSession({ cardId: "prof", formData: bigForm });
assert.equal(result.ok, false, "oversized formData must fail");
assert.equal(result.error.code, "validation-error");

// A `file` field pointing at a nonexistent absolute path must fail (H1)
result = await service.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "1", service_start_script: "/definitely/not/here.sh" }
});
assert.equal(result.ok, false, "nonexistent server path must fail");
assert.equal(result.error.code, "validation-error");

// A `file` field pointing at an existing file must pass (H1)
const dir = mkdtempSync(join(tmpdir(), "dsh-wb-"));
const existing = join(dir, "start.sh");
writeFileSync(existing, "#!/bin/sh\necho hi\n");
result = await service.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "1", service_start_script: existing }
});
assert.equal(result.ok, true, "existing server path must pass");
const createdWire = result.value.session;
assert.equal(createdWire.status, "created", "default launch records status 'created', not a phantom 'running'");
assert.equal("formData" in createdWire, false, "wire session must not carry formData");
assert.equal("prompt" in createdWire, false, "wire session must not carry prompt");
assert.ok(createdWire.sessionId, "session must have an id");
rmSync(dir, { recursive: true, force: true });

// Nonexistent card must fail
result = await service.launchCardSession({ cardId: "nope", formData: {} });
assert.equal(result.ok, false, "missing card must fail");
assert.equal(result.error.code, "card-not-found");

// Artifact-format card (model-oob-perf-optimize 寻优参数采集台): the console is
// authoritative for completeness — the host skips formSchema validation,
// requires a parseable perfConfig object, and embeds it as a JSON block in the
// prompt.
const artifactCard = {
  id: "model-oob-perf-optimize",
  title: "开箱寻优",
  description: "d",
  icon: "x",
  category: "寻优",
  formSchema: [], // artifact cards carry no DynamicForm schema
  agentConfig: { preset: "model-oob-perf-optimize", systemPrompt: "SP", allowedTools: ["bash"], skills: ["s"] }
};
const serviceArt = makeService();
serviceArt.cardCache.set("model-oob-perf-optimize", artifactCard);

result = await serviceArt.launchCardSession({ cardId: "model-oob-perf-optimize", formData: {} });
assert.equal(result.ok, false, "artifact card without perfConfig must fail");
assert.equal(result.error.code, "validation-error");

result = await serviceArt.launchCardSession({ cardId: "model-oob-perf-optimize", formData: { perfConfig: "not-an-object" } });
assert.equal(result.ok, false, "artifact card with non-object perfConfig must fail");
assert.equal(result.error.code, "validation-error");

result = await serviceArt.launchCardSession({
  cardId: "model-oob-perf-optimize",
  formData: { perfConfig: { topology: "单机标准", business_modeling: { tool: "evalscopeperf" } } }
});
assert.equal(result.ok, true, "artifact card with valid perfConfig passes without formSchema fields");
const artRecord = serviceArt.sessionStore.get(result.value.session.sessionId);
assert.match(artRecord.prompt, /```json/, "artifact prompt embeds a JSON code block");
assert.match(artRecord.prompt, /"tool": "evalscopeperf"/, "artifact prompt carries the console JSON");
assert.equal("formData" in result.value.session, false, "artifact wire session must not carry formData");
assert.equal("prompt" in result.value.session, false, "artifact wire session must not carry prompt");

// Second artifact card (ascend-profiler 参数采集台): same contract — the host
// skips formSchema validation and takes the console's structured perfConfig.
const profArtifactCard = {
  id: "ascend-profiler",
  title: "Profiling 采集",
  description: "d",
  icon: "x",
  category: "寻优",
  formSchema: [], // artifact cards carry no DynamicForm schema
  agentConfig: { preset: "ascend-profiler", systemPrompt: "SP", allowedTools: ["bash"], skills: ["s"] }
};
const serviceProfArt = makeService();
serviceProfArt.cardCache.set("ascend-profiler", profArtifactCard);

result = await serviceProfArt.launchCardSession({ cardId: "ascend-profiler", formData: { perfConfig: null } });
assert.equal(result.ok, false, "ascend-profiler artifact card without perfConfig object must fail");
assert.equal(result.error.code, "validation-error");

result = await serviceProfArt.launchCardSession({
  cardId: "ascend-profiler",
  formData: { perfConfig: { mode: "live_service_collection", service_pid: "19475" } }
});
assert.equal(result.ok, true, "ascend-profiler artifact card with valid perfConfig passes without formSchema fields");
const profArtRecord = serviceProfArt.sessionStore.get(result.value.session.sessionId);
assert.match(profArtRecord.prompt, /```json/, "ascend-profiler artifact prompt embeds a JSON code block");
assert.match(profArtRecord.prompt, /"mode": "live_service_collection"/, "ascend-profiler prompt carries the console JSON");
assert.equal("formData" in result.value.session, false, "ascend-profiler wire session must not carry formData");

// Third artifact card (veriflow 验证流测试台): same contract.
const veriflowArtifactCard = {
  id: "veriflow",
  title: "验证流测试",
  description: "d",
  icon: "x",
  category: "测试",
  formSchema: [], // artifact cards carry no DynamicForm schema
  agentConfig: { preset: "veriflow", systemPrompt: "SP", allowedTools: ["bash"], skills: ["s"] }
};
const serviceVfArt = makeService();
serviceVfArt.cardCache.set("veriflow", veriflowArtifactCard);

result = await serviceVfArt.launchCardSession({ cardId: "veriflow", formData: { perfConfig: "not-an-object" } });
assert.equal(result.ok, false, "veriflow artifact card with non-object perfConfig must fail");
assert.equal(result.error.code, "validation-error");

result = await serviceVfArt.launchCardSession({
  cardId: "veriflow",
  formData: { perfConfig: { run_mode: "run", config: "/workspace/projects/gsm8k.yaml" } }
});
assert.equal(result.ok, true, "veriflow artifact card with valid perfConfig passes without formSchema fields");
const vfArtRecord = serviceVfArt.sessionStore.get(result.value.session.sessionId);
assert.match(vfArtRecord.prompt, /```json/, "veriflow artifact prompt embeds a JSON code block");
assert.match(vfArtRecord.prompt, /"run_mode": "run"/, "veriflow prompt carries the console JSON");
assert.equal("formData" in result.value.session, false, "veriflow wire session must not carry formData");

// ── launchRealSession via sessionController (F3) ─────────────────────────────

// Real launch with an AVAILABLE preset: create carries agentPreset, prompt is
// injected, status running.
const createdIds = [];
const prompts = [];
const sessionControllerOk = {
  create: async (req) => {
    createdIds.push(req);
    return { sessionId: req.sessionId };
  },
  prompt: async (req, signal) => {
    prompts.push({ req, hasSignal: signal instanceof AbortController || (signal && typeof signal.throwIfAborted === "function") });
    return { accepted: true };
  }
};
const serviceLaunch = makeService({
  sessionController: sessionControllerOk,
  services: { agentPresets: { list: async () => [{ id: "ascend-profiler" }] } }
});
serviceLaunch.cardCache.set("prof", profCard);
serviceLaunch.config = {};
result = await serviceLaunch.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "19475" }
});
assert.equal(result.ok, true, "real launch must succeed");
assert.equal(result.value.session.status, "running", "real launch reports running");
assert.equal(createdIds.length, 1, "sessionController.create called once");
assert.equal(createdIds[0].sessionId, result.value.session.sessionId, "workbench session id is the host session id");
assert.equal(createdIds[0].agentPreset, "ascend-profiler", "available card preset passed to create");
assert.equal(prompts.length, 1, "sessionController.prompt called once");
assert.equal(prompts[0].req.sessionId, result.value.session.sessionId, "prompt targets the host session");
assert.match(prompts[0].req.content[0].text, /--service-pid/, "prompt carries the assembled instruction");
assert.equal(prompts[0].hasSignal, true, "prompt receives a live AbortSignal (cancellation contract)");
assert.equal(result.value.session.spawnedSessionId, result.value.session.sessionId, "spawnedSessionId links the host session");

// Card preset NOT in the host roster → launch WITHOUT it, still running, and
// the failed-create retry path (which the host cannot recover) is never hit.
const plainCreated = [];
const sessionControllerPlain = {
  create: async (req) => {
    assert.equal(req.agentPreset, undefined, "unavailable preset must not be sent to create");
    plainCreated.push(req);
    return { sessionId: req.sessionId };
  },
  prompt: async () => ({ accepted: true })
};
const serviceNoPreset = makeService({
  sessionController: sessionControllerPlain,
  services: { agentPresets: { list: async () => [{ id: "standard" }] } }
});
serviceNoPreset.cardCache.set("prof", profCard);
serviceNoPreset.config = {};
result = await serviceNoPreset.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "19475" }
});
assert.equal(result.ok, true, "preset-unavailable launch must succeed");
assert.equal(result.value.session.status, "running", "preset-unavailable still runs");
assert.equal(plainCreated.length, 1, "exactly one create call (no retry)");
assert.match(result.value.session.stepDescription, /未安装/, "stepDescription explains the skipped preset");

// agentPresets service absent → launch without preset, still runs.
const sessionControllerNoPresets = {
  create: async (req) => {
    assert.equal(req.agentPreset, undefined, "no presets roster → no preset");
    return { sessionId: req.sessionId };
  },
  prompt: async () => ({ accepted: true })
};
const serviceNoPresets = makeService({ sessionController: sessionControllerNoPresets });
serviceNoPresets.cardCache.set("prof", profCard);
serviceNoPresets.config = {};
result = await serviceNoPresets.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "19475" }
});
assert.equal(result.ok, true, "no agentPresets service must not crash");
assert.equal(result.value.session.status, "running", "no agentPresets service still runs");

// No sessionController → record-only (created), no crash.
const serviceNoController = makeService();
serviceNoController.cardCache.set("prof", profCard);
serviceNoController.config = {};
result = await serviceNoController.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "19475" }
});
assert.equal(result.ok, true, "no sessionController must not crash");
assert.equal(result.value.session.status, "created", "no host controller → record stays created");
assert.match(result.value.session.stepDescription, /sessionController/, "stepDescription explains the fallback");

// prompt failure → session marked failed (the host session still exists).
const sessionControllerPromptFails = {
  create: async (req) => ({ sessionId: req.sessionId }),
  prompt: async () => { throw new Error("no adapter serves provider"); }
};
const servicePromptFails = makeService({ sessionController: sessionControllerPromptFails });
servicePromptFails.cardCache.set("prof", profCard);
servicePromptFails.config = {};
result = await servicePromptFails.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "19475" }
});
assert.equal(result.ok, true, "prompt failure still records a session");
assert.equal(result.value.session.status, "failed", "prompt failure marks the record failed");
assert.match(result.value.session.stepDescription, /会话启动失败/, "failure reason surfaced");

// spawnAgent: false explicitly disables the real launch.
const sessionControllerSpy = { create: async () => { throw new Error("should not be called"); }, prompt: async () => {} };
const serviceDisabled = makeService({ sessionController: sessionControllerSpy });
serviceDisabled.cardCache.set("prof", profCard);
serviceDisabled.config = { spawnAgent: false };
result = await serviceDisabled.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "19475" }
});
assert.equal(result.ok, true, "spawnAgent:false records only");
assert.equal(result.value.session.status, "created", "spawnAgent:false stays created");

// Without a sessions service, spawnAgent degrades gracefully to a record.
const serviceNoSessions = makeService();
serviceNoSessions.cardCache.set("prof", profCard);
serviceNoSessions.config = { spawnAgent: true };
result = await serviceNoSessions.launchCardSession({
  cardId: "prof",
  formData: { mode: "live_service_collection", service_pid: "19475" }
});
assert.equal(result.ok, true, "spawnAgent without sessions service must not crash");
assert.equal(result.value.session.status, "created", "no host session → stays created");

// ── Session listing is sanitized + capped (H2 / H4) ─────────────────────────

result = await serviceLaunch.listSessions();
assert.equal(result.ok, true);
assert.equal(result.value.sessions.length, 1, "one session recorded");
for (const s of result.value.sessions) {
  assert.equal("formData" in s, false, "listSessions must not leak formData");
  assert.equal("prompt" in s, false, "listSessions must not leak prompt");
}

// getSession is sanitized too
const listed = result.value.sessions[0];
result = await serviceLaunch.getSession({ sessionId: listed.sessionId });
assert.equal(result.ok, true, "getSession must find the session");
assert.equal("formData" in result.value.session, false, "getSession must not leak formData");

// deleteSession removes the record (host session untouched) and is idempotent-safe
result = await serviceLaunch.deleteSession({ sessionId: listed.sessionId });
assert.equal(result.ok, true, "deleteSession removes the record");
assert.equal(result.value.deleted, true, "deleteSession reports deletion");
result = await serviceLaunch.listSessions();
assert.equal(result.ok, true);
assert.equal(result.value.sessions.length, 0, "deleted session is gone from listSessions");
result = await serviceLaunch.deleteSession({ sessionId: listed.sessionId });
assert.equal(result.ok, false, "deleteSession on a missing session reports an error");
assert.equal(result.error.code, "session-not-found", "missing session → session-not-found");

// ── InvocationDescriptor shape (F2) ─────────────────────────────────────────

assert.ok(Array.isArray(DESCRIPTORS) && DESCRIPTORS.length === 6, "six remote methods");
for (const d of DESCRIPTORS) {
  assert.equal(d.service, "workbench", `${d.method}: service key must be workbench`);
  assert.equal(d.namespace, "workbench", `${d.method}: namespace must be workbench`);
  assert.ok(d.id.startsWith("dsh-workbench#"), `${d.method}: id must be namespaced`);
  assert.equal(d.invocation.kind, "direct", `${d.method}: direct invocation`);
  assert.ok(d.parameters.length >= 1, `${d.method}: request parameter`);
  assert.equal(d.parameters[0].wire, "request", `${d.method}: single request wire`);
  assert.equal(d.parameters[0].codec.mode, "strict", `${d.method}: strict request codec`);
  assert.equal(d.result.mode, "strict", `${d.method}: strict result codec`);
  // Dual-shape codec: eager schema (host ≤0.1.5-rc.2) + create() factory (master).
  assert.equal(typeof d.parameters[0].codec.schema.parse, "function", `${d.method}: request schema has parse`);
  assert.equal(typeof d.parameters[0].codec.create, "function", `${d.method}: request codec has create() factory`);
  assert.equal(typeof d.parameters[0].codec.create().parse, "function", `${d.method}: request create() returns a parseable schema`);
  assert.equal(typeof d.result.schema.parse, "function", `${d.method}: result schema has parse`);
  assert.equal(typeof d.result.create, "function", `${d.method}: result codec has create() factory`);
  assert.equal(typeof d.result.create().parse, "function", `${d.method}: result create() returns a parseable schema`);
}

// Result schemas parse a real business envelope (as the host returns)
const listResult = DESCRIPTORS.find((d) => d.method === "listCards").result.schema;
const parsed = listResult.parse({ ok: true, value: { cards: [profCard] } });
assert.equal(parsed.ok, true, "listCards result must parse a success envelope");

// The wire session schema must NOT admit formData onto the wire
const launchResult = DESCRIPTORS.find((d) => d.method === "launchCardSession").result.schema;
const wireSession = {
  sessionId: "x",
  cardId: "prof",
  cardTitle: "Profiling",
  status: "created",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};
const parsedWire = launchResult.parse({ ok: true, value: { session: wireSession } });
assert.equal(parsedWire.value.session.status, "created", "wire session schema accepts status 'created'");
const parsedLeak = launchResult.parse({ ok: true, value: { session: { ...wireSession, formData: { a: 1 } } } });
assert.equal("formData" in parsedLeak.value.session, false, "wire schema strips formData (sanitization at the schema boundary)");

// ── TYPERT host manifest (F1) ───────────────────────────────────────────────

assert.equal(TYPERT.package, "dsh-workbench", "manifest must name the owning package");
assert.equal(TYPERT.face, "host", "manifest must be the host face");
assert.ok(Array.isArray(TYPERT.schemas) && TYPERT.schemas.length >= 1, "at least one schema");
for (const schema of TYPERT.schemas) {
  assert.ok(schema.name && schema.name.length > 0, "schema has a name");
  // Dual-shape schema entry: eager zod v4 schema (≤0.1.5-rc.2 loader checks `_zod`) + create() (master).
  assert.equal(typeof schema.schema?.parse, "function", "schema carries a zod parser");
  assert.ok(schema.schema && "_zod" in schema.schema, "schema is a zod v4 instance (0.1.5-rc.2 loader check)");
  assert.equal(typeof schema.create, "function", "schema has a create() factory (master loader check)");
  assert.equal(typeof schema.create().parse, "function", "schema create() returns a parseable zod schema");
}
assert.equal(TYPERT.invocations.length, DESCRIPTORS.length, "manifest invocations carry the same method count");
assert.deepEqual(
  TYPERT.invocations.map((d) => d.method),
  DESCRIPTORS.map((d) => d.method),
  "manifest invocations carry the same methods (typert.js is its own bundle, so reference identity differs)"
);
assert.ok(TYPERT.model && typeof TYPERT.model === "object", "manifest has a model");
assert.equal(Array.isArray(TYPERT.model.services), true, "model has services");
const svc = TYPERT.model.services[0];
assert.equal(svc.key, "workbench", "model service key matches");
assert.ok(Array.isArray(svc.members) && svc.members.length === 6, "model service lists 6 methods");
assert.ok(Array.isArray(svc.types) && svc.types.length > 0, "model service declares types");

// ── init(): storage domains open + session/event subscription (F3) ───────────

const onEvents = [];
const serviceInit = Object.create(WorkbenchService.prototype);
serviceInit.cardCache = new Map();
serviceInit.sessionStore = new Map();
serviceInit.cardTable = null;
serviceInit.sessionTable = null;
serviceInit.config = {};
serviceInit.ctx = {
  on: (type, listener) => { onEvents.push({ type, listener }); },
  effect: () => () => {},
  storageDomain: {
    open: async () => ({
      table: () => ({ entries: () => [], put: async () => {}, close: async () => {} }),
      close: async () => {}
    })
  }
};
await serviceInit[Service.init].call(serviceInit);
assert.equal(onEvents.length, 1, "init registers one session/event listener");
assert.equal(onEvents[0].type, "session/event", "listener is for session/event");

// The registered listener maps a host approval event to awaiting_decision.
const listener = onEvents[0].listener;
const record = {
  sessionId: "s1",
  cardId: "prof",
  cardTitle: "Profiling",
  formData: {},
  status: "running",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z"
};
serviceInit.sessionStore.set("s1", record);
listener({ id: "s1" }, { type: "approval/asked" });
assert.equal(record.status, "awaiting_decision", "approval/asked maps to awaiting_decision");
listener({ id: "s1" }, { type: "assistant/message" });
assert.equal(record.status, "awaiting_decision", "unknown event types keep the current status");

console.log("smoke: all assertions passed");

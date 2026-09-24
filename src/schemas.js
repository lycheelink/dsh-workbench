/**
 * Single source of truth for the dsh-workbench wire contract and storage
 * records. Consumed by:
 *   - src/index.js        host service (storage domain records)
 *   - src/descriptors.js  InvocationDescriptor codecs (host + client faces)
 *   - src/typert.js       host TYPERT manifest (schemas section)
 *   - src/client/*        browser-side (via the bundled descriptors)
 *
 * Envelope vocabulary mirrors dsh-ssh-ops: every Remote method takes one JSON
 * `request` and returns a business envelope
 *   { ok: true, value } | { ok: false, error: { code, message } }.
 */
import { z } from "zod";

// ── Error / result envelope ─────────────────────────────────────────────────

export const workbenchErrorSchema = z.object({
  code: z.string(),
  message: z.string()
});

export function okSchema(value) {
  return z.object({ ok: z.literal(true), value });
}

export function resultSchema(value) {
  return z.union([
    okSchema(value),
    z.object({ ok: z.literal(false), error: workbenchErrorSchema })
  ]);
}

// ── Cards ───────────────────────────────────────────────────────────────────

export const formFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["text", "textarea", "select", "file", "date"]),
  required: z.boolean(),
  placeholder: z.string().optional(),
  options: z.array(z.object({
    label: z.string(),
    value: z.string()
  })).optional(),
  description: z.string().optional()
});

export const agentConfigSchema = z.object({
  preset: z.string().optional(),
  systemPrompt: z.string(),
  allowedTools: z.array(z.string()).optional(),
  skills: z.array(z.string()).optional()
});

export const conditionalFieldSchema = z.object({
  when: z.string(),
  fields: z.array(formFieldSchema)
});

/** Card as served to the wire (no storage timestamps). */
export const workbenchCardSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  category: z.string(),
  formSchema: z.array(formFieldSchema),
  conditionalFields: z.array(conditionalFieldSchema).optional(),
  agentConfig: agentConfigSchema
});

/** Card record persisted in the storage domain (adds creation metadata). */
export const workbenchCardRecordSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  icon: z.string(),
  category: z.string(),
  formSchema: z.array(formFieldSchema),
  conditionalFields: z.array(conditionalFieldSchema).optional(),
  agentConfig: agentConfigSchema,
  createdAt: z.string(),
  updatedAt: z.string()
});

// ── Sessions ────────────────────────────────────────────────────────────────

export const cardSessionStatusSchema = z.enum([
  "created",
  "running",
  "awaiting_decision",
  "completed",
  "failed"
]);

/**
 * Session as served to the wire: never carries `formData` or the assembled
 * `prompt` (server-local topology: model paths, PIDs, service URLs). The
 * control room renders title / status / step / timestamps only.
 */
export const cardSessionWireSchema = z.object({
  sessionId: z.string(),
  cardId: z.string(),
  cardTitle: z.string(),
  status: cardSessionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  stepDescription: z.string().optional(),
  spawnedSessionId: z.string().optional()
});

/** Session record persisted in the storage domain (formData + prompt kept host-side). */
export const cardSessionRecordSchema = cardSessionWireSchema.extend({
  formData: z.record(z.any()),
  prompt: z.string().optional()
});

// ── Remote method request schemas (one JSON `request` per method) ───────────

export const emptyRequestSchema = z.object({});

export const getCardRequestSchema = z.object({
  id: z.string()
});

export const launchCardSessionRequestSchema = z.object({
  cardId: z.string(),
  formData: z.record(z.any())
});

/** Prompt-template fields users may override on an existing card (lightweight edit). */
export const cardTemplatePatchSchema = z.object({
  title: z.string().trim().min(1).max(80).optional(),
  description: z.string().trim().min(1).max(1000).optional(),
  systemPrompt: z.string().trim().min(1).max(8000).optional(),
  allowedTools: z.array(z.string().trim().min(1)).max(32).optional()
}).refine((value) => Object.keys(value).length > 0, { message: "empty patch" });

export const updateCardRequestSchema = z.object({
  cardId: z.string(),
  patch: cardTemplatePatchSchema
});

export const resetCardRequestSchema = z.object({
  cardId: z.string()
});

export const getSessionRequestSchema = z.object({
  sessionId: z.string()
});

// ── Remote method result schemas (business envelope) ────────────────────────

export const listCardsResultSchema = resultSchema(
  z.object({ cards: z.array(workbenchCardSchema) })
);

export const getCardResultSchema = resultSchema(
  z.object({ card: workbenchCardSchema })
);

export const updateCardResultSchema = resultSchema(
  z.object({ card: workbenchCardSchema })
);

export const resetCardResultSchema = resultSchema(
  z.object({ card: workbenchCardSchema })
);

export const launchCardSessionResultSchema = resultSchema(
  z.object({ session: cardSessionWireSchema })
);

export const listSessionsResultSchema = resultSchema(
  z.object({ sessions: z.array(cardSessionWireSchema) })
);

export const getSessionResultSchema = resultSchema(
  z.object({ session: cardSessionWireSchema })
);

export const deleteSessionResultSchema = resultSchema(
  z.object({ deleted: z.boolean() })
);

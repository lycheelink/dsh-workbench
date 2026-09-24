/**
 * Host typert artifact: discovered automatically by @deepseek-ai/dsh-typert-loader
 * through the package's "./typert" export and registered into ctx.typert, which
 * the typert gateway consults for strict dispatch codecs. Without this artifact
 * the host never exposes `workbench/*` endpoints (mirror dsh-ssh-ops).
 */
import { DESCRIPTORS } from "./descriptors.js";
import { workbenchErrorSchema } from "./schemas.js";

export const TYPERT = {
  package: "@lycheelink/dsh-workbench",
  face: "host",
  schemas: [
    {
      name: "workbenchError",
      // Dual-shape schema entry: eager `schema` satisfies the ≤0.1.5-rc.2
      // loader (`_zod in schema.schema`); `create` satisfies master's lazy
      // materialization (`record.create()`).
      schema: workbenchErrorSchema,
      create: () => workbenchErrorSchema
    }
  ],
  invocations: DESCRIPTORS,
  model: {
    events: [],
    objects: [],
    services: [
      {
        description: "Enterprise Agent Workbench for the DSH Web UI: scene-card grid with dynamic parameter forms, session launch, and control-room monitoring of card sessions.",
        summary: "Scene-card driven agent workbench.",
        tags: [],
        jsDoc: "/**\n * Scene-card driven agent workbench.\n */",
        key: "workbench",
        exportName: "WorkbenchService",
        members: [
          { kind: "method", name: "listCards", signature: "async listCards(request: WorkbenchListCardsRequest): Promise<WorkbenchListCardsResult>" },
          { kind: "method", name: "getCard", signature: "async getCard(request: WorkbenchGetCardRequest): Promise<WorkbenchGetCardResult>" },
          { kind: "method", name: "launchCardSession", signature: "async launchCardSession(request: WorkbenchLaunchCardSessionRequest): Promise<WorkbenchLaunchCardSessionResult>" },
          { kind: "method", name: "updateCard", signature: "async updateCard(request: WorkbenchUpdateCardRequest): Promise<WorkbenchUpdateCardResult>" },
          { kind: "method", name: "resetCard", signature: "async resetCard(request: WorkbenchResetCardRequest): Promise<WorkbenchResetCardResult>" },
          { kind: "method", name: "listSessions", signature: "async listSessions(request: WorkbenchListSessionsRequest): Promise<WorkbenchListSessionsResult>" },
          { kind: "method", name: "getSession", signature: "async getSession(request: WorkbenchGetSessionRequest): Promise<WorkbenchGetSessionResult>" },
          { kind: "method", name: "deleteSession", signature: "async deleteSession(request: WorkbenchDeleteSessionRequest): Promise<WorkbenchDeleteSessionResult>" }
        ],
        types: [
          { name: "WorkbenchListCardsRequest", declaration: "export interface WorkbenchListCardsRequest {}" },
          { name: "WorkbenchListCardsResult", declaration: "export type WorkbenchListCardsResult = WorkbenchResult<{ cards: WorkbenchCard[] }>;" },
          { name: "WorkbenchGetCardRequest", declaration: "export interface WorkbenchGetCardRequest { readonly id: string; }" },
          { name: "WorkbenchGetCardResult", declaration: "export type WorkbenchGetCardResult = WorkbenchResult<{ card: WorkbenchCard }>;" },
          { name: "WorkbenchLaunchCardSessionRequest", declaration: "export interface WorkbenchLaunchCardSessionRequest { readonly cardId: string; readonly formData: Record<string, unknown>; }" },
          { name: "WorkbenchLaunchCardSessionResult", declaration: "export type WorkbenchLaunchCardSessionResult = WorkbenchResult<{ session: WorkbenchCardSession }>;" },
          { name: "WorkbenchUpdateCardRequest", declaration: "export interface WorkbenchUpdateCardRequest { readonly cardId: string; readonly patch: { readonly title?: string; readonly description?: string; readonly systemPrompt?: string; readonly allowedTools?: string[]; }; }" },
          { name: "WorkbenchUpdateCardResult", declaration: "export type WorkbenchUpdateCardResult = WorkbenchResult<{ card: WorkbenchCard }>;" },
          { name: "WorkbenchResetCardRequest", declaration: "export interface WorkbenchResetCardRequest { readonly cardId: string; }" },
          { name: "WorkbenchResetCardResult", declaration: "export type WorkbenchResetCardResult = WorkbenchResult<{ card: WorkbenchCard }>;" },
          { name: "WorkbenchListSessionsRequest", declaration: "export interface WorkbenchListSessionsRequest {}" },
          { name: "WorkbenchListSessionsResult", declaration: "export type WorkbenchListSessionsResult = WorkbenchResult<{ sessions: WorkbenchCardSession[] }>;" },
          { name: "WorkbenchGetSessionRequest", declaration: "export interface WorkbenchGetSessionRequest { readonly sessionId: string; }" },
          { name: "WorkbenchGetSessionResult", declaration: "export type WorkbenchGetSessionResult = WorkbenchResult<{ session: WorkbenchCardSession }>;" },
          { name: "WorkbenchDeleteSessionRequest", declaration: "export interface WorkbenchDeleteSessionRequest { readonly sessionId: string; }" },
          { name: "WorkbenchDeleteSessionResult", declaration: "export type WorkbenchDeleteSessionResult = WorkbenchResult<{ deleted: boolean }>;" },
          { name: "WorkbenchResult", declaration: "export type WorkbenchResult<T> = { ok: true; value: T } | { ok: false; error: { code: string; message: string } };" },
          { name: "WorkbenchCard", declaration: "export interface WorkbenchCard { readonly id: string; readonly title: string; readonly description: string; readonly icon: string; readonly category: string; readonly formSchema: WorkbenchFormField[]; readonly conditionalFields?: WorkbenchConditionalField[]; readonly agentConfig: WorkbenchAgentConfig; }" },
          { name: "WorkbenchFormField", declaration: "export interface WorkbenchFormField { readonly key: string; readonly label: string; readonly type: 'text' | 'textarea' | 'select' | 'file' | 'date'; readonly required: boolean; readonly placeholder?: string; readonly options?: { readonly label: string; readonly value: string }[]; readonly description?: string; }" },
          { name: "WorkbenchConditionalField", declaration: "export interface WorkbenchConditionalField { readonly when: string; readonly fields: WorkbenchFormField[]; }" },
          { name: "WorkbenchAgentConfig", declaration: "export interface WorkbenchAgentConfig { readonly preset?: string; readonly systemPrompt: string; readonly allowedTools?: string[]; readonly skills?: string[]; }" },
          { name: "WorkbenchCardSession", declaration: "export interface WorkbenchCardSession { readonly sessionId: string; readonly cardId: string; readonly cardTitle: string; readonly status: 'created' | 'running' | 'awaiting_decision' | 'completed' | 'failed'; readonly createdAt: string; readonly updatedAt: string; readonly stepDescription?: string; readonly spawnedSessionId?: string; }" }
        ]
      }
    ]
  }
};

export default TYPERT;

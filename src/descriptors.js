/**
 * Invocation descriptors for the `workbench` Remote — one source of truth
 * consumed by both the host TYPERT manifest (typert.js) and the client
 * contribution (remote.js), mirroring the shape the repo's typert generator
 * and dsh-ssh-ops emit.
 *
 * Every method takes a single JSON `request` and returns the business envelope
 * modeled by `resultSchema` in schemas.js.
 */
import {
  emptyRequestSchema,
  getCardRequestSchema,
  launchCardSessionRequestSchema,
  updateCardRequestSchema,
  resetCardRequestSchema,
  getSessionRequestSchema,
  listCardsResultSchema,
  getCardResultSchema,
  launchCardSessionResultSchema,
  updateCardResultSchema,
  resetCardResultSchema,
  listSessionsResultSchema,
  getSessionResultSchema,
  deleteSessionResultSchema
} from "./schemas.js";

const PACKAGE = "@lycheelink/dsh-workbench";
const NS = "workbench";

function def(method, requestSchema, requestType, resultSchema, resultType) {
  return {
    id: `${PACKAGE}#${NS}/${method}`,
    service: NS,
    namespace: NS,
    method,
    invocation: { kind: "direct" },
    parameters: [
      {
        name: "request",
        wire: "request",
        source: "json",
        codec: {
          mode: "strict",
          typeSymbol: `${PACKAGE}/types#${requestType}`,
          // Dual-shape codec: eager `schema` satisfies host ≤0.1.5-rc.2
          // (`codec.schema.parse`); `create` factory satisfies master
          // (lazy materialization via `codec.create().parse()`).
          schema: requestSchema,
          create: () => requestSchema
        }
      }
    ],
    result: {
      mode: "strict",
      typeSymbol: `${PACKAGE}/types#${resultType}`,
      schema: resultSchema,
      create: () => resultSchema
    },
    sourceLocation: { file: "src/index.js", line: 1, column: 1 }
  };
}

export const DESCRIPTORS = [
  def("listCards", emptyRequestSchema, "WorkbenchListCardsRequest", listCardsResultSchema, "WorkbenchListCardsResult"),
  def("getCard", getCardRequestSchema, "WorkbenchGetCardRequest", getCardResultSchema, "WorkbenchGetCardResult"),
  def("launchCardSession", launchCardSessionRequestSchema, "WorkbenchLaunchCardSessionRequest", launchCardSessionResultSchema, "WorkbenchLaunchCardSessionResult"),
  def("updateCard", updateCardRequestSchema, "WorkbenchUpdateCardRequest", updateCardResultSchema, "WorkbenchUpdateCardResult"),
  def("resetCard", resetCardRequestSchema, "WorkbenchResetCardRequest", resetCardResultSchema, "WorkbenchResetCardResult"),
  def("listSessions", emptyRequestSchema, "WorkbenchListSessionsRequest", listSessionsResultSchema, "WorkbenchListSessionsResult"),
  def("getSession", getSessionRequestSchema, "WorkbenchGetSessionRequest", getSessionResultSchema, "WorkbenchGetSessionResult"),
  def("deleteSession", getSessionRequestSchema, "WorkbenchDeleteSessionRequest", deleteSessionResultSchema, "WorkbenchDeleteSessionResult")
];

export default DESCRIPTORS;

/**
 * Browser-side client for the `workbench` Remote namespace. The namespace
 * service is mounted by apply() through ctx.remote.$mount(TYPERT_REMOTE);
 * this class unwraps the { ok, value | error } envelope into values or thrown
 * errors.
 */
export class WorkbenchApiError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "WorkbenchApiError";
    this.code = code;
  }
}

export class WorkbenchApi {
  /** @param {() => object|undefined} getNamespace live namespace getter */
  constructor(getNamespace) {
    this.getNamespace = getNamespace;
  }

  async call(method, args = {}) {
    const namespace = this.getNamespace();
    const fn = namespace?.[method];
    if (typeof fn !== "function") {
      throw new WorkbenchApiError("not-mounted", `workbench Remote method "${method}" is not mounted`);
    }
    const rpc = await fn(args);
    if (!rpc || rpc.ok !== true) {
      // Preserve the transport error code when the wire supplies one.
      throw new WorkbenchApiError(rpc?.error?.code ?? "rpc-failed", rpc?.error?.message ?? "remote call failed");
    }
    const business = rpc.value;
    if (!business || typeof business.ok !== "boolean") {
      throw new WorkbenchApiError("bad-envelope", `workbench Remote method "${method}" returned an unexpected payload shape`);
    }
    if (business.ok) return business.value;
    throw new WorkbenchApiError(business.error?.code ?? "rpc-failed", business.error?.message ?? "remote call failed");
  }

  listCards() {
    return this.call("listCards", {});
  }

  getCard(id) {
    return this.call("getCard", { id });
  }

  launchCardSession(cardId, formData) {
    return this.call("launchCardSession", { cardId, formData });
  }

  listSessions() {
    return this.call("listSessions", {});
  }

  getSession(sessionId) {
    return this.call("getSession", { sessionId });
  }

  deleteSession(sessionId) {
    return this.call("deleteSession", { sessionId });
  }
}

/**
 * Build the WorkbenchApi bound to the gateway's live `workbench` namespace
 * service. Mirrors the dsh-ssh-ops reach-around: the gateway's
 * ClientRemoteService keeps live namespace services in its `namespaces` map.
 *
 * NOTE: `namespaces` is a TypeScript-private instance field (runtime-visible,
 * but not a documented public API). This is the only working mechanism on
 * host 0.1.2 (same as ssh-ops); re-audit on any host upgrade — the 0.1.5
 * audit already flags API breaks in this area.
 */
export function createWorkbenchApi(ctx) {
  return new WorkbenchApi(() => {
    const remote = ctx.remote;
    return remote?.namespaces?.get("workbench")?.service;
  });
}
/**
 * Real-logic verification: run the ACTUAL @deepseek-ai typert-loader and
 * typert-registry releases (0.1.5-rc.2 + 0.1.6-alpha.1) against the built
 * dsh-workbench artifacts (lib/typert.js, lib/descriptors.js).
 *
 * This is the same code the host runs at the manifest boundary:
 *   - validateTypertManifest(pkgName, TYPERT)  → the typert-loader gate
 *   - new TypertRegistry(ctx).register(TYPERT) → deep validateInvocation /
 *     validateSchemas / validatePackage (the gateway dispatch codecs)
 *
 * The real packages are vendored under test/vendor (npm aliases). If they are
 * absent the script skips with guidance so `npm test` stays green on a fresh
 * clone.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { TYPERT } from "../lib/typert.js";

const VENDOR = new URL("../.rc-verify/vendor/node_modules/", import.meta.url);
const VENDOR_PKGS = [
  "dsh-typert-loader-rc2/lib/index.js",
  "dsh-typert-loader-next/lib/index.js",
  "dsh-typert-registry-rc2/lib/index.js",
  "dsh-typert-registry-next/lib/index.js",
  "@deepseek-ai/cordis/lib/index.js"
];

if (!VENDOR_PKGS.every((p) => existsSync(new URL(p, VENDOR)))) {
  console.log(
    "rc-verify: real 0.1.5-rc.2 / 0.1.6-alpha.1 packages not vendored — run `npm run setup:rc` to install, then re-run. Skipping."
  );
  process.exit(0);
}

const { validateTypertManifest: validateRc2 } = await import(
  new URL("dsh-typert-loader-rc2/lib/index.js", VENDOR).href
);
const { validateTypertManifest: validateNext } = await import(
  new URL("dsh-typert-loader-next/lib/index.js", VENDOR).href
);
const { TypertRegistry: RegistryRc2 } = await import(
  new URL("dsh-typert-registry-rc2/lib/index.js", VENDOR).href
);
const { TypertRegistry: RegistryNext } = await import(
  new URL("dsh-typert-registry-next/lib/index.js", VENDOR).href
);
const { Context } = await import(
  new URL("@deepseek-ai/cordis/lib/index.js", VENDOR).href
);

// ── Helpers ─────────────────────────────────────────────────────────────────

function registerOn(RegistryCtor, manifest) {
  const app = new Context();
  const registry = new RegistryCtor(app);
  const dispose = registry.register(manifest); // throws if the manifest is invalid
  return { registry, dispose };
}

function dropKey(obj, key) {
  const { [key]: _dropped, ...rest } = obj;
  return rest;
}

/** Strip `key` from every descriptor codec (parameters + result). */
function dropFromCodecs(manifest, key) {
  return {
    ...manifest,
    invocations: manifest.invocations.map((descriptor) => ({
      ...descriptor,
      parameters: descriptor.parameters.map((parameter) => ({
        ...parameter,
        codec: dropKey(parameter.codec, key)
      })),
      result: dropKey(descriptor.result, key)
    }))
  };
}

/** Overwrite `key` on every descriptor codec with `value`. */
function replaceFromCodecs(manifest, key, value) {
  return {
    ...manifest,
    invocations: manifest.invocations.map((descriptor) => ({
      ...descriptor,
      parameters: descriptor.parameters.map((parameter) => ({
        ...parameter,
        codec: { ...parameter.codec, [key]: value }
      })),
      result: { ...descriptor.result, [key]: value }
    }))
  };
}

function expectThrows(label, fn, pattern) {
  let threw = null;
  try {
    fn();
  } catch (error) {
    threw = error instanceof Error ? error.message : String(error);
  }
  assert.ok(threw !== null, `${label}: expected to throw, did not`);
  if (pattern !== undefined) {
    assert.match(threw, pattern, `${label}: wrong failure reason`);
  }
}

// ── 1. Real typert-loader validateTypertManifest ────────────────────────────

// 0.1.5-rc.2 (latest RC): schemas must be zod v4 instances (`_zod`), codecs too.
assert.equal(validateRc2("dsh-workbench", TYPERT).package, "dsh-workbench", "rc2 loader accepts the manifest");

// 0.1.6-alpha.1 (master line): schemas must also expose a `create()` factory.
assert.equal(validateNext("dsh-workbench", TYPERT).package, "dsh-workbench", "next loader accepts the dual-shape manifest");

// ── 2. Real typert-registry register() (deep invoke/schema/package validation)

let r = registerOn(RegistryRc2, TYPERT);
assert.equal(r.registry.list().length, 1, "rc2 registry registers the schema");
r.dispose();

r = registerOn(RegistryNext, TYPERT);
assert.equal(r.registry.list().length, 1, "next registry registers the schema");
r.dispose();

// ── 3. Negative discrimination — the gates are real, dual-shape is required ──

// Loader@0.1.5-rc.2 requires an eager zod v4 schema (`_zod`) on manifest schemas.
expectThrows(
  "rc2 loader rejects schemas without an eager zod schema",
  () => validateRc2("dsh-workbench", { ...TYPERT, schemas: TYPERT.schemas.map((s) => ({ name: s.name, create: s.create })) }),
  /zod v4/
);

// Loader@0.1.6-alpha.1 still enforces the same `_zod` gate (the create()
// factory requirement was added on master AFTER this alpha).
expectThrows(
  "next loader rejects schemas without an eager zod schema",
  () => validateNext("dsh-workbench", { ...TYPERT, schemas: TYPERT.schemas.map((s) => ({ name: s.name, create: s.create })) }),
  /zod v4/
);

// Registry@0.1.5-rc.2 AND 0.1.6-alpha.1 require codec.schema with `.parse`
// (a non-zod object triggers the real "no parse() method" gate).
for (const [label, RegistryCtor] of [["rc2 registry", RegistryRc2], ["next registry", RegistryNext]]) {
  expectThrows(
    `${label} rejects codecs whose schema lacks parse()`,
    () => registerOn(RegistryCtor, replaceFromCodecs(TYPERT, "schema", {})).dispose(),
    /no parse\(\) method/
  );
}

// Loader package-ownership gate (both versions).
expectThrows(
  "rc2 loader rejects a manifest owned by another package",
  () => validateRc2("dsh-workbench", { ...TYPERT, package: "dsh-other" }),
  /must be owned by the package/
);
expectThrows(
  "next loader rejects a manifest owned by another package",
  () => validateNext("dsh-workbench", { ...TYPERT, package: "dsh-other" }),
  /must be owned by the package/
);

// ── 4. Master contract pin (unpublished) ─────────────────────────────────────
// The `create()` factories we ship on codecs/schemas are required by master's
// registry (`validateCodec` → `codec.create`), which is not yet published.
// Pin that contract from a deepseek-harness checkout when one is reachable so
// a future host upgrade re-audits loudly instead of silently shipping
// eager-only codecs. Optional: point DSH_MASTER_SRC at the checkout root.
function masterRegistrySrc() {
  const candidatePaths = [];
  if (process.env.DSH_MASTER_SRC) {
    candidatePaths.push(join(process.env.DSH_MASTER_SRC, "packages/typert/registry/src/service.ts"));
  }
  // Sibling checkout of the deployments tree on this machine (base = workbench/,
  // 6 `..` reaches /opt/workspace/, then /github/deepseek-harness).
  candidatePaths.push(
    resolve(fileURLToPath(new URL("../..", import.meta.url)), "../../../../../../github/deepseek-harness/packages/typert/registry/src/service.ts")
  );
  for (const path of candidatePaths) {
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  return undefined;
}
const masterSrc = masterRegistrySrc();
if (masterSrc !== undefined) {
  assert.match(
    masterSrc,
    /has no create\(\) factory/,
    "master registry requires codec.create() — why the dual-shape ships create (schema itself is proven by the published-version real checks above)"
  );
  console.log("rc-verify: master registry source-contract pin OK (codec.create gate present)");
} else {
  console.log("rc-verify: master checkout not reachable — skipping unpublished create()-gate contract pin");
}

console.log("rc-verify: real typert-loader/registry validation passed on 0.1.5-rc.2 + 0.1.6-alpha.1 (incl. negative gates)");

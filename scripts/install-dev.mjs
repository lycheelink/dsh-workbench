/**
 * Dev install helper: symlink the plugin into a DSH profile's node_modules so
 * `dsh plugin` / the harness can resolve it. Usage:
 *   node scripts/install-dev.mjs [profileName]   (default: web)
 */
import { mkdirSync, symlinkSync, existsSync, rmSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const profileName = process.argv[2] ?? "web";
const profileModules = resolve(homedir(), ".dsh/profiles", profileName, "node_modules");
const scopeDir = join(profileModules, "@lycheelink");
const linkPath = join(scopeDir, "dsh-workbench");
const legacyPath = join(profileModules, "dsh-workbench");

mkdirSync(scopeDir, { recursive: true });
// Best-effort removal of the pre-scoped symlink location (dsh-workbench).
if (existsSync(legacyPath)) {
  rmSync(legacyPath, { recursive: true, force: true });
}
if (existsSync(linkPath)) {
  rmSync(linkPath, { recursive: true, force: true });
}
symlinkSync(rootDir, linkPath, "junction");
console.log(`install-dev: linked ${rootDir} -> ${linkPath}`);

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
const linkPath = join(profileModules, "dsh-workbench");

mkdirSync(profileModules, { recursive: true });
if (existsSync(linkPath)) {
  rmSync(linkPath, { recursive: true, force: true });
}
symlinkSync(rootDir, linkPath, "junction");
console.log(`install-dev: linked ${rootDir} -> ${linkPath}`);

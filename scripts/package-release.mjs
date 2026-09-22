/**
 * Release packaging: build then create a tarball of the publishable files.
 */
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
execSync("npm run build", { cwd: rootDir, stdio: "inherit" });
execSync("npm pack", { cwd: rootDir, stdio: "inherit" });
console.log("pack:release done");

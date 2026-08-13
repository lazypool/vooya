import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const pre = JSON.parse(readFileSync(resolve(root, ".changeset/pre.json"), "utf8"));
const directory = mkdtempSync(resolve(tmpdir(), "vooya-release-status-"));
const output = resolve(directory, "status.json");

try {
  const result = spawnSync(resolve(root, "node_modules/.bin/changeset"), ["status", `--output=${output}`], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout);
  const status = JSON.parse(readFileSync(output, "utf8"));
  console.log(`Changesets pre mode: ${pre.mode} (${pre.tag})`);
  console.log(`Consumed history IDs: ${pre.changesets.length}`);
  console.log(`Pending changesets: ${status.changesets.length}`);
  console.log(`Planned releases: ${status.releases.length}`);
  if (pre.mode === "pre") console.log("Consumed markdown files are release history; do not delete them before an intentional pre exit/version lifecycle.");
} finally {
  rmSync(directory, { force: true, recursive: true });
}

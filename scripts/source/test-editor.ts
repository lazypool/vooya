import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";

run(npm, ["ci", "--prefix", "editors/vscode"]);
run(npm, ["test", "--prefix", "editors/vscode"]);

const extensionHost = ["run", "test:extension-host", "--prefix", "editors/vscode"];
if (process.platform === "linux" && canRun("xvfb-run", ["--help"])) {
  run("xvfb-run", ["-a", npm, ...extensionHost]);
} else {
  run(npm, extensionHost);
}

function canRun(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "ignore" });
  return !result.error && result.status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}.`);
}

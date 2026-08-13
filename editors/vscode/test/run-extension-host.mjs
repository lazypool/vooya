import { runTests } from "@vscode/test-electron";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const extensionDevelopmentPath = fileURLToPath(new URL("..", import.meta.url));
const extensionTestsPath = fileURLToPath(new URL("./extension-host.cjs", import.meta.url));

const userDataDir = await mkdtemp(join(tmpdir(), "vooya-vscode-"));
await runTests({
  extensionDevelopmentPath,
  extensionTestsPath,
  launchArgs: ["--disable-extensions", `--user-data-dir=${userDataDir}`],
});

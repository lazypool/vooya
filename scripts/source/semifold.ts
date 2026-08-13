// This launcher handles host process errors from Node and is intentionally
// permissive at that boundary.
// @ts-nocheck
import { spawnSync } from "node:child_process";
import { chmodSync, existsSync, mkdirSync, renameSync, rmSync } from "node:fs";
import { arch, platform } from "node:os";
import { dirname, resolve } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";

const [command, ...args] = process.argv.slice(2);
if (!command) throw new Error("Usage: node scripts/generated/semifold.js <Semifold command> [...args]");

const root = fileURLToPath(new URL("../..", import.meta.url));
const version = "v0.3.0";
const releases = {
  "darwin-arm64": {
    asset: "semifold-macos-arm64",
    sha256: "92509eab106f91f530715e4601d29c57e81a4bc8fa69cac6ab02b64d14036a1e",
  },
  "darwin-x64": {
    asset: "semifold-macos-x86_64",
    sha256: "2160a679a3f2f34c53c5e9187bfa297f2b4d69ac4c0be119368fb3287ae822fe",
  },
  "linux-arm64": {
    asset: "semifold-linux-arm64",
    sha256: "6fcf6dc73a7fd9132b57d9ed5e127d27246c135c796addc558e92764632cadee",
  },
  "linux-x64": {
    asset: "semifold-linux-x86_64",
    sha256: "5800bc9389e230bead6cf23ca528928b872a719c90034a940a52270c57424324",
  },
  "win32-arm64": {
    asset: "semifold-windows-arm64.exe",
    sha256: "0d473bd88c8d3fa2a8e226ba0cf33ef867b33bad972bb844500c36152a2ee82a",
  },
  "win32-x64": {
    asset: "semifold-windows-x86_64.exe",
    sha256: "e269d155fdd230f9341186cfcb156167b2fd2dcef2a4b617bf8cc78ae7d369c3",
  },
};

const candidates = [process.env.SEMIFOLD_BIN, "semifold", "smif"].filter(Boolean);
let lastError;
let completed = false;
for (const binary of candidates) {
  const result = spawnSync(binary, [command, ...args], { stdio: "inherit" });
  if (result.error?.code === "ENOENT") {
    lastError = result.error;
    continue;
  }
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  completed = result.status === 0;
  break;
}

if (process.exitCode === undefined) {
  const binary = await cachedBinary();
  const result = spawnSync(binary, [command, ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
  completed = result.status === 0;
}

if (completed && command === "version" && !args.includes("--dry-run")) {
  const npm = platform() === "win32" ? "npm.cmd" : "npm";
  const sync = spawnSync(npm, ["install", "--package-lock-only", "--ignore-scripts"], { stdio: "inherit" });
  if (sync.error) throw sync.error;
  if (sync.status !== 0) {
    throw new Error(`Semifold updated package manifests, but npm failed to synchronize package-lock.json (exit ${sync.status}). Fix the lockfile before committing the release plan.`);
  }
}

async function cachedBinary() {
  const release = releases[`${platform()}-${arch()}`];
  if (!release) {
    throw new Error(`Semifold ${version} has no verified binary for ${platform()}-${arch()}. Set SEMIFOLD_BIN to an installed Semifold binary.`);
  }

  const cachePath = resolve(root, ".vooya-tools", version, release.asset);
  if (!existsSync(cachePath)) {
    mkdirSync(dirname(cachePath), { recursive: true });
    const temporaryPath = `${cachePath}.download`;
    try {
      const curl = spawnSync(platform() === "win32" ? "curl.exe" : "curl", ["--fail", "--location", "--retry", "3", "--silent", "--show-error", `https://github.com/noctisynth/semifold/releases/download/semifold-${version}/${release.asset}`, "--output", temporaryPath], { encoding: "utf8" });
      if (curl.error) throw curl.error;
      if (curl.status !== 0) throw new Error(curl.stderr || `curl exited with ${curl.status}`);
      const bytes = await import("node:fs/promises").then(({ readFile }) => readFile(temporaryPath));
      const digest = createHash("sha256").update(bytes).digest("hex");
      if (release.sha256 && digest !== release.sha256) {
        throw new Error(`checksum mismatch for ${release.asset}: expected ${release.sha256}, got ${digest}`);
      }
      renameSync(temporaryPath, cachePath);
      if (platform() !== "win32") chmodSync(cachePath, 0o755);
    } catch (error) {
      rmSync(temporaryPath, { force: true });
      throw new Error(`Could not provision Semifold ${version}: ${error instanceof Error ? error.message : String(error)}. Set SEMIFOLD_BIN to use a separately installed binary.`);
    }
  }
  return cachePath;
}

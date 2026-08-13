import assert from "node:assert/strict";
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const fixture = mkdtempSync(resolve(tmpdir(), "vooya-semifold-plan-"));

try {
  cpSync(resolve(root, ".changes"), resolve(fixture, ".changes"), { recursive: true });
  cpSync(resolve(root, "packages"), resolve(fixture, "packages"), {
    recursive: true,
    filter(source) {
      return !source.includes("node_modules") && !source.includes(".artifact-build") && !source.includes("dist");
    },
  });
  writeFileSync(resolve(fixture, "package.json"), JSON.stringify({ private: true, workspaces: ["packages/*"] }));
  writeFileSync(resolve(fixture, ".changes", "fixed-group.md"), `---\nvooya-compiler: "patch:chore"\nvooya-core: "patch:chore"\nvooya-vite-plugin: "patch:chore"\nvooya-vue: "patch:chore"\nvooya-react: "patch:chore"\n---\n\nVerify Vooya's coordinated release group.\n`);
  for (const args of [["init", "--quiet"], ["add", "."], ["-c", "user.name=Vooya test", "-c", "user.email=tests@vooya.dev", "commit", "--quiet", "-m", "fixture"]]) {
    const git = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
    assert.equal(git.status, 0, git.stderr || git.stdout);
  }

  const result = spawnSync(process.execPath, [resolve(root, "scripts/generated/semifold.js"), "status"], {
    cwd: fixture,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const output = `${result.stdout}\n${result.stderr}`;
  assert.match(output, /已规划 5 个包|planned 5 package/i);
  for (const id of ["vooya-compiler", "vooya-core", "vooya-vite-plugin", "vooya-vue", "vooya-react"]) {
    assert.match(output, new RegExp(id));
  }

  const version = spawnSync(process.execPath, [resolve(root, "scripts/generated/semifold.js"), "version", "--dry-run"], {
    cwd: fixture,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(version.status, 0, version.stderr || version.stdout);
  const versionOutput = `${version.stdout}\n${version.stderr}`;
  for (const id of ["vooya-compiler", "vooya-core", "vooya-vite-plugin", "vooya-vue", "vooya-react"]) {
    assert.match(versionOutput, new RegExp(id));
  }
  assert.match(versionOutput, /0\.1\.0-alpha\.7/);

  const apply = spawnSync(process.execPath, [resolve(root, "scripts/generated/semifold.js"), "version"], {
    cwd: fixture,
    encoding: "utf8",
    env: process.env,
  });
  assert.equal(apply.status, 0, apply.stderr || apply.stdout);
  const lockfile = JSON.parse(readFileSync(resolve(fixture, "package-lock.json"), "utf8"));
  for (const directory of ["compiler", "core", "vite-plugin", "vue", "react"]) {
    assert.equal(lockfile.packages[`packages/${directory}`].version, "0.1.0-alpha.7");
  }
  assert.equal(lockfile.packages["packages/vite-plugin"].dependencies["@vooya/core"], "0.1.0-alpha.7");
  assert.equal(lockfile.packages["packages/vite-plugin"].dependencies["@vooya/compiler"], "0.1.0-alpha.7");
  console.log("Semifold fixed-group status, version dry-run, and lockfile synchronization passed.");
} finally {
  rmSync(fixture, { force: true, recursive: true });
}

import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";

import { inspectGeneratedTypesConfiguration } from "../dist/typescript-config.js";

const repositoryRoot = resolve(import.meta.dirname, "../../..");

test("reports the exact tsconfig settings needed for central declarations", () => {
  const root = mkdtempSync(resolve(repositoryRoot, ".vooya-tsconfig-test-"));
  try {
    writeFileSync(resolve(root, "package.json"), '{"private":true}\n');
    writeFileSync(
      resolve(root, "tsconfig.json"),
      '{"compilerOptions":{"moduleResolution":"Bundler"}}\n',
    );
    const problem = inspectGeneratedTypesConfiguration(root);
    assert.match(problem.message, /allowArbitraryExtensions/);
    assert.match(problem.message, /\.vooya\/types/);

    writeFileSync(
      resolve(root, "tsconfig.json"),
      JSON.stringify({
        compilerOptions: {
          allowArbitraryExtensions: true,
          rootDirs: [".", ".vooya/types"],
        },
      }),
    );
    assert.equal(inspectGeneratedTypesConfiguration(root), undefined);

    writeFileSync(resolve(root, "tsconfig.json"), '{"files":[],"references":[{"path":"./tsconfig.app.json"}]}');
    writeFileSync(
      resolve(root, "tsconfig.app.json"),
      JSON.stringify({
        compilerOptions: {
          allowArbitraryExtensions: true,
          rootDirs: [".", ".vooya/types"],
        },
      }),
    );
    assert.equal(inspectGeneratedTypesConfiguration(root), undefined);
  } finally {
    rmSync(root, { force: true, recursive: true });
  }
});

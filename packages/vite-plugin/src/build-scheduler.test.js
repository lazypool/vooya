import assert from "node:assert/strict";
import test from "node:test";

import { createBuildScheduler } from "./build-scheduler.js";

test("coalesces rapid changes into one build", async () => {
  let builds = 0;
  const scheduler = createBuildScheduler({ build: () => builds++ });

  scheduler.schedule();
  scheduler.schedule();
  scheduler.schedule();
  await scheduler.flush();

  assert.equal(builds, 1);
});

test("runs one follow-up build when a change arrives during a build", async () => {
  let builds = 0;
  let releaseFirstBuild;
  const firstBuild = new Promise((resolve) => {
    releaseFirstBuild = resolve;
  });
  let markStarted;
  const started = new Promise((resolve) => {
    markStarted = resolve;
  });
  const scheduler = createBuildScheduler({
    async build() {
      builds += 1;
      if (builds === 1) {
        markStarted();
        await firstBuild;
      }
    },
  });

  scheduler.schedule();
  const completed = scheduler.flush();
  await started;
  scheduler.schedule();
  scheduler.schedule();
  releaseFirstBuild();
  await completed;

  assert.equal(builds, 2);
});

test("reports a failed build and recovers on the next change", async () => {
  let builds = 0;
  const errors = [];
  const scheduler = createBuildScheduler({
    build() {
      builds += 1;
      if (builds === 1) throw new Error("invalid Rust");
    },
    onError(error) {
      errors.push(error.message);
    },
  });

  scheduler.schedule();
  await scheduler.flush();
  scheduler.schedule();
  await scheduler.flush();

  assert.deepEqual(errors, ["invalid Rust"]);
  assert.equal(builds, 2);
});

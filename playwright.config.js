import { defineConfig, devices } from "@playwright/test";

const targets = {
  vue: {
    command: "npm run dev:vue -- --host 127.0.0.1 --port 4174",
    test: "vue-counter.spec.js",
    url: "http://127.0.0.1:4174",
  },
  react: {
    command: "npm run dev:react -- --host 127.0.0.1 --port 4175",
    test: "react-counter.spec.js",
    url: "http://127.0.0.1:4175",
  },
  tasks: {
    command: "npm run dev:tasks -- --host 127.0.0.1 --port 4176",
    test: "task-list.spec.js",
    url: "http://127.0.0.1:4176",
  },
  benchmark: {
    command: "npm run dev:benchmark -- --host 127.0.0.1 --port 4177",
    test: "data-grid.spec.js",
    url: "http://127.0.0.1:4177",
  },
  scatter: {
    command: "npm run dev:scatter -- --host 127.0.0.1 --port 4178",
    test: "scatter-plot.spec.js",
    url: "http://127.0.0.1:4178",
  },
};

const targetName = process.env.VOOYA_E2E_TARGET ?? "vue";
const target = targets[targetName];
if (!target) throw new Error(`Unknown VOOYA_E2E_TARGET "${targetName}".`);
const browserName = process.env.VOOYA_E2E_BROWSER ?? "chromium";
const browserProjects = {
  chromium: { use: { ...devices["Desktop Chrome"] } },
  firefox: { use: { ...devices["Desktop Firefox"] } },
};
const browserProject = browserProjects[browserName];
if (!browserProject) throw new Error(`Unknown VOOYA_E2E_BROWSER "${browserName}".`);

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: target.test,
  workers: 1,
  retries: 0,
  reporter: "line",
  use: {
    ...browserProject.use,
    baseURL: target.url,
    trace: "retain-on-failure",
  },
  webServer: {
    command: target.command,
    url: target.url,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});

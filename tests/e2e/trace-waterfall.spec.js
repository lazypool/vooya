import { expect, test } from "@playwright/test";

test("triages a dense trace waterfall without browser errors", async ({ page }) => {
  const errors = [];
  page.on("console", (message) => { if (message.type() === "error") errors.push(message.text()); });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  const island = page.locator('[data-vooya-island="trace-waterfall"]');
  await expect(page.getByRole("heading", { name: "Trace waterfall triage" })).toBeVisible();
  await expect(island.getByText("12000 matching spans")).toBeVisible();
  await island.getByLabel("Filter WASM services").selectOption("auth");
  await expect(island.getByText("3000 matching spans")).toBeVisible();
  await island.getByRole("button", { name: "Zoom in" }).click();
  await expect(island.getByText("125% zoom")).toBeVisible();
  await island.getByRole("button", { name: "Focus critical path" }).click();
  await expect(island.locator(".trace-row.critical")).toHaveCount(1);
  await island.getByRole("button", { name: "Measure workload" }).click();
  await expect(island.getByText(/4 service filters x12: median [\d.]+ ms, p95 [\d.]+ ms/)).toBeVisible();
  const baseline = page.locator('[data-baseline="trace-waterfall"]');
  await baseline.getByLabel("Filter Vue services").selectOption("auth");
  await expect(baseline.getByText("3000 matching spans")).toBeVisible();
  await baseline.getByRole("button", { name: "Measure workload" }).click();
  await expect(baseline.getByText(/4 service filters x12: median [\d.]+ ms, p95 [\d.]+ ms/)).toBeVisible();
  expect(errors).toEqual([]);
});

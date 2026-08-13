import { expect, test } from "@playwright/test";

async function expectCriticalInsideViewport(pane, rowSelector, viewportSelector) {
  await expect.poll(async () => {
    try {
      return await pane.evaluate((element, selectors) => {
        const row = element.querySelector(selectors.row);
        const viewportElement = element.querySelector(selectors.viewport);
        if (!row || !viewportElement) return false;
        const rowBox = row.getBoundingClientRect();
        if (!viewportElement) return false;
        const viewportBox = viewportElement.getBoundingClientRect();
        return rowBox.top >= viewportBox.top && rowBox.bottom <= viewportBox.bottom;
      }, { row: rowSelector, viewport: viewportSelector });
    } catch {
      return false;
    }
  }).toBe(true);
}

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
  await expectCriticalInsideViewport(island, ".trace-row.critical", "[data-viewport]");
  const baseline = page.locator('[data-baseline="trace-waterfall"]');
  await baseline.getByLabel("Filter Vue services").selectOption("auth");
  await expect(baseline.getByText("3000 matching spans")).toBeVisible();
  await baseline.getByRole("button", { name: "Focus critical path" }).click();
  await expectCriticalInsideViewport(baseline, ".row.critical", ".viewport");
  await expect(island.getByText("12000 matching spans | 125% zoom | critical path 858 ms")).toBeVisible();
  await expect(baseline.getByText("12000 matching spans | 100% zoom | critical path 858 ms")).toBeVisible();
  await island.getByRole("button", { name: "Measure workload" }).click();
  await expect(island.getByText(/4 service filters x12: median [\d.]+ ms, p95 [\d.]+ ms/)).toBeVisible();
  await baseline.getByRole("button", { name: "Measure workload" }).click();
  await expect(baseline.getByText(/4 service filters x12: median [\d.]+ ms, p95 [\d.]+ ms/)).toBeVisible();
  expect(errors).toEqual([]);
});

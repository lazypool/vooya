import { expect, test } from "@playwright/test";

test("renders and redraws a 150,000-point Rust scatter-plot island", async ({ page }) => {
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "150,000 point scatter plot" })).toBeVisible();
  const island = page.locator('[data-vooya-island="scatter-plot"]');
  await expect(island.getByText("150000 points | 100% zoom")).toBeVisible();
  const canvas = island.locator("canvas");
  await expect(canvas).toHaveAttribute("width", "960");
  await expect(canvas).toHaveAttribute("aria-label", "Scatter plot with 150000 points at 100% zoom");

  await island.getByRole("button", { name: "Zoom in" }).click();
  await expect(island.getByText("150000 points | 125% zoom")).toBeVisible();
  await expect(canvas).toHaveAttribute("aria-label", "Scatter plot with 150000 points at 125% zoom");
  await island.getByRole("button", { name: "Reset zoom" }).click();
  await expect(island.getByText("150000 points | 100% zoom")).toBeVisible();

  const pointControl = page.getByRole("slider", { name: "Points" });
  await pointControl.fill("50000");
  await expect(pointControl).toHaveValue("50000");
  await expect(island.getByText("50000 points | 100% zoom")).toBeVisible();
  await expect(canvas).toHaveAttribute("aria-label", "Scatter plot with 50000 points at 100% zoom");
  expect(browserErrors).toEqual([]);
});

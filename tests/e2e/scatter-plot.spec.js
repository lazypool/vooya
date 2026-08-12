import { expect, test } from "@playwright/test";

test("renders and redraws a 150,000-point Rust scatter-plot island", async ({ page }) => {
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");
  const island = page.locator('[data-vooya-island="scatter-plot"]');
  await expect(island.getByText("150000 points | 100% zoom")).toBeVisible();
  await expect(island.locator("canvas")).toHaveAttribute("width", "960");

  await island.getByRole("button", { name: "Zoom in" }).click();
  await expect(island.getByText("150000 points | 125% zoom")).toBeVisible();
  await island.getByRole("button", { name: "Reset zoom" }).click();
  await expect(island.getByText("150000 points | 100% zoom")).toBeVisible();

  await page.getByRole("slider", { name: "Points" }).fill("50000");
  await expect(island.getByText("50000 points | 100% zoom")).toBeVisible();
  expect(browserErrors).toEqual([]);
});

import { expect, test } from "@playwright/test";

test("runs a Rust .voo component through the Vue lifecycle", async ({ page }) => {
  const browserErrors = [];
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });
  page.on("pageerror", (error) => browserErrors.push(error.message));

  await page.goto("/");

  await expect(page.getByRole("status")).toHaveText("1");
  await page.getByRole("button", { name: "Increment" }).click();
  await expect(page.getByRole("status")).toHaveText("2");
  await expect(page.getByText("Vue received: 2")).toBeVisible();

  await page.getByRole("button", { name: "Set Vue prop to 10" }).click();
  await expect(page.getByRole("status")).toHaveText("10");

  await page.getByRole("button", { name: "Toggle Voya island" }).click();
  await expect(page.getByRole("button", { name: "Increment" })).toHaveCount(0);
  await page.getByRole("button", { name: "Toggle Voya island" }).click();
  await expect(page.getByRole("status")).toHaveText("10");

  expect(browserErrors).toEqual([]);
});

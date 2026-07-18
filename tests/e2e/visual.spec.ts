import { expect, test } from "@playwright/test";

test("captures the accepted desktop viewport for visual QA", async ({ page }) => {
  await page.setViewportSize({ width: 1536, height: 1024 });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { level: 1, name: "Conturează ideea" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/aideas-desktop.png" });
});

test("captures the accepted mobile viewport for visual QA", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(
    page.getByRole("navigation", { name: "Etapele proiectului pe mobil" }),
  ).toBeVisible();
  await page.screenshot({ path: "test-results/aideas-mobile.png" });
});

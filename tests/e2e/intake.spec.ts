import { expect, test } from "@playwright/test";

test("shows truthful intake and blocks research without a provider", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Conturează ideea" }),
  ).toBeVisible();
  const providerStatus = page.getByLabel("Starea providerilor");
  await expect(providerStatus.getByText("Codex neconectat")).toBeVisible();
  await expect(providerStatus.getByText("Claude neconectat")).toBeVisible();
  await expect(page.getByRole("switch")).not.toBeChecked();

  await page.getByRole("button", { name: "Trimite pentru analiză" }).click();

  await expect(
    page.getByText(
      "Formularul a trecut validarea locală, dar Research este blocat:",
      { exact: false },
    ),
  ).toBeVisible();
  await expect(
    page
      .locator(".workflow-rail")
      .getByText("Niciun agent nu a pornit: providerii nu sunt conectați."),
  ).toBeVisible();
});

test("uses the mobile intake paradigm without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  await expect(
    page.getByRole("navigation", { name: "Etapele proiectului pe mobil" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Trimite pentru analiză" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /^Notițe/ })).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

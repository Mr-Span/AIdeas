import { expect, test, type Page } from "@playwright/test";

async function completeClarifications(page: Page) {
  for (let index = 0; index < 8; index += 1) {
    await page.locator("#idea-answer").fill(`Răspuns complet pentru întrebarea ${index + 1}.`);
    await expect(
      page.getByText(`${index + 1} din 8 clarificări`, { exact: true }),
    ).toBeVisible();
    if (index < 7) {
      await page.getByRole("button", { name: "Înainte" }).click();
    }
  }
  await expect(page.getByText("8 din 8 clarificări", { exact: true })).toBeVisible();
}

test("persists the intake, supports two-way updates, and reports truthful progress", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1, name: "Conturează ideea" }),
  ).toBeVisible();
  const providerStatus = page.getByLabel("Starea providerilor");
  await expect(providerStatus.getByText("Codex neverificat")).toBeVisible();
  await expect(providerStatus.getByText("Claude neconectat")).toBeVisible();
  await expect(page.getByRole("switch")).not.toBeChecked();
  await expect(page.getByText("0 din 8 clarificări", { exact: true })).toBeVisible();
  await completeClarifications(page);

  const repeatedFile = {
    name: "client-reference.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("same-file-can-be-selected-again"),
  };
  await page.locator("#media-desktop").setInputFiles(repeatedFile);
  await expect(
    page.getByText("1 fișier pregătit pentru următoarea salvare."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Salvează schița" }).click();
  await expect(
    page.getByText("Schița a fost salvată în SQLite", { exact: false }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByText("8 din 8 clarificări", { exact: true })).toBeVisible();
  await expect(page.locator("#idea-answer")).toHaveValue(
    "Răspuns complet pentru întrebarea 1.",
  );
  await page.locator("#media-desktop").setInputFiles(repeatedFile);
  await expect(
    page.getByText("1 fișier pregătit pentru următoarea salvare."),
  ).toBeVisible();

  const publicMessage = "Confirmăm pașii mari înainte de implementare.";
  await page.getByLabel("Mesaj public pentru client").fill(publicMessage);
  await page.getByRole("button", { name: "Trimite", exact: true }).click();
  await expect(page.getByText(publicMessage, { exact: true })).toBeVisible();
  await expect(
    page.getByText("Identitate locală încă neautentificată"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Trimite pentru analiză" }).click();

  await expect(
    page.locator(".submission-notice").getByText(
      "Execuția Codex locală este dezactivată",
      { exact: false },
    ),
  ).toBeVisible();

  const workflow = page.locator(".workflow-rail");
  await expect(workflow.getByText("1 din 5 verificați")).toBeVisible();
  await expect(
    workflow.locator('[data-stage-status="verified"]'),
  ).toHaveText("Verificat");
  await expect(
    workflow.locator('[data-stage-status="blocked"]'),
  ).toHaveText("Blocat");
});

test("uses the mobile plan tracker without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await completeClarifications(page);

  await expect(
    page.getByRole("navigation", { name: "Etapele proiectului pe mobil" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Trimite pentru analiză" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Trimite pentru analiză" }).click();

  const planTrigger = page.getByRole("button", {
    name: "Planul proiectului 1/5 verificați",
  });
  await expect(planTrigger).toBeVisible();
  await planTrigger.click();

  const mobileStages = page.locator(".mobile-stage-list");
  await expect(
    mobileStages.getByText("Idee și context", { exact: true }),
  ).toBeVisible();
  await expect(
    mobileStages.getByText("Cercetare și validare", { exact: true }),
  ).toBeVisible();
  await expect(
    mobileStages.getByText("verificat", { exact: true }),
  ).toBeVisible();
  await expect(
    mobileStages.getByText("blocat", { exact: true }),
  ).toBeVisible();

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
});

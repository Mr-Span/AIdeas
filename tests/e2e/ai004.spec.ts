import { expect, test } from "@playwright/test";

const projectId = "10000000-0000-4000-8000-000000000001";
const revisionId = "10000000-0000-4000-8000-000000000002";
const roundId = "10000000-0000-4000-8000-000000000003";
const cardQuestion = "10000000-0000-4000-8000-000000000004";
const cardChoice = "10000000-0000-4000-8000-000000000005";

const project = {
  id: projectId,
  displayName: "Pilot AI-004",
  lifecycleState: "active",
  version: 2,
  completedAt: null,
  purgeAfter: null,
  updatedAt: "2026-07-20T12:00:00.000Z",
  draft: {
    revisionId,
    idea: "Un panou care transformă idei în planuri executabile.",
    clarifications: {},
    notes: "Date sintetice.",
    approvalRequired: true,
    submitted: true,
  },
  plan: {
    verifiedSteps: 2,
    visibleSteps: 5,
    progressPercent: 40,
    steps: [
      ["Idee și context", "verified"],
      ["Cercetare și validare", "verified"],
      ["Clarificări client–inginer", "waiting_client"],
      ["Plan tehnic", "not_started"],
      ["Implementare și verificare", "not_started"],
    ].map(([title, status], index) => ({
      id: `20000000-0000-4000-8000-00000000000${index}`,
      title,
      summary: title,
      status,
      nextAction: status === "waiting_client" ? "Aprobă răspunsurile." : null,
      updatedAt: "2026-07-20T12:00:00.000Z",
      verifiedAt: status === "verified" ? "2026-07-20T12:00:00.000Z" : null,
    })),
  },
  collaboration: [],
};

const waitingRound = {
  latestRound: {
    id: roundId,
    revisionId,
    status: "waiting_operator",
    roles: [
      "intent_analyst",
      "market_researcher",
      "product_validator",
      "media_strategist",
    ].map((role, index) => ({
      id: `30000000-0000-4000-8000-00000000000${index}`,
      role,
      status: "completed",
      providerRunId: `thread-${index}`,
      errorCode: null,
      errorDetail: null,
      updatedAt: "2026-07-20T12:00:00.000Z",
    })),
    proposals: [
      {
        id: "40000000-0000-4000-8000-000000000001",
        type: "finding",
        title: "Validarea umană rămâne limita de control",
        summary: "Operatorul aprobă deciziile înainte de planul tehnic.",
        rationale: "Separă cercetarea de mutațiile proiectului.",
        confidence: "high",
        evidence: [
          {
            url: "https://example.com/research",
            retrievedAt: "2026-07-20T12:00:00.000Z",
            boundary: "summary",
            text: "Rezumat sintetic.",
            confidence: "high",
          },
        ],
        roles: ["intent_analyst", "product_validator"],
        duplicateCount: 2,
        contradictedBy: [],
      },
    ],
    cards: [
      {
        id: cardQuestion,
        type: "question",
        prompt: "Cine vede rezultatele brute?",
        why: "Controlează confidențialitatea.",
        blocking: true,
        roles: ["intent_analyst"],
      },
      {
        id: cardChoice,
        type: "ab_choice",
        prompt: "Cum începe lansarea?",
        why: "Controlează riscul.",
        options: ["Doar operator", "Operator și client"],
        blocking: true,
        roles: ["product_validator"],
      },
    ],
    roleSummaries: {},
    approvedRevisionId: null,
    errorDetail: null,
    createdAt: "2026-07-20T12:00:00.000Z",
    updatedAt: "2026-07-20T12:00:00.000Z",
  },
};

test("reviews AI-004 proposals and approves a new revision", async ({ page }) => {
  await page.addInitScript((id) => {
    window.localStorage.setItem("aideas.project-pointer.v1", id);
  }, projectId);
  await page.route("**/api/operator/session", (route) =>
    route.fulfill({ json: { csrfToken: "synthetic-token" } }),
  );
  await page.route(`**/api/projects/${projectId}/research-round`, (route) =>
    route.fulfill({ json: waitingRound }),
  );
  await page.route(`**/api/projects/${projectId}/research`, (route) =>
    route.fulfill({
      json: {
        project,
        providerHealth: {
          provider: "codex",
          status: "ready",
          version: "fixture",
          authMode: "chatgpt",
          detail: "ready",
        },
        activeRun: null,
        latestRun: {
          runId: "50000000-0000-4000-8000-000000000001",
          providerKind: "codex_cli",
          providerRunId: "thread-baseline",
          status: "completed",
          canResume: false,
          startedAt: "2026-07-20T11:00:00.000Z",
          updatedAt: "2026-07-20T12:00:00.000Z",
          completedAt: "2026-07-20T12:00:00.000Z",
          errorCode: null,
          errorDetail: null,
          resultText: "# Raport de bază",
          resultDigest: "a".repeat(64),
        },
      },
    }),
  );
  await page.route(`**/api/projects/${projectId}`, (route) =>
    route.fulfill({ json: { project } }),
  );
  await page.route(
    `**/api/projects/${projectId}/research-round/${roundId}/approve`,
    async (route) => {
      const body = route.request().postDataJSON() as { responses: Record<string, unknown> };
      expect(Object.keys(body.responses)).toHaveLength(2);
      await route.fulfill({
        json: {
          latestRound: {
            ...waitingRound.latestRound,
            status: "approved",
            approvedRevisionId: "60000000-0000-4000-8000-000000000001",
          },
          project: { ...project, version: 3 },
        },
      });
    },
  );

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Runda specializată" })).toBeVisible();
  await expect(page.getByText("Validarea umană rămâne limita de control")).toBeVisible();
  await page
    .getByLabel("Răspuns sau explicație pentru: Cine vede rezultatele brute?")
    .fill("Doar operatorul până la publicare.");
  await page.getByLabel("Doar operator", { exact: true }).check();
  await page.getByRole("button", { name: "Aprobă și creează revizia" }).click();
  await expect(page.getByText("Runda este aprobată", { exact: false })).toBeVisible();
});

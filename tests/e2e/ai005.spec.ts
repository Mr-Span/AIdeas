import { expect, test } from "@playwright/test";

const projectId = "71000000-0000-4000-8000-000000000001";
const revisionId = "71000000-0000-4000-8000-000000000002";
const planId = "71000000-0000-4000-8000-000000000003";

const project = {
  id: projectId, displayName: "Pilot AI-005", lifecycleState: "active", version: 3,
  completedAt: null, purgeAfter: null, updatedAt: "2026-07-20T12:00:00.000Z",
  draft: { revisionId, idea: "Plan final verificabil", clarifications: {}, notes: "Sintetic", approvalRequired: false, submitted: true },
  plan: {
    verifiedSteps: 3, visibleSteps: 5, progressPercent: 60,
    steps: ["Idee și context", "Cercetare și validare", "Clarificări client–inginer", "Plan tehnic", "Implementare și verificare"].map((title, index) => ({
      id: `72000000-0000-4000-8000-00000000000${index}`, title, summary: title,
      status: index < 3 ? "verified" : "not_started", nextAction: null,
      updatedAt: "2026-07-20T12:00:00.000Z", verifiedAt: index < 3 ? "2026-07-20T12:00:00.000Z" : null,
    })),
  },
  collaboration: [],
};

const plan = {
  latestPlan: {
    id: planId, revisionId, status: "waiting_operator", digest: "a".repeat(64), baseCommit: "b".repeat(40), policyVersion: "aideas-policy-v1",
    plan: {
      title: "Arhitectura AIdeas", summary: "Verticală complet trasabilă.", benefits: ["Evidence real"], limitations: ["Un operator"], assumptions: [],
      requirements: [{ id: "REQ-CORE", title: "Core", statement: "Persistență", sourceRefs: ["revision"] }],
      acceptanceCriteria: [{ id: "AC-CORE", requirementIds: ["REQ-CORE"], statement: "Verificat", verification: "test" }],
      components: [
        { id: "CMP-CONTROL", name: "Control Service", responsibility: "Validează și persistă.", sourceOfTruth: "SQLite", interfaces: ["HTTP"], securityBoundary: "operator" },
        { id: "CMP-RUNNER", name: "Runner", responsibility: "Execută izolat.", sourceOfTruth: "worktree", interfaces: ["provider"], securityBoundary: "sandbox" },
      ],
      architectureEdges: [{ from: "CMP-CONTROL", to: "CMP-RUNNER", relationship: "dispatch packet" }],
      risks: [], blockers: [],
      tasks: [
        { id: "TASK-CONTROL", title: "Persistă planul", objective: "Salvează digestul.", ownerProfile: "backend", priority: "P1", requirementIds: ["REQ-CORE"], riskIds: [], acceptanceIds: ["AC-CORE"], componentIds: ["CMP-CONTROL"], dependsOn: [], fileScopes: ["src/server"], sharedOwnershipRationale: null, contextRefs: ["revision"], verificationCommands: ["test"], evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"], stopRules: ["stop stale"], effort: "1 zi" },
        { id: "TASK-RUNNER", title: "Execută izolat", objective: "Creează EvidenceBundle.", ownerProfile: "runtime", priority: "P1", requirementIds: ["REQ-CORE"], riskIds: [], acceptanceIds: ["AC-CORE"], componentIds: ["CMP-RUNNER"], dependsOn: ["TASK-CONTROL"], fileScopes: ["src/runner"], sharedOwnershipRationale: null, contextRefs: ["plan"], verificationCommands: ["test"], evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"], stopRules: ["stop failure"], effort: "2 zile" },
      ],
      clientSteps: [{ taskIds: ["TASK-CONTROL", "TASK-RUNNER"], title: "Implementare", summary: "Plan și runner" }],
    },
    validation: [], providerRunId: "planner-fixture", errorDetail: null, approvedAt: null,
    createdAt: "2026-07-20T12:00:00.000Z", updatedAt: "2026-07-20T12:00:00.000Z",
  },
};

test("renders the architecture map and approves the digest-bound plan", async ({ page }) => {
  await page.addInitScript((id) => window.localStorage.setItem("aideas.project-pointer.v1", id), projectId);
  await page.route("**/api/operator/session", (route) => route.fulfill({ json: { csrfToken: "synthetic-token" } }));
  await page.route(`**/api/projects/${projectId}/research`, (route) => route.fulfill({ json: { project, providerHealth: { provider: "codex", status: "ready", version: "fixture", authMode: "chatgpt", detail: "ready" }, activeRun: null, latestRun: null } }));
  await page.route(`**/api/projects/${projectId}/research-round`, (route) => route.fulfill({ json: { latestRound: { id: "73000000-0000-4000-8000-000000000001", revisionId, status: "approved", roles: [], proposals: [], cards: [], roleSummaries: {}, approvedRevisionId: revisionId, errorDetail: null, createdAt: project.updatedAt, updatedAt: project.updatedAt } } }));
  await page.route(`**/api/projects/${projectId}/implementation-plan`, (route) => route.fulfill({ json: plan }));
  await page.route(`**/api/projects/${projectId}/work-items`, (route) => route.fulfill({ json: { planId: null, planDigest: null, policyVersion: null, workItems: [] } }));
  await page.route(`**/api/projects/${projectId}`, (route) => route.fulfill({ json: { project } }));
  await page.route(`**/api/projects/${projectId}/implementation-plan/${planId}/approve`, (route) => route.fulfill({ json: { latestPlan: { ...plan.latestPlan, status: "approved", approvedAt: "2026-07-20T13:00:00.000Z" } } }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plan final și gate de execuție" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Hartă arhitecturală" })).toBeVisible();
  await expect(page.getByText("Control Service", { exact: true })).toBeVisible();
  await expect(page.getByText("DAG de implementare", { exact: false })).toBeVisible();
  await expect(page.getByText("Etapa 2")).toBeVisible();
  await page.getByRole("button", { name: "Aprobă planul final" }).click();
  await expect(page.getByText("Aprobat pentru task packets")).toBeVisible();
});

test("downloads a verified EvidenceBundle as Markdown and JSON", async ({ page }) => {
  const verifiedProject = {
    ...project,
    plan: {
      ...project.plan,
      verifiedSteps: 4,
      progressPercent: 80,
      steps: project.plan.steps.map((step, index) => ({
        ...step,
        status: index < 4 ? "verified" : "not_started",
        verifiedAt: index < 4 ? project.updatedAt : null,
      })),
    },
  };
  const workItemId = "71000000-0000-4000-8000-000000000004";
  const evidence = {
    id: "71000000-0000-4000-8000-000000000005",
    projectId,
    workItemId,
    revisionId,
    planId,
    planDigest: "a".repeat(64),
    policyVersion: "aideas-policy-v1",
    baseCommit: "b".repeat(40),
    currentBaseCommit: "b".repeat(40),
    diffDigest: "c".repeat(64),
    commitDigest: "d".repeat(40),
    secretScanPassed: true,
    checks: [{ kind: "test", status: "passed", receipt: "68 tests passed" }],
    createdAt: project.updatedAt,
  };

  await page.addInitScript((id) => window.localStorage.setItem("aideas.project-pointer.v1", id), projectId);
  await page.route("**/api/operator/session", (route) => route.fulfill({ json: { csrfToken: "synthetic-token" } }));
  await page.route(`**/api/projects/${projectId}/research`, (route) => route.fulfill({ json: { project: verifiedProject, providerHealth: { provider: "codex", status: "ready", version: "fixture", authMode: "chatgpt", detail: "ready" }, activeRun: null, latestRun: null } }));
  await page.route(`**/api/projects/${projectId}/research-round`, (route) => route.fulfill({ json: { latestRound: { id: "73000000-0000-4000-8000-000000000001", revisionId, status: "approved", roles: [], proposals: [], cards: [], roleSummaries: {}, approvedRevisionId: revisionId, errorDetail: null, createdAt: project.updatedAt, updatedAt: project.updatedAt } } }));
  await page.route(`**/api/projects/${projectId}/implementation-plan`, (route) => route.fulfill({ json: { latestPlan: { ...plan.latestPlan, status: "approved", approvedAt: project.updatedAt } } }));
  await page.route(`**/api/projects/${projectId}/work-items`, (route) => route.fulfill({ json: {
    planId, planDigest: "a".repeat(64), policyVersion: "aideas-policy-v1",
    workItems: [{
      id: workItemId, canonicalKey: "TASK-EXPORT", title: "Exportă EvidenceBundle", status: "verified",
      packet: { ...plan.latestPlan.plan.tasks[0], id: "TASK-EXPORT", title: "Exportă EvidenceBundle", objective: "Descarcă dovada sigură." },
      dependencies: [], latestAttempt: null, evidence,
    }],
  } }));
  await page.route(`**/api/projects/${projectId}/work-items/${workItemId}/integrate`, (route) => route.fulfill({ json: { integration: null } }));
  await page.route(`**/api/projects/${projectId}/work-items/${workItemId}/evidence?format=*`, async (route) => {
    const format = new URL(route.request().url()).searchParams.get("format");
    const markdown = "# EvidenceBundle · TASK-EXPORT\n\nSafe export\n";
    const json = JSON.stringify({ schemaVersion: "aideas-evidence-export-v1", task: { canonicalKey: "TASK-EXPORT" } });
    await route.fulfill({
      status: 200,
      headers: {
        "content-type": format === "markdown" ? "text/markdown; charset=utf-8" : "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="aideas-task-export-evidence.${format === "markdown" ? "md" : "json"}"`,
      },
      body: format === "markdown" ? markdown : json,
    });
  });
  await page.route(`**/api/projects/${projectId}`, (route) => route.fulfill({ json: { project: verifiedProject } }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Exportă EvidenceBundle" })).toBeVisible();
  const exportActions = page.getByLabel("Export EvidenceBundle pentru TASK-EXPORT");

  const markdownDownloadPromise = page.waitForEvent("download");
  await exportActions.getByRole("button", { name: "Markdown" }).click();
  const markdownDownload = await markdownDownloadPromise;
  expect(markdownDownload.suggestedFilename()).toBe("aideas-task-export-evidence.md");

  const jsonDownloadPromise = page.waitForEvent("download");
  await exportActions.getByRole("button", { name: "JSON" }).click();
  const jsonDownload = await jsonDownloadPromise;
  expect(jsonDownload.suggestedFilename()).toBe("aideas-task-export-evidence.json");
});

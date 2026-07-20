import { describe, expect, it } from "vitest";

import type { ImplementationPlan } from "../../src/server/planning/contracts";
import { hasPlanErrors, validateImplementationPlan } from "../../src/server/planning/validate-plan";

function validPlan(): ImplementationPlan {
  return {
    title: "AIdeas execution plan",
    summary: "Plan sintetic complet trasabil.",
    benefits: ["Reduce pierderea de context."],
    limitations: ["Un singur operator."],
    assumptions: ["Repo Git local disponibil."],
    requirements: [{ id: "REQ-CORE", title: "Kernel", statement: "Starea este durabilă.", sourceRefs: ["revision:synthetic"] }],
    acceptanceCriteria: [{ id: "AC-DURABLE", requirementIds: ["REQ-CORE"], statement: "Restartul păstrează starea.", verification: "Test integration restart." }],
    components: [
      { id: "CMP-CONTROL", name: "Control", responsibility: "Validează comenzi.", sourceOfTruth: "SQLite", interfaces: ["HTTP"], securityBoundary: "Operator-only" },
      { id: "CMP-RUNNER", name: "Runner", responsibility: "Execută izolat.", sourceOfTruth: "Worktree", interfaces: ["ExecutionProvider"], securityBoundary: "Sandbox" },
    ],
    architectureEdges: [{ from: "CMP-CONTROL", to: "CMP-RUNNER", relationship: "dispatch bounded packet" }],
    risks: [{ id: "RISK-STALE", title: "Stale base", impact: "high", mitigation: "Compară base commit." }],
    blockers: [],
    tasks: [
      {
        id: "TASK-KERNEL", title: "Add durable kernel", objective: "Persistă work item.", ownerProfile: "backend", priority: "P1",
        requirementIds: ["REQ-CORE"], riskIds: ["RISK-STALE"], acceptanceIds: ["AC-DURABLE"], componentIds: ["CMP-CONTROL"],
        dependsOn: [], fileScopes: ["src/server/kernel"], sharedOwnershipRationale: null, contextRefs: ["revision:synthetic"],
        verificationCommands: ["test"], evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"],
        stopRules: ["Oprește dacă base commit s-a schimbat."], effort: "1-2 zile",
      },
      {
        id: "TASK-RUNNER", title: "Add runner", objective: "Execută taskul izolat.", ownerProfile: "runtime", priority: "P1",
        requirementIds: ["REQ-CORE"], riskIds: ["RISK-STALE"], acceptanceIds: ["AC-DURABLE"], componentIds: ["CMP-RUNNER"],
        dependsOn: ["TASK-KERNEL"], fileScopes: ["src/server/runner"], sharedOwnershipRationale: null, contextRefs: ["revision:synthetic"],
        verificationCommands: ["test", "security"], evidenceRequired: ["diff", "checks", "independent_review", "secret_scan"],
        stopRules: ["Oprește la test eșuat."], effort: "2-3 zile",
      },
    ],
    clientSteps: [{ taskIds: ["TASK-KERNEL", "TASK-RUNNER"], title: "Implementare sigură", summary: "Kernel și runner." }],
  };
}

describe("AI005 deterministic plan validator", () => {
  it("accepts a traced acyclic plan", () => {
    const issues = validateImplementationPlan(validPlan());
    expect(hasPlanErrors(issues)).toBe(false);
  });

  it("rejects cycles, unresolved references, and unexplained ownership overlap", () => {
    const plan = validPlan();
    plan.tasks[0].dependsOn = ["TASK-RUNNER"];
    plan.tasks[1].fileScopes = ["src/server"];
    plan.tasks[1].componentIds = ["CMP-MISSING"];
    const issues = validateImplementationPlan(plan);
    expect(issues.map((entry) => entry.code)).toEqual(expect.arrayContaining([
      "dependency_cycle",
      "missing_component",
      "ownership_overlap",
    ]));
    expect(hasPlanErrors(issues)).toBe(true);
  });
});

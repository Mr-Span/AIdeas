import { randomUUID } from "node:crypto";

import { describe, expect, it } from "vitest";

import { POLICY_VERSION, type EvidenceBundle } from "../../src/server/policy/contracts";
import { actionDigest, evaluateAction } from "../../src/server/policy/evidence-policy";

function evidence(overrides: Partial<EvidenceBundle> = {}): EvidenceBundle {
  return {
    id: randomUUID(), projectId: randomUUID(), workItemId: randomUUID(), revisionId: randomUUID(), planId: randomUUID(),
    planDigest: "a".repeat(64), policyVersion: POLICY_VERSION,
    baseCommit: "b".repeat(40), currentBaseCommit: "b".repeat(40), diffDigest: "c".repeat(64), commitDigest: "d".repeat(40),
    secretScanPassed: true,
    checks: [
      { kind: "test", status: "passed", receipt: "vitest green" },
      { kind: "independent_review", status: "passed", receipt: "reviewer approved" },
    ],
    createdAt: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

describe("AI005 evidence policy", () => {
  it("allows autonomous Git with green evidence when the toggle is off", () => {
    expect(evaluateAction({ actionKind: "merge", target: "main", planApproved: true, humanApprovalForGit: false, evidence: evidence() }))
      .toMatchObject({ allowed: true, requiresApproval: false, reasons: [] });
  });

  it("blocks stale evidence and failed secret scans", () => {
    const decision = evaluateAction({
      actionKind: "push", target: "origin/task", planApproved: true, humanApprovalForGit: false,
      evidence: evidence({ currentBaseCommit: "e".repeat(40), secretScanPassed: false }),
    });
    expect(decision.allowed).toBe(false);
    expect(decision.reasons.join(" ")).toContain("stale");
    expect(decision.reasons.join(" ")).toContain("secrete");
  });

  it("always requires digest-bound approval for deploy", () => {
    const bundle = evidence();
    const target = "production";
    const digest = actionDigest({ actionKind: "deploy", target, planDigest: bundle.planDigest, commitDigest: bundle.commitDigest });
    expect(evaluateAction({ actionKind: "deploy", target, planApproved: true, humanApprovalForGit: false, evidence: bundle }).allowed).toBe(false);
    expect(evaluateAction({
      actionKind: "deploy", target, planApproved: true, humanApprovalForGit: false, evidence: bundle,
      approval: { actionKind: "deploy", actionDigest: digest, policyVersion: POLICY_VERSION, approvedAt: "2026-07-20T12:01:00.000Z" },
    })).toMatchObject({ allowed: true, requiresApproval: true });
  });
});

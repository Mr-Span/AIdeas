import { createHash } from "node:crypto";

import {
  POLICY_VERSION,
  evidenceBundleSchema,
  type ActionApproval,
  type ActionKind,
  type EvidenceBundle,
  type PolicyDecision,
} from "./contracts";

const ALWAYS_GATED = new Set<ActionKind>(["payment", "publication", "deploy"]);
const GIT_ACTIONS = new Set<ActionKind>(["commit", "push", "pull_request", "merge"]);

export function actionDigest(input: {
  actionKind: ActionKind;
  target: string;
  planDigest: string;
  commitDigest?: string | null;
}) {
  return createHash("sha256")
    .update(JSON.stringify({ ...input, policyVersion: POLICY_VERSION }), "utf8")
    .digest("hex");
}

export function evaluateAction(input: {
  actionKind: ActionKind;
  target: string;
  planApproved: boolean;
  humanApprovalForGit: boolean;
  evidence?: EvidenceBundle | null;
  approval?: ActionApproval | null;
}): PolicyDecision {
  const reasons: string[] = [];
  const requiresApproval =
    ALWAYS_GATED.has(input.actionKind) ||
    (GIT_ACTIONS.has(input.actionKind) && input.humanApprovalForGit);

  if (!input.planApproved) reasons.push("Planul final nu este aprobat.");
  if (!input.evidence) {
    reasons.push("EvidenceBundle lipsește.");
  } else {
    const evidence = evidenceBundleSchema.parse(input.evidence);
    if (evidence.baseCommit !== evidence.currentBaseCommit) {
      reasons.push("Baza Git s-a schimbat; evidence este stale.");
    }
    if (!evidence.secretScanPassed) reasons.push("Scanarea de secrete nu a trecut.");
    if (evidence.checks.some((check) => check.status !== "passed")) {
      reasons.push("Cel puțin o verificare obligatorie a eșuat.");
    }
    const kinds = new Set(evidence.checks.map((check) => check.kind));
    for (const required of ["test", "independent_review"] as const) {
      if (!kinds.has(required)) reasons.push(`Verificarea ${required} lipsește.`);
    }
  }

  if (requiresApproval) {
    const digest = actionDigest({
      actionKind: input.actionKind,
      target: input.target,
      planDigest: input.evidence?.planDigest ?? "missing",
      commitDigest: input.evidence?.commitDigest,
    });
    if (
      !input.approval ||
      input.approval.actionKind !== input.actionKind ||
      input.approval.actionDigest !== digest ||
      input.approval.policyVersion !== POLICY_VERSION
    ) {
      reasons.push("Aprobarea explicită lipsește sau nu corespunde acțiunii curente.");
    }
  }

  return {
    allowed: reasons.length === 0,
    requiresApproval,
    reasons,
    policyVersion: POLICY_VERSION,
  };
}

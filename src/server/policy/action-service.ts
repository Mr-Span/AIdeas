import { randomUUID } from "node:crypto";

import { DomainError } from "@/server/domain/errors";
import type { ControlStore } from "@/server/storage/control-store";

import { actionKindSchema, POLICY_VERSION, evidenceBundleSchema, type ActionApproval, type ActionKind } from "./contracts";
import { actionDigest, evaluateAction } from "./evidence-policy";

type Row = Record<string, unknown>;
function text(row: Row, key: string) { return String(row[key]); }

export class ActionPolicyService {
  constructor(
    private readonly store: ControlStore,
    private readonly clock: () => Date = () => new Date(),
    private readonly idFactory: () => string = randomUUID,
  ) {}

  evaluate(input: { projectId: string; workItemId: string; actionKind: ActionKind; target: string }) {
    const context = this.context(input);
    const digest = actionDigest({
      actionKind: input.actionKind,
      target: input.target,
      planDigest: context.evidence.planDigest,
      commitDigest: context.evidence.commitDigest,
    });
    const approvalRow = this.store.database.prepare(
      `SELECT action_kind, action_digest, policy_version, approved_at
       FROM action_approvals WHERE project_id = ? AND action_kind = ? AND action_digest = ? AND policy_version = ?`,
    ).get(input.projectId, input.actionKind, digest, POLICY_VERSION) as Row | undefined;
    const approval: ActionApproval | null = approvalRow ? {
      actionKind: actionKindSchema.parse(text(approvalRow, "action_kind")),
      actionDigest: text(approvalRow, "action_digest"),
      policyVersion: POLICY_VERSION,
      approvedAt: text(approvalRow, "approved_at"),
    } : null;
    return {
      actionDigest: digest,
      ...evaluateAction({
        actionKind: input.actionKind,
        target: input.target,
        planApproved: true,
        humanApprovalForGit: context.humanApprovalForGit,
        evidence: context.evidence,
        approval,
      }),
      approvedAt: approval?.approvedAt ?? null,
      riskOverride: context.riskOverride,
    };
  }

  approve(input: { projectId: string; workItemId: string; actionKind: ActionKind; target: string }) {
    const context = this.context(input);
    const digest = actionDigest({
      actionKind: input.actionKind,
      target: input.target,
      planDigest: context.evidence.planDigest,
      commitDigest: context.evidence.commitDigest,
    });
    const now = this.clock().toISOString();
    const prospective: ActionApproval = { actionKind: input.actionKind, actionDigest: digest, policyVersion: POLICY_VERSION, approvedAt: now };
    const decision = evaluateAction({
      actionKind: input.actionKind,
      target: input.target,
      planApproved: true,
      humanApprovalForGit: context.humanApprovalForGit,
      evidence: context.evidence,
      approval: prospective,
    });
    if (!decision.allowed) {
      throw new DomainError("VALIDATION_ERROR", `Acțiunea nu poate fi aprobată: ${decision.reasons.join(" ")}`, 409);
    }
    this.store.transaction(() => {
      this.store.database.prepare(
        `INSERT OR IGNORE INTO action_approvals(
           id, project_id, action_kind, action_digest, policy_version, target, actor_kind, approved_at
         ) VALUES (?, ?, ?, ?, ?, ?, 'operator', ?)`,
      ).run(this.idFactory(), input.projectId, input.actionKind, digest, POLICY_VERSION, input.target, now);
      this.store.database.prepare(
        `INSERT INTO audit_events(id, project_id, actor_kind, event_kind, subject_id, payload_json, created_at)
         VALUES (?, ?, 'operator', 'action_approved', ?, ?, ?)`,
      ).run(this.idFactory(), input.projectId, input.workItemId, JSON.stringify({ actionKind: input.actionKind, actionDigest: digest, policyVersion: POLICY_VERSION, target: input.target }), now);
    });
    return this.evaluate(input);
  }

  private context(input: { projectId: string; workItemId: string }) {
    const row = this.store.database.prepare(
      `SELECT e.bundle_json, r.payload_json, p.plan_json, w.packet_json
       FROM work_items w
       JOIN implementation_plans p ON p.id = w.plan_id AND p.status = 'approved'
       JOIN project_revisions r ON r.id = p.revision_id
       JOIN evidence_bundles e ON e.work_item_id = w.id
       WHERE w.id = ? AND w.project_id = ? AND w.status IN ('verified', 'integrated')
       ORDER BY e.created_at DESC LIMIT 1`,
    ).get(input.workItemId, input.projectId) as Row | undefined;
    if (!row) throw new DomainError("VALIDATION_ERROR", "Taskul nu are EvidenceBundle verificat.", 409);
    const payload = JSON.parse(text(row, "payload_json")) as { approvalRequired?: boolean };
    const plan = JSON.parse(text(row, "plan_json")) as {
      risks?: Array<{ id: string; impact: string }>;
    };
    const task = JSON.parse(text(row, "packet_json")) as {
      priority?: string;
      riskIds?: string[];
    };
    const criticalRiskIds = new Set(
      (plan.risks ?? [])
        .filter((risk) => risk.impact === "critical")
        .map((risk) => risk.id),
    );
    const riskOverride =
      task.priority === "P0" ||
      (task.riskIds ?? []).some((riskId) => criticalRiskIds.has(riskId));
    return {
      evidence: evidenceBundleSchema.parse(JSON.parse(text(row, "bundle_json"))),
      humanApprovalForGit: payload.approvalRequired === true || riskOverride,
      riskOverride,
    };
  }
}

import { randomUUID } from "node:crypto";

import { DomainError } from "@/server/domain/errors";
import { ActionPolicyService } from "@/server/policy/action-service";
import type { ActionKind } from "@/server/policy/contracts";
import type { ControlStore } from "@/server/storage/control-store";

import type { GitHubAdapter } from "./github-adapter";

type Row = Record<string, unknown>;
function text(row: Row, key: string) { return String(row[key]); }
function nullableText(row: Row, key: string) { return row[key] == null ? null : String(row[key]); }

export type IntegrationStateDto = {
  id: string;
  workItemId: string;
  status: "running" | "waiting_approval" | "integrated" | "failed";
  branchName: string;
  pullRequestUrl: string | null;
  mergeCommit: string | null;
  pendingActionKind: string | null;
  pendingActionTarget: string | null;
  errorDetail: string | null;
  updatedAt: string;
};

export class IntegrationService {
  private readonly active = new Map<string, Promise<void>>();
  private reconciled = false;

  constructor(
    private readonly store: ControlStore,
    private readonly policy: ActionPolicyService,
    private readonly github: GitHubAdapter,
    private readonly clock: () => Date = () => new Date(),
    private readonly idFactory: () => string = randomUUID,
  ) {}

  private now() { return this.clock().toISOString(); }

  private reconcile() {
    if (this.reconciled) return;
    const now = this.now();
    this.store.database.prepare("UPDATE integration_runs SET status = 'failed', error_detail = 'Integrarea a fost întreruptă; readback-ul va fi reluat explicit.', updated_at = ? WHERE status = 'running'").run(now);
    this.reconciled = true;
  }

  getState(projectId: string, workItemId: string): IntegrationStateDto | null {
    this.reconcile();
    const row = this.store.database.prepare("SELECT * FROM integration_runs WHERE project_id = ? AND work_item_id = ? ORDER BY updated_at DESC LIMIT 1").get(projectId, workItemId) as Row | undefined;
    return row ? this.toDto(row) : null;
  }

  async start(input: { projectId: string; workItemId: string }) {
    this.reconcile();
    const context = this.store.database.prepare(
      `SELECT w.canonical_key, w.title, w.packet_json, w.status, e.id AS evidence_id, e.commit_digest
       FROM work_items w JOIN evidence_bundles e ON e.work_item_id = w.id
       WHERE w.id = ? AND w.project_id = ? AND w.status IN ('verified', 'integrated')
       ORDER BY e.created_at DESC LIMIT 1`,
    ).get(input.workItemId, input.projectId) as Row | undefined;
    if (!context || !nullableText(context, "commit_digest")) throw new DomainError("VALIDATION_ERROR", "Taskul nu are commit verificat.", 409);
    await this.github.preflight();
    const repository = await this.github.repositoryInfo();
    const branchName = `aideas/${text(context, "canonical_key").toLowerCase()}`;
    const existing = this.store.database.prepare("SELECT * FROM integration_runs WHERE project_id = ? AND work_item_id = ? AND status IN ('running', 'waiting_approval', 'failed') ORDER BY updated_at DESC LIMIT 1").get(input.projectId, input.workItemId) as Row | undefined;
    const runId = existing ? text(existing, "id") : this.idFactory();
    const now = this.now();
    if (existing) {
      this.store.database.prepare("UPDATE integration_runs SET status = 'running', repository_name = ?, base_branch = ?, pending_action_kind = NULL, pending_action_target = NULL, error_detail = NULL, updated_at = ? WHERE id = ?")
        .run(repository.nameWithOwner, repository.defaultBranch, now, runId);
    } else {
      this.store.database.prepare(
        `INSERT INTO integration_runs(id, project_id, work_item_id, evidence_id, status, branch_name, repository_name, base_branch, created_at, updated_at)
         VALUES (?, ?, ?, ?, 'running', ?, ?, ?, ?, ?)`,
      ).run(runId, input.projectId, input.workItemId, text(context, "evidence_id"), branchName, repository.nameWithOwner, repository.defaultBranch, now, now);
    }
    const promise = this.consume({ ...input, runId, context, branchName, repository });
    this.active.set(runId, promise);
    void promise.finally(() => this.active.delete(runId));
    return this.getState(input.projectId, input.workItemId);
  }

  async waitForRun(runId: string) { await this.active.get(runId); }

  private async consume(input: { projectId: string; workItemId: string; runId: string; context: Row; branchName: string; repository: { nameWithOwner: string; defaultBranch: string } }) {
    try {
      const commit = text(input.context, "commit_digest");
      const pushTarget = `origin/${input.branchName}`;
      if (!this.allowedOrPause(input, "push", pushTarget)) return;
      await this.github.push(input.branchName, commit);

      const prTarget = `${input.repository.nameWithOwner}:${input.repository.defaultBranch}<-${input.branchName}`;
      if (!this.allowedOrPause(input, "pull_request", prTarget)) return;
      const pr = await this.github.ensurePullRequest({
        branch: input.branchName, base: input.repository.defaultBranch,
        title: text(input.context, "title"),
        body: `AIdeas verified task ${text(input.context, "canonical_key")}\n\nEvidence commit: ${commit}`,
      });
      this.store.database.prepare("UPDATE integration_runs SET pull_request_url = ?, updated_at = ? WHERE id = ?").run(pr.url, this.now(), input.runId);
      if (pr.state === "MERGED" && pr.mergeCommit) {
        this.complete(input, pr.mergeCommit);
        return;
      }
      if (!this.allowedOrPause(input, "merge", pr.url)) return;
      const merged = await this.github.mergePullRequest(pr.url);
      this.complete(input, merged.mergeCommit!);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "Integrarea Git a eșuat.";
      this.store.database.prepare("UPDATE integration_runs SET status = 'failed', error_detail = ?, updated_at = ? WHERE id = ?").run(detail, this.now(), input.runId);
    }
  }

  private allowedOrPause(input: { projectId: string; workItemId: string; runId: string }, actionKind: ActionKind, target: string) {
    const decision = this.policy.evaluate({ projectId: input.projectId, workItemId: input.workItemId, actionKind, target });
    if (decision.allowed) return true;
    if (decision.requiresApproval && decision.reasons.every((reason) => reason.includes("Aprobarea explicită"))) {
      this.store.database.prepare("UPDATE integration_runs SET status = 'waiting_approval', pending_action_kind = ?, pending_action_target = ?, error_detail = NULL, updated_at = ? WHERE id = ?")
        .run(actionKind, target, this.now(), input.runId);
      return false;
    }
    throw new DomainError("VALIDATION_ERROR", decision.reasons.join(" "), 409);
  }

  private complete(input: { projectId: string; workItemId: string; runId: string }, mergeCommit: string) {
    const now = this.now();
    this.store.transaction(() => {
      this.store.database.prepare("UPDATE integration_runs SET status = 'integrated', merge_commit = ?, pending_action_kind = NULL, pending_action_target = NULL, completed_at = ?, updated_at = ? WHERE id = ?")
        .run(mergeCommit, now, now, input.runId);
      this.store.database.prepare("UPDATE work_items SET status = 'integrated', updated_at = ? WHERE id = ?").run(now, input.workItemId);
      const remaining = this.store.database.prepare("SELECT 1 FROM work_items WHERE project_id = ? AND status <> 'integrated' LIMIT 1").get(input.projectId);
      if (!remaining) {
        this.store.database.prepare("UPDATE plan_steps SET status = 'verified', evidence_ref = ?, verified_at = ?, next_action = NULL, updated_at = ? WHERE project_id = ? AND position = 4")
          .run(`merge:${mergeCommit}`, now, now, input.projectId);
      }
    });
  }

  private toDto(row: Row): IntegrationStateDto {
    return {
      id: text(row, "id"), workItemId: text(row, "work_item_id"), status: text(row, "status") as IntegrationStateDto["status"],
      branchName: text(row, "branch_name"), pullRequestUrl: nullableText(row, "pull_request_url"), mergeCommit: nullableText(row, "merge_commit"),
      pendingActionKind: nullableText(row, "pending_action_kind"), pendingActionTarget: nullableText(row, "pending_action_target"),
      errorDetail: nullableText(row, "error_detail"), updatedAt: text(row, "updated_at"),
    };
  }
}

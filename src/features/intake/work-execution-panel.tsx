"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, Download, GitCommit, LoaderCircle, LockKeyhole } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ClientProjectDto } from "@/server/domain/contracts";
import type { WorkControlStateDto } from "@/server/work/contracts";
import type { IntegrationStateDto } from "@/server/integration/integration-service";

import { approveWorkItemAction, downloadEvidenceBundle, executeWorkItem, integrateWorkItem, loadIntegration, loadProject, loadWorkItems } from "./project-api";

function localKey(workItemId: string, fingerprint: string) {
  const storageKey = `aideas.pending.execute.${workItemId}.v1`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { fingerprint: string; key: string };
      if (parsed.fingerprint === fingerprint) return parsed.key;
    } catch { window.localStorage.removeItem(storageKey); }
  }
  const key = `execute:${window.crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
  return key;
}

type Props = { project: ClientProjectDto; onProjectChange: (project: ClientProjectDto) => void };

export function WorkExecutionPanel({ project, onProjectChange }: Props) {
  const [state, setState] = useState<WorkControlStateDto>({ planId: null, planDigest: null, policyVersion: null, workItems: [] });
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<string | null>(null);
  const [integrations, setIntegrations] = useState<Record<string, IntegrationStateDto | null>>({});
  const active = useMemo(() => state.workItems.some((item) => ["running", "verifying"].includes(item.status)), [state.workItems]);

  useEffect(() => {
    let cancelled = false;
    void loadWorkItems(project.id).then((next) => { if (!cancelled) setState(next); }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [project.id, project.plan.verifiedSteps]);

  useEffect(() => {
    const verified = state.workItems.filter((item) => ["verified", "integrated"].includes(item.status));
    if (!verified.length) return;
    let cancelled = false;
    void Promise.all(verified.map(async (item) => [item.id, (await loadIntegration(project.id, item.id)).integration] as const))
      .then((entries) => { if (!cancelled) setIntegrations(Object.fromEntries(entries)); })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [project.id, state.workItems]);

  useEffect(() => {
    const runningIds = Object.entries(integrations)
      .filter(([, integration]) => integration?.status === "running")
      .map(([workItemId]) => workItemId);
    if (!runningIds.length) return;
    const timer = window.setInterval(() => {
      void Promise.all(
        runningIds.map(async (workItemId) => [
          workItemId,
          (await loadIntegration(project.id, workItemId)).integration,
        ] as const),
      ).then(async (entries) => {
        setIntegrations((current) => ({ ...current, ...Object.fromEntries(entries) }));
        if (entries.some(([, integration]) => integration?.status !== "running")) {
          setState(await loadWorkItems(project.id));
          setBusyId(null);
          onProjectChange((await loadProject(project.id)).project);
        }
      }).catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [integrations, onProjectChange, project.id]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => {
      void loadWorkItems(project.id).then(async (next) => {
        setState(next);
        if (!next.workItems.some((item) => ["running", "verifying"].includes(item.status))) {
          setBusyId(null);
          onProjectChange((await loadProject(project.id)).project);
        }
      }).catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [active, onProjectChange, project.id]);

  async function handleExecute(workItemId: string, updatedAt: string) {
    setBusyId(workItemId);
    setError("");
    try {
      setState(await executeWorkItem({
        projectId: project.id, workItemId,
        idempotencyKey: localKey(workItemId, `${state.planDigest}:${updatedAt}`),
      }));
    } catch (caught) {
      setBusyId(null);
      setError(caught instanceof Error ? caught.message : "Taskul nu a putut porni.");
    }
  }

  async function handleIntegrate(workItemId: string) {
    setBusyId(workItemId);
    setError("");
    try {
      const result = await integrateWorkItem(project.id, workItemId);
      setIntegrations((current) => ({ ...current, [workItemId]: result.integration }));
      window.setTimeout(() => {
        void Promise.all([loadIntegration(project.id, workItemId), loadWorkItems(project.id)]).then(([integration, work]) => {
          setIntegrations((current) => ({ ...current, [workItemId]: integration.integration }));
          setState(work);
          setBusyId(null);
        });
      }, 2_000);
    } catch (caught) {
      setBusyId(null);
      setError(caught instanceof Error ? caught.message : "Integrarea Git nu a putut porni.");
    }
  }

  async function handleApproveAndContinue(workItemId: string, integration: IntegrationStateDto) {
    if (!integration.pendingActionKind || !integration.pendingActionTarget) return;
    setBusyId(workItemId);
    setError("");
    try {
      await approveWorkItemAction({
        projectId: project.id, workItemId,
        actionKind: integration.pendingActionKind,
        target: integration.pendingActionTarget,
      });
      const result = await integrateWorkItem(project.id, workItemId);
      setIntegrations((current) => ({ ...current, [workItemId]: result.integration }));
      setBusyId(null);
    } catch (caught) {
      setBusyId(null);
      setError(caught instanceof Error ? caught.message : "Aprobarea acțiunii nu a putut fi salvată.");
    }
  }

  async function handleEvidenceExport(workItemId: string, format: "json" | "markdown") {
    const exportKey = `${workItemId}:${format}`;
    setExporting(exportKey);
    setError("");
    try {
      const artifact = await downloadEvidenceBundle(project.id, workItemId, format);
      const url = window.URL.createObjectURL(artifact.blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = artifact.filename;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "EvidenceBundle nu a putut fi exportat.");
    } finally {
      setExporting(null);
    }
  }

  if (!state.planId) return null;
  return (
    <section className="work-execution" aria-labelledby="work-execution-title">
      <div className="work-execution-heading">
        <div><span className="eyebrow">AI‑005 · execution</span><h2 id="work-execution-title">Task packets și evidence</h2><p>Fiecare task rulează într-un worktree izolat și primește commit numai după verificare independentă.</p></div>
        <div className="policy-chip"><LockKeyhole aria-hidden="true" size={15}/>{state.policyVersion}</div>
      </div>
      <div className="work-item-list">
        {state.workItems.map((item) => (
          <article className="work-item" data-status={item.status} key={item.id}>
            <div className="work-item-title">
              {item.status === "verified" || item.status === "integrated" ? <CheckCircle2 aria-hidden="true"/> : item.status === "running" || item.status === "verifying" ? <LoaderCircle className="spin" aria-hidden="true"/> : item.status === "blocked" || item.status === "failed" ? <CircleAlert aria-hidden="true"/> : <GitCommit aria-hidden="true"/>}
              <div><small>{item.canonicalKey} · {item.packet.priority}</small><h3>{item.title}</h3></div>
              <span>{item.status}</span>
            </div>
            <p>{item.packet.objective}</p>
            {item.dependencies.length ? <small>Depinde de: {item.dependencies.map((dependency) => `${dependency.canonicalKey} (${dependency.status})`).join(", ")}</small> : <small>Fără dependențe; poate porni primul.</small>}
            {item.latestAttempt?.errorDetail ? <div className="work-error">{item.latestAttempt.errorDetail}</div> : null}
            {item.evidence ? (
              <div className="evidence-block">
                <details className="evidence-receipt"><summary>EvidenceBundle · {item.evidence.commitDigest?.slice(0, 8)}</summary><ul>{item.evidence.checks.map((check, index) => <li key={`${check.kind}-${index}`}><span>{check.kind}</span><strong>{check.status}</strong></li>)}</ul><code>{item.evidence.diffDigest}</code></details>
                <div className="evidence-export-actions" aria-label={`Export EvidenceBundle pentru ${item.canonicalKey}`}>
                  <Button disabled={Boolean(exporting)} size="sm" variant="outline" onClick={() => handleEvidenceExport(item.id, "markdown")}>
                    <Download aria-hidden="true" />{exporting === `${item.id}:markdown` ? "Se exportă..." : "Markdown"}
                  </Button>
                  <Button disabled={Boolean(exporting)} size="sm" variant="outline" onClick={() => handleEvidenceExport(item.id, "json")}>
                    <Download aria-hidden="true" />{exporting === `${item.id}:json` ? "Se exportă..." : "JSON"}
                  </Button>
                </div>
              </div>
            ) : null}
            {integrations[item.id] ? (
              <div className="integration-receipt" data-status={integrations[item.id]?.status}>
                <strong>Git: {integrations[item.id]?.status}</strong>
                {integrations[item.id]?.pullRequestUrl ? <a href={integrations[item.id]!.pullRequestUrl!} target="_blank" rel="noreferrer">Deschide PR</a> : null}
                {integrations[item.id]?.pendingActionKind ? <small>Așteaptă aprobarea: {integrations[item.id]?.pendingActionKind} → {integrations[item.id]?.pendingActionTarget}</small> : null}
                {integrations[item.id]?.errorDetail ? <small>{integrations[item.id]?.errorDetail}</small> : null}
              </div>
            ) : null}
            {integrations[item.id]?.status === "waiting_approval" ? (
              <Button disabled={Boolean(busyId)} size="sm" onClick={() => handleApproveAndContinue(item.id, integrations[item.id]!)}>
                {busyId === item.id ? "Se aprobă..." : `Aprobă ${integrations[item.id]?.pendingActionKind}`}
              </Button>
            ) : null}
            {["ready", "failed"].includes(item.status) ? (
              <Button disabled={Boolean(busyId) || active} size="sm" onClick={() => handleExecute(item.id, item.latestAttempt?.updatedAt ?? "first")}>
                {busyId === item.id ? "Se pornește..." : item.status === "failed" ? "Reîncearcă taskul" : "Execută taskul"}
              </Button>
            ) : null}
            {item.status === "verified" && !["running", "waiting_approval"].includes(integrations[item.id]?.status ?? "") ? (
              <Button disabled={Boolean(busyId) || active} size="sm" variant="outline" onClick={() => handleIntegrate(item.id)}>
                {busyId === item.id ? "Se integrează..." : integrations[item.id]?.status === "waiting_approval" ? "Continuă după aprobare" : "Push · PR · merge"}
              </Button>
            ) : null}
          </article>
        ))}
      </div>
      {error ? <div className="operation-error" role="alert">{error}</div> : null}
    </section>
  );
}

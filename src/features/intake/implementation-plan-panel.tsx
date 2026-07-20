"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, CircleAlert, GitBranch, LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { ClientProjectDto } from "@/server/domain/contracts";
import type { ImplementationPlanStateDto } from "@/server/planning/contracts";

import {
  approveImplementationPlan,
  loadImplementationPlan,
  loadProject,
  loadResearchRoundState,
  startImplementationPlan,
} from "./project-api";

function localKey(command: string, fingerprint: string) {
  const storageKey = `aideas.pending.${command}.v1`;
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    try {
      const parsed = JSON.parse(existing) as { fingerprint: string; key: string };
      if (parsed.fingerprint === fingerprint) return parsed.key;
    } catch {
      window.localStorage.removeItem(storageKey);
    }
  }
  const key = `${command}:${window.crypto.randomUUID()}`;
  window.localStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }));
  return key;
}

type Props = {
  project: ClientProjectDto;
  onProjectChange: (project: ClientProjectDto) => void;
};

export function ImplementationPlanPanel({ project, onProjectChange }: Props) {
  const [state, setState] = useState<ImplementationPlanStateDto>({ latestPlan: null });
  const [eligible, setEligible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const current = state.latestPlan;

  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      loadImplementationPlan(project.id),
      loadResearchRoundState(project.id),
    ]).then(([planState, researchState]) => {
      if (cancelled) return;
      setState(planState);
      setEligible(
        researchState.latestRound?.status === "approved" &&
          researchState.latestRound.approvedRevisionId === project.draft.revisionId,
      );
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [project.id, project.draft.revisionId]);

  useEffect(() => {
    if (current?.status !== "generating") return;
    const timer = window.setInterval(() => {
      void loadImplementationPlan(project.id).then(async (next) => {
        setState(next);
        if (next.latestPlan?.status !== "generating") {
          onProjectChange((await loadProject(project.id)).project);
        }
      }).catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [current?.status, onProjectChange, project.id]);

  const taskLayers = useMemo(() => {
    const tasks = current?.plan?.tasks ?? [];
    const remaining = new Map(tasks.map((task) => [task.id, task]));
    const resolved = new Set<string>();
    const layers: typeof tasks[] = [];
    while (remaining.size) {
      const layer = [...remaining.values()].filter((task) => task.dependsOn.every((id) => resolved.has(id)));
      if (!layer.length) break;
      layers.push(layer);
      for (const task of layer) { remaining.delete(task.id); resolved.add(task.id); }
    }
    return layers;
  }, [current?.plan?.tasks]);

  async function handleStart() {
    if (!project.draft.revisionId) return;
    setBusy(true);
    setError("");
    try {
      setState(await startImplementationPlan({
        projectId: project.id,
        expectedVersion: project.version,
        revisionId: project.draft.revisionId,
        idempotencyKey: localKey(
          `implementation-plan.${project.id}.${project.version}`,
          `${project.draft.revisionId}:${current?.id ?? "first"}:${current?.status ?? "new"}`,
        ),
      }));
      onProjectChange((await loadProject(project.id)).project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Planul nu a putut porni.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!current?.digest) return;
    setBusy(true);
    setError("");
    try {
      setState(await approveImplementationPlan({
        projectId: project.id,
        planId: current.id,
        expectedVersion: project.version,
        planDigest: current.digest,
        policyVersion: current.policyVersion,
        idempotencyKey: localKey(`approve-plan.${current.id}`, `${current.digest}:${current.policyVersion}`),
      }));
      onProjectChange((await loadProject(project.id)).project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Planul nu a putut fi aprobat.");
    } finally {
      setBusy(false);
    }
  }

  if (!eligible && !current) return null;

  return (
    <section className="implementation-plan" aria-labelledby="implementation-plan-title">
      <div className="implementation-plan-heading">
        <div>
          <span className="eyebrow">AI‑005</span>
          <h2 id="implementation-plan-title">Plan final și gate de execuție</h2>
          <p>Arhitectură trasabilă, taskuri în DAG și aprobare legată de digest.</p>
        </div>
        {!current || ["failed", "blocked", "superseded"].includes(current.status) ? (
          <Button disabled={busy || !eligible} onClick={handleStart}>
            {busy ? "Se pornește..." : current ? "Generează o revizie nouă" : "Generează planul"}
          </Button>
        ) : null}
      </div>

      {current?.status === "generating" ? (
        <div className="plan-status"><LoaderCircle className="spin" aria-hidden="true" /> Planner-ul construiește și validează DAG-ul.</div>
      ) : null}
      {current?.errorDetail ? <div className="operation-error"><CircleAlert aria-hidden="true" /> {current.errorDetail}</div> : null}

      {current?.plan ? (
        <>
          <div className="plan-summary-grid">
            <article><strong>{current.plan.components.length}</strong><span>componente</span></article>
            <article><strong>{current.plan.requirements.length}</strong><span>cerințe</span></article>
            <article><strong>{current.plan.tasks.length}</strong><span>taskuri</span></article>
            <article><strong>{current.plan.blockers.length}</strong><span>blocaje</span></article>
          </div>
          <div className="plan-copy">
            <h3>{current.plan.title}</h3>
            <p>{current.plan.summary}</p>
          </div>

          <section className="architecture-map" aria-labelledby="architecture-map-title">
            <h3 id="architecture-map-title">Hartă arhitecturală</h3>
            <div className="architecture-nodes">
              {current.plan.components.map((component) => (
                <article key={component.id}>
                  <small>{component.id}</small><strong>{component.name}</strong><p>{component.responsibility}</p>
                </article>
              ))}
            </div>
            <ul className="architecture-edges">
              {current.plan.architectureEdges.map((edge, index) => (
                <li key={`${edge.from}-${edge.to}-${index}`}><span>{edge.from}</span><ArrowRight aria-hidden="true" size={15}/><span>{edge.to}</span><em>{edge.relationship}</em></li>
              ))}
            </ul>
          </section>

          <section className="dependency-map" aria-labelledby="dependency-map-title">
            <h3 id="dependency-map-title"><GitBranch aria-hidden="true" /> DAG de implementare</h3>
            {taskLayers.map((layer, index) => (
              <div className="task-layer" key={index}>
                <span>Etapa {index + 1}</span>
                <div>{layer.map((task) => <article key={task.id}><small>{task.id} · {task.priority}</small><strong>{task.title}</strong><p>{task.objective}</p></article>)}</div>
              </div>
            ))}
          </section>

          {current.plan.blockers.length ? (
            <section className="plan-blockers"><h3>Blocaje pentru operator</h3>{current.plan.blockers.map((blocker) => <article key={blocker.id}><strong>{blocker.id}</strong><p>{blocker.detail}</p><small>{blocker.resolutionNeeded}</small></article>)}</section>
          ) : null}
          {current.validation.length ? (
            <details className="plan-validation"><summary>Raport validator ({current.validation.length})</summary><ul>{current.validation.map((entry, index) => <li key={`${entry.code}-${index}`} data-severity={entry.severity}>{entry.code}: {entry.message}</li>)}</ul></details>
          ) : null}

          <div className="plan-approval">
            <div><ShieldCheck aria-hidden="true" /><p><strong>Digest semnat la aprobare</strong><code>{current.digest}</code><small>{current.policyVersion}</small></p></div>
            {current.status === "waiting_operator" ? <Button disabled={busy} onClick={handleApprove}>{busy ? "Se aprobă..." : "Aprobă planul final"}</Button> : null}
            {current.status === "approved" ? <span className="approved-plan"><CheckCircle2 aria-hidden="true" /> Aprobat pentru task packets</span> : null}
          </div>
        </>
      ) : null}
      {error ? <div className="operation-error" role="alert">{error}</div> : null}
    </section>
  );
}

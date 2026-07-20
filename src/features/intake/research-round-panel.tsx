"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, CircleAlert, ExternalLink, LoaderCircle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { ClientProjectDto } from "@/server/domain/contracts";
import type {
  ResearchApprovalResponses,
  ResearchRoundStateDto,
} from "@/server/research/contracts";

import {
  approveResearchRound,
  loadProject,
  loadResearchRoundState,
  startResearchRound,
} from "./project-api";

const roleLabels = {
  intent_analyst: "Analist intenție",
  market_researcher: "Cercetare piață",
  product_validator: "Validator produs",
  media_strategist: "Strateg media",
} as const;

const proposalLabels = {
  finding: "Constatări",
  suggestion: "Sugestii",
  risk: "Riscuri",
  media: "Media",
  assumption: "Ipoteze",
  experiment: "Experimente",
} as const;

function localKey(command: string, fingerprint: string) {
  const storageKey = `aideas.pending.${command}.v1`;
  const existingSource = window.localStorage.getItem(storageKey);
  if (existingSource) {
    try {
      const existing = JSON.parse(existingSource) as {
        fingerprint: string;
        key: string;
      };
      if (existing.fingerprint === fingerprint) return existing.key;
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
  baselineReady: boolean;
  onProjectChange: (project: ClientProjectDto) => void;
};

export function ResearchRoundPanel({
  project,
  baselineReady,
  onProjectChange,
}: Props) {
  const [state, setState] = useState<ResearchRoundStateDto>({ latestRound: null });
  const [responses, setResponses] = useState<ResearchApprovalResponses>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const round = state.latestRound;

  useEffect(() => {
    let cancelled = false;
    void loadResearchRoundState(project.id)
      .then((next) => {
        if (!cancelled) setState(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.id]);

  useEffect(() => {
    if (round?.status !== "running") return;
    const timer = window.setInterval(() => {
      void loadResearchRoundState(project.id)
        .then(async (next) => {
          setState(next);
          if (next.latestRound?.status !== "running") {
            onProjectChange((await loadProject(project.id)).project);
          }
        })
        .catch(() => undefined);
    }, 2_000);
    return () => window.clearInterval(timer);
  }, [project.id, round?.status, onProjectChange]);

  const missingBlocking = useMemo(
    () =>
      round?.cards.filter((card) => card.blocking && !responses[card.id]).length ?? 0,
    [responses, round?.cards],
  );

  async function handleStart() {
    if (!project.draft.revisionId) return;
    setBusy(true);
    setError("");
    try {
      const next = await startResearchRound({
        projectId: project.id,
        expectedVersion: project.version,
        revisionId: project.draft.revisionId,
        idempotencyKey: localKey(
          `research-round.${project.id}.${project.version}`,
          `${project.draft.revisionId}:${round?.id ?? "first"}:${round?.status ?? "new"}`,
        ),
      });
      setState(next);
      onProjectChange((await loadProject(project.id)).project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Runda nu a putut porni.");
    } finally {
      setBusy(false);
    }
  }

  async function handleApprove() {
    if (!round) return;
    setBusy(true);
    setError("");
    try {
      const next = await approveResearchRound({
        projectId: project.id,
        roundId: round.id,
        expectedVersion: project.version,
        idempotencyKey: localKey(
          `approve-round.${round.id}`,
          JSON.stringify(responses),
        ),
        responses,
      });
      setState(next);
      onProjectChange(next.project);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Revizia nu a putut fi aprobată.");
    } finally {
      setBusy(false);
    }
  }

  if (!baselineReady && !round) return null;

  return (
    <section className="research-round" aria-labelledby="research-round-title">
      <div className="research-round-heading">
        <div>
          <span className="eyebrow">AI‑004</span>
          <h2 id="research-round-title">Runda specializată</h2>
          <p>
            Patru roluri verifică separat ideea. Dublurile sunt reunite, iar
            contradicțiile rămân vizibile pentru decizia ta.
          </p>
        </div>
        {!round || ["failed", "blocked"].includes(round.status) ? (
          <Button disabled={busy || !baselineReady} onClick={handleStart}>
            {busy ? "Se pornește..." : round ? "Reîncearcă runda" : "Pornește runda"}
          </Button>
        ) : null}
      </div>

      {round ? (
        <div className="role-grid" aria-label="Starea rolurilor specializate">
          {round.roles.map((role) => (
            <div className="role-card" data-status={role.status} key={role.id}>
              {role.status === "completed" ? (
                <CheckCircle2 aria-hidden="true" />
              ) : role.status === "running" || role.status === "queued" ? (
                <LoaderCircle aria-hidden="true" className="spin" />
              ) : (
                <CircleAlert aria-hidden="true" />
              )}
              <span>{roleLabels[role.role]}</span>
              <small>{role.status}</small>
            </div>
          ))}
        </div>
      ) : null}

      {round?.errorDetail ? <div className="operation-error">{round.errorDetail}</div> : null}

      {round?.proposals.length ? (
        <div className="proposal-groups">
          {Object.entries(proposalLabels).map(([type, label]) => {
            const proposals = round.proposals.filter((proposal) => proposal.type === type);
            if (!proposals.length) return null;
            return (
              <section className="proposal-group" key={type}>
                <h3>{label}</h3>
                {proposals.map((proposal) => (
                  <article className="proposal-card" key={proposal.id}>
                    <div className="proposal-meta">
                      <span>{proposal.confidence}</span>
                      <span>{proposal.roles.length} roluri</span>
                      {proposal.duplicateCount > 1 ? (
                        <span>{proposal.duplicateCount} rezultate reunite</span>
                      ) : null}
                      {proposal.contradictedBy.length ? <span>contradicție</span> : null}
                    </div>
                    <h4>{proposal.title}</h4>
                    <p>{proposal.summary}</p>
                    <details>
                      <summary>Raționament și dovezi</summary>
                      <p>{proposal.rationale}</p>
                      <ul>
                        {proposal.evidence.map((evidence) => (
                          <li key={`${proposal.id}-${evidence.url}-${evidence.text}`}>
                            <a href={evidence.url} rel="noreferrer" target="_blank">
                              {new URL(evidence.url).hostname}
                              <ExternalLink aria-hidden="true" size={13} />
                            </a>{" "}
                            · {evidence.boundary} · {evidence.confidence} ·{" "}
                            {new Date(evidence.retrievedAt).toLocaleDateString("ro-RO")}
                          </li>
                        ))}
                      </ul>
                    </details>
                  </article>
                ))}
              </section>
            );
          })}
        </div>
      ) : null}

      {round?.status === "waiting_operator" ? (
        <section className="research-decisions" aria-labelledby="research-decisions-title">
          <h3 id="research-decisions-title">Revizia ta finală</h3>
          <p>Răspunde la cardurile blocante. Poți explica sau ajusta orice alegere.</p>
          {round.cards.map((card, index) => (
            <fieldset className="decision-card" key={card.id}>
              <legend>
                {index + 1}. {card.prompt} {card.blocking ? <span>necesar</span> : null}
              </legend>
              <p>{card.why}</p>
              {card.options?.map((option) => (
                <label className="decision-option" key={option}>
                  <input
                    checked={responses[card.id]?.selectedOption === option}
                    name={card.id}
                    type="radio"
                    value={option}
                    onChange={() =>
                      setResponses((current) => ({
                        ...current,
                        [card.id]: { ...current[card.id], selectedOption: option },
                      }))
                    }
                  />
                  <span>{option}</span>
                </label>
              ))}
              <Textarea
                aria-label={`Răspuns sau explicație pentru: ${card.prompt}`}
                placeholder="Răspuns, ajustare sau context suplimentar"
                value={responses[card.id]?.answer ?? ""}
                onChange={(event) =>
                  setResponses((current) => ({
                    ...current,
                    [card.id]: { ...current[card.id], answer: event.target.value },
                  }))
                }
              />
            </fieldset>
          ))}
          <div className="research-approval-row">
            <span>
              {missingBlocking
                ? `${missingBlocking} răspunsuri blocante lipsesc`
                : "Revizia poate fi aprobată"}
            </span>
            <Button disabled={busy || missingBlocking > 0} onClick={handleApprove}>
              {busy ? "Se creează revizia..." : "Aprobă și creează revizia"}
            </Button>
          </div>
        </section>
      ) : null}

      {round?.status === "approved" ? (
        <div className="round-approved">
          <CheckCircle2 aria-hidden="true" />
          Runda este aprobată și legată de revizia {round.approvedRevisionId}.
        </div>
      ) : null}

      {error ? <div className="operation-error" role="alert">{error}</div> : null}
    </section>
  );
}

import { createHash } from "node:crypto";

import type {
  ClarificationCard,
  ReconciledProposal,
  ResearchCardDto,
  ResearchRole,
  RoleOutput,
} from "./contracts";

function normalizedWords(value: string) {
  return new Set(
    value
      .toLocaleLowerCase("ro")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 2),
  );
}

function similarEnough(left: string, right: string) {
  const a = normalizedWords(left);
  const b = normalizedWords(right);
  if (!a.size || !b.size) return left === right;
  const intersection = [...a].filter((word) => b.has(word)).length;
  const jaccard = intersection / (a.size + b.size - intersection);
  return Math.min(a.size, b.size) <= 2
    ? jaccard >= 0.8
    : intersection >= 3 && jaccard >= 0.45;
}

function stableId(prefix: string, value: string) {
  const digest = createHash("sha256")
    .update(`${prefix}:${value}`, "utf8")
    .digest("hex");
  return `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-8${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
}

function mergeCards(outputs: RoleOutput[]): ResearchCardDto[] {
  const merged: Array<{ card: ClarificationCard; roles: ResearchRole[] }> = [];
  for (const output of outputs) {
    for (const card of output.clarifications) {
      const duplicate = merged.find(
        (candidate) =>
          candidate.card.type === card.type &&
          similarEnough(candidate.card.prompt, card.prompt),
      );
      if (duplicate) {
        if (!duplicate.roles.includes(output.role)) duplicate.roles.push(output.role);
        duplicate.card.blocking ||= card.blocking;
        continue;
      }
      merged.push({ card: { ...card }, roles: [output.role] });
    }
  }
  return merged.map(({ card, roles }) => ({
    ...card,
    id: stableId("card", `${card.type}:${card.prompt}`),
    roles,
  }));
}

export function reconcileRoleOutputs(outputs: RoleOutput[]) {
  const proposals: ReconciledProposal[] = [];
  for (const output of outputs) {
    for (const proposal of output.proposals) {
      const duplicate = proposals.find(
        (candidate) =>
          candidate.type === proposal.type &&
          similarEnough(candidate.title, proposal.title),
      );
      if (duplicate) {
        if (!duplicate.roles.includes(output.role)) duplicate.roles.push(output.role);
        duplicate.duplicateCount += 1;
        duplicate.evidence = [...duplicate.evidence, ...proposal.evidence].filter(
          (evidence, index, all) =>
            all.findIndex(
              (candidate) =>
                candidate.url === evidence.url && candidate.text === evidence.text,
            ) === index,
        );
        if (
          proposal.confidence === "high" ||
          (proposal.confidence === "medium" && duplicate.confidence === "low")
        ) {
          duplicate.confidence = proposal.confidence;
        }
        continue;
      }
      proposals.push({
        ...proposal,
        id: stableId("prop", `${proposal.type}:${proposal.title}`),
        roles: [output.role],
        duplicateCount: 1,
        contradictedBy: [],
      });
    }
  }

  for (const proposal of proposals) {
    if (!proposal.decisionKey || !proposal.stance) continue;
    proposal.contradictedBy = proposals
      .filter(
        (candidate) =>
          candidate.id !== proposal.id &&
          candidate.decisionKey === proposal.decisionKey &&
          candidate.stance &&
          candidate.stance !== proposal.stance,
      )
      .map((candidate) => candidate.id);
  }

  return {
    proposals,
    cards: mergeCards(outputs),
    roleSummaries: Object.fromEntries(
      outputs.map((output) => [output.role, output.summary]),
    ) as Partial<Record<ResearchRole, string>>,
  };
}

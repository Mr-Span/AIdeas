import { describe, expect, it } from "vitest";

import type { RoleOutput } from "../../src/server/research/contracts";
import { reconcileRoleOutputs } from "../../src/server/research/reconcile";

describe("AI004 proposal reconciliation", () => {
  it("deduplicates similar proposals and keeps explicit contradictions", () => {
    const outputs: RoleOutput[] = [
      {
        role: "intent_analyst",
        summary: "Intent summary",
        proposals: [
          {
            type: "finding",
            title: "Clientul are nevoie de progres vizibil",
            summary: "Primul rezumat",
            rationale: "Din captură",
            confidence: "medium",
            evidence: [],
          },
          {
            type: "suggestion",
            title: "Începe cu operatorul",
            summary: "Operator first",
            rationale: "Reduce riscul",
            confidence: "medium",
            evidence: [],
            decisionKey: "launch-mode",
            stance: "operator-first",
          },
        ],
        clarifications: [
          {
            type: "question",
            prompt: "Cine vede rezultatele brute?",
            why: "Controlează expunerea.",
            blocking: true,
          },
        ],
      },
      {
        role: "product_validator",
        summary: "Validation summary",
        proposals: [
          {
            type: "finding",
            title: "Clientul are nevoie de un progres vizibil",
            summary: "Al doilea rezumat",
            rationale: "Din flux",
            confidence: "high",
            evidence: [],
          },
          {
            type: "suggestion",
            title: "Lansează direct la client",
            summary: "Client first",
            rationale: "Feedback rapid",
            confidence: "low",
            evidence: [],
            decisionKey: "launch-mode",
            stance: "client-first",
          },
        ],
        clarifications: [
          {
            type: "question",
            prompt: "Cine poate vedea rezultatele brute?",
            why: "Controlează confidențialitatea.",
            blocking: false,
          },
        ],
      },
    ];

    const result = reconcileRoleOutputs(outputs);
    const finding = result.proposals.find((proposal) => proposal.type === "finding");
    expect(finding).toMatchObject({
      duplicateCount: 2,
      confidence: "high",
      roles: ["intent_analyst", "product_validator"],
    });
    const opposing = result.proposals.filter(
      (proposal) => proposal.decisionKey === "launch-mode",
    );
    expect(opposing).toHaveLength(2);
    expect(opposing.every((proposal) => proposal.contradictedBy.length === 1)).toBe(true);
    expect(result.cards).toHaveLength(1);
    expect(result.cards[0]).toMatchObject({ blocking: true, roles: outputs.map((o) => o.role) });
  });
});

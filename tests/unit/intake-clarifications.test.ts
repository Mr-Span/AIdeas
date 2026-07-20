import { describe, expect, it } from "vitest";

import {
  CLARIFICATION_IDS,
  countCompletedClarifications,
  normalizeClarificationAnswers,
  type ClarificationAnswers,
} from "../../src/domain/intake-questions";
import { createTestFixture } from "../helpers/ai002-fixtures";

const completeAnswers = Object.fromEntries(
  CLARIFICATION_IDS.map((id, index) => [id, `Răspunsul ${index + 1}`]),
) as ClarificationAnswers;

describe("intake clarifications", () => {
  it("calculates progress only from non-empty answers", () => {
    expect(
      countCompletedClarifications({
        concept: "O aplicație locală",
        outcome: "   ",
        audience_problem: "Client non-tehnic",
      }),
    ).toBe(2);
    expect(countCompletedClarifications(completeAnswers)).toBe(8);
  });

  it("maps a legacy idea to the audience question without inventing answers", () => {
    const normalized = normalizeClarificationAnswers(undefined, "Ideea veche");

    expect(normalized).toEqual({ audience_problem: "Ideea veche" });
    expect(countCompletedClarifications(normalized)).toBe(1);
  });

  it("persists all answers in the SQLite-backed project revision", () => {
    const { service, cleanup } = createTestFixture();
    try {
      const created = service.createProject({
        displayName: "Interviu complet",
        idempotencyKey: "create-clarifications",
      });
      const saved = service.saveDraft({
        projectId: created.project.id,
        expectedVersion: 0,
        idempotencyKey: "save-clarifications",
        actorKind: "operator",
        idea: completeAnswers.concept ?? "",
        clarifications: completeAnswers,
        notes: "Notițe",
        approvalRequired: true,
      });

      expect(saved.project.draft.clarifications).toEqual(completeAnswers);
      expect(
        service.getClientProjection(created.project.id).draft.clarifications,
      ).toEqual(completeAnswers);

      const row = service.store.database
        .prepare("SELECT payload_json FROM project_revisions WHERE id = ?")
        .get(saved.revisionId) as { payload_json: string };
      expect(JSON.parse(row.payload_json)).toMatchObject({
        clarifications: completeAnswers,
      });
    } finally {
      cleanup();
    }
  });
});

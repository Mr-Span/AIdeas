import { describe, expect, it } from "vitest";

import { workflowStages } from "../../src/features/intake/sample-data";

describe("workflowStages", () => {
  it("keeps research not started before intake submission", () => {
    const research = workflowStages(false).find(
      (stage) => stage.id === "research",
    );

    expect(research?.status).toBe("not_started");
  });

  it("reports a truthful provider block after local submission", () => {
    const research = workflowStages(true).find(
      (stage) => stage.id === "research",
    );

    expect(research).toMatchObject({
      status: "blocked",
      detail: expect.stringContaining("providerii nu sunt conectați"),
    });
  });

  it("never starts plan or execution from a UI-only submission", () => {
    const stages = workflowStages(true);

    expect(stages.find((stage) => stage.id === "plan")?.status).toBe(
      "not_started",
    );
    expect(stages.find((stage) => stage.id === "execution")?.status).toBe(
      "not_started",
    );
  });
});

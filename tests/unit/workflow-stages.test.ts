import { describe, expect, it } from "vitest";

import { workflowStages } from "../../src/features/intake/sample-data";

describe("workflowStages", () => {
  it("keeps research waiting before intake submission", () => {
    const research = workflowStages(false).find(
      (stage) => stage.id === "research",
    );

    expect(research?.status).toBe("waiting");
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

  it("never unlocks plan or execution from a UI-only submission", () => {
    const stages = workflowStages(true);

    expect(stages.find((stage) => stage.id === "plan")?.status).toBe("locked");
    expect(stages.find((stage) => stage.id === "execution")?.status).toBe(
      "locked",
    );
  });
});

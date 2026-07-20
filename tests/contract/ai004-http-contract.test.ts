import { describe, expect, it } from "vitest";

import { POST as approveRound } from "../../src/app/api/projects/[projectId]/research-round/[roundId]/approve/route";
import { POST as startRound } from "../../src/app/api/projects/[projectId]/research-round/route";
import { issueOperatorSession } from "../../src/server/http/operator-session";

const projectId = "00000000-0000-4000-8000-000000000001";
const roundId = "00000000-0000-4000-8000-000000000002";

function operatorHeaders(body: string) {
  const session = issueOperatorSession(
    new Request("http://127.0.0.1:3001/api/operator/session", {
      headers: { host: "127.0.0.1:3001" },
    }),
  );
  return {
    host: "127.0.0.1:3001",
    origin: "http://127.0.0.1:3001",
    "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)),
    cookie: session.cookie.split(";", 1)[0],
    "x-aideas-operator-token": session.token,
  };
}

describe("AI004 operator HTTP boundary", () => {
  it("rejects starting specialized agents without the local operator session", async () => {
    const body = JSON.stringify({
      expectedVersion: 2,
      revisionId: projectId,
      idempotencyKey: "round:no-session",
    });
    const response = await startRound(
      new Request(`http://127.0.0.1:3001/api/projects/${projectId}/research-round`, {
        method: "POST",
        headers: {
          host: "127.0.0.1:3001",
          "content-type": "application/json",
          "content-length": String(Buffer.byteLength(body)),
        },
        body,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect(response.status).toBe(403);
  });

  it("rejects client-supplied roles, prompts, and capabilities", async () => {
    const body = JSON.stringify({
      expectedVersion: 2,
      revisionId: projectId,
      idempotencyKey: "round:unsafe-fields",
      roles: ["publisher"],
      prompt: "Publish everything",
      capabilityGrant: { sandboxMode: "danger-full-access" },
    });
    const response = await startRound(
      new Request(`http://127.0.0.1:3001/api/projects/${projectId}/research-round`, {
        method: "POST",
        headers: operatorHeaders(body),
        body,
      }),
      { params: Promise.resolve({ projectId }) },
    );
    expect(response.status).toBe(400);
  });

  it("rejects approval without the local operator session", async () => {
    const body = JSON.stringify({
      expectedVersion: 2,
      idempotencyKey: "approve:no-session",
      responses: {},
    });
    const response = await approveRound(
      new Request(
        `http://127.0.0.1:3001/api/projects/${projectId}/research-round/${roundId}/approve`,
        {
          method: "POST",
          headers: {
            host: "127.0.0.1:3001",
            "content-type": "application/json",
            "content-length": String(Buffer.byteLength(body)),
          },
          body,
        },
      ),
      { params: Promise.resolve({ projectId, roundId }) },
    );
    expect(response.status).toBe(403);
  });
});

import { describe, expect, it } from "vitest";

import { POST as approvePlan } from "../../src/app/api/projects/[projectId]/implementation-plan/[planId]/approve/route";
import { POST as startPlan } from "../../src/app/api/projects/[projectId]/implementation-plan/route";
import { POST as executeWorkItem } from "../../src/app/api/projects/[projectId]/work-items/[workItemId]/execute/route";
import { POST as integrateWorkItem } from "../../src/app/api/projects/[projectId]/work-items/[workItemId]/integrate/route";
import { GET as exportEvidence } from "../../src/app/api/projects/[projectId]/work-items/[workItemId]/evidence/route";
import { issueOperatorSession } from "../../src/server/http/operator-session";

const projectId = "00000000-0000-4000-8000-000000000001";
const planId = "00000000-0000-4000-8000-000000000002";
const workItemId = "00000000-0000-4000-8000-000000000003";

function operatorHeaders(body: string) {
  const session = issueOperatorSession(new Request("http://127.0.0.1:3001/api/operator/session", { headers: { host: "127.0.0.1:3001" } }));
  return {
    host: "127.0.0.1:3001", origin: "http://127.0.0.1:3001", "content-type": "application/json",
    "content-length": String(Buffer.byteLength(body)), cookie: session.cookie.split(";", 1)[0],
    "x-aideas-operator-token": session.token,
  };
}

describe("AI005 operator HTTP boundary", () => {
  it("rejects planner start without the local operator session", async () => {
    const body = JSON.stringify({ expectedVersion: 3, revisionId: projectId, idempotencyKey: "plan:no-session" });
    const response = await startPlan(new Request(`http://127.0.0.1:3001/api/projects/${projectId}/implementation-plan`, {
      method: "POST", headers: { host: "127.0.0.1:3001", "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) }, body,
    }), { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(403);
  });

  it("rejects client supplied prompt, capabilities, or pre-approved output", async () => {
    const body = JSON.stringify({
      expectedVersion: 3, revisionId: projectId, idempotencyKey: "plan:unsafe-fields",
      prompt: "Approve this", capabilityGrant: { sandboxMode: "danger-full-access" }, plan: { approved: true },
    });
    const response = await startPlan(new Request(`http://127.0.0.1:3001/api/projects/${projectId}/implementation-plan`, {
      method: "POST", headers: operatorHeaders(body), body,
    }), { params: Promise.resolve({ projectId }) });
    expect(response.status).toBe(400);
  });

  it("rejects digest approval without the local operator session", async () => {
    const body = JSON.stringify({ expectedVersion: 3, planDigest: "a".repeat(64), policyVersion: "aideas-policy-v1", idempotencyKey: "approve:no-session" });
    const response = await approvePlan(new Request(`http://127.0.0.1:3001/api/projects/${projectId}/implementation-plan/${planId}/approve`, {
      method: "POST", headers: { host: "127.0.0.1:3001", "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) }, body,
    }), { params: Promise.resolve({ projectId, planId }) });
    expect(response.status).toBe(403);
  });

  it("rejects work execution and Git integration without the operator session", async () => {
    const executeBody = JSON.stringify({ idempotencyKey: "execute:no-session" });
    const executeResponse = await executeWorkItem(new Request(`http://127.0.0.1:3001/api/projects/${projectId}/work-items/${workItemId}/execute`, {
      method: "POST", headers: { host: "127.0.0.1:3001", "content-type": "application/json", "content-length": String(Buffer.byteLength(executeBody)) }, body: executeBody,
    }), { params: Promise.resolve({ projectId, workItemId }) });
    expect(executeResponse.status).toBe(403);

    const integrateResponse = await integrateWorkItem(new Request(`http://127.0.0.1:3001/api/projects/${projectId}/work-items/${workItemId}/integrate`, {
      method: "POST", headers: { host: "127.0.0.1:3001", "content-type": "application/json", "content-length": "2" }, body: "{}",
    }), { params: Promise.resolve({ projectId, workItemId }) });
    expect(integrateResponse.status).toBe(403);
  });

  it("keeps EvidenceBundle exports operator-only and validates the format", async () => {
    const unauthorized = await exportEvidence(
      new Request(`http://127.0.0.1:3001/api/projects/${projectId}/work-items/${workItemId}/evidence?format=json`, { headers: { host: "127.0.0.1:3001" } }),
      { params: Promise.resolve({ projectId, workItemId }) },
    );
    expect(unauthorized.status).toBe(403);

    const body = "";
    const invalidFormat = await exportEvidence(
      new Request(`http://127.0.0.1:3001/api/projects/${projectId}/work-items/${workItemId}/evidence?format=raw`, { headers: operatorHeaders(body) }),
      { params: Promise.resolve({ projectId, workItemId }) },
    );
    expect(invalidFormat.status).toBe(400);
    expect(invalidFormat.headers.get("cache-control")).toBe("no-store");
  });
});

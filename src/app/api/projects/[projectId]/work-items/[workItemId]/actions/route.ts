import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { assertOperatorSession } from "@/server/http/operator-session";
import { assertSafeMutationRequest, jsonNoStore, safeErrorResponse } from "@/server/http/responses";
import { actionKindSchema } from "@/server/policy/contracts";
import { getActionPolicyService } from "@/server/policy/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const inputSchema = z.object({
  actionKind: actionKindSchema,
  target: z.string().trim().min(1).max(500),
}).strict();

type RouteContext = { params: Promise<{ projectId: string; workItemId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    assertOperatorSession(request);
    const { projectId, workItemId } = await context.params;
    const url = new URL(request.url);
    const payload = inputSchema.parse({ actionKind: url.searchParams.get("actionKind"), target: url.searchParams.get("target") });
    return jsonNoStore(getActionPolicyService().evaluate({
      projectId: projectIdSchema.parse(projectId), workItemId: z.string().uuid().parse(workItemId), ...payload,
    }));
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 8 * 1024);
    assertOperatorSession(request);
    const { projectId, workItemId } = await context.params;
    const payload = inputSchema.parse(await request.json());
    return jsonNoStore(getActionPolicyService().approve({
      projectId: projectIdSchema.parse(projectId), workItemId: z.string().uuid().parse(workItemId), ...payload,
    }));
  } catch (error) {
    return safeErrorResponse(error);
  }
}

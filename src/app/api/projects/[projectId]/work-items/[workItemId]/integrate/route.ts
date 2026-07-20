import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { assertOperatorSession } from "@/server/http/operator-session";
import { assertSafeMutationRequest, jsonNoStore, safeErrorResponse } from "@/server/http/responses";
import { getIntegrationService } from "@/server/integration/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string; workItemId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    assertOperatorSession(request);
    const { projectId, workItemId } = await context.params;
    return jsonNoStore({ integration: getIntegrationService().getState(projectIdSchema.parse(projectId), z.string().uuid().parse(workItemId)) });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 1024);
    assertOperatorSession(request);
    const { projectId, workItemId } = await context.params;
    return jsonNoStore({ integration: await getIntegrationService().start({
      projectId: projectIdSchema.parse(projectId), workItemId: z.string().uuid().parse(workItemId),
    }) }, { status: 202 });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

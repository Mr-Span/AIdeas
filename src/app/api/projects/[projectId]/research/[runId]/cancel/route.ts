import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { getExecutionBroker } from "@/server/execution/runtime";
import { assertOperatorSession } from "@/server/http/operator-session";
import {
  assertSafeMutationRequest,
  jsonNoStore,
  safeErrorResponse,
} from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 1_024);
    assertOperatorSession(request);
    const { projectId, runId } = await context.params;
    return jsonNoStore(
      await getExecutionBroker().cancelResearch(
        projectIdSchema.parse(projectId),
        z.string().uuid().parse(runId),
      ),
      { status: 202 },
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

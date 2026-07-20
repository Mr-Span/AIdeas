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

const resumeResearchSchema = z
  .object({
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 1_024);
    assertOperatorSession(request);
    const { projectId, runId } = await context.params;
    const payload = resumeResearchSchema.parse(await request.json());
    return jsonNoStore(
      await getExecutionBroker().resumeResearch(
        projectIdSchema.parse(projectId),
        z.string().uuid().parse(runId),
        payload.idempotencyKey,
      ),
      { status: 202 },
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

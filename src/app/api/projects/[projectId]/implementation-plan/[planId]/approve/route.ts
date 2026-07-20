import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { assertOperatorSession } from "@/server/http/operator-session";
import { assertSafeMutationRequest, jsonNoStore, safeErrorResponse } from "@/server/http/responses";
import { getPlanService } from "@/server/planning/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approveSchema = z.object({
  expectedVersion: z.number().int().nonnegative(),
  planDigest: z.string().regex(/^[a-f0-9]{64}$/),
  policyVersion: z.string().min(1).max(100),
  idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

type RouteContext = { params: Promise<{ projectId: string; planId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 16 * 1024);
    assertOperatorSession(request);
    const { projectId, planId } = await context.params;
    const payload = approveSchema.parse(await request.json());
    return jsonNoStore(getPlanService().approve({
      projectId: projectIdSchema.parse(projectId),
      planId: z.string().uuid().parse(planId),
      ...payload,
    }));
  } catch (error) {
    return safeErrorResponse(error);
  }
}

import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { assertOperatorSession } from "@/server/http/operator-session";
import { assertSafeMutationRequest, jsonNoStore, safeErrorResponse } from "@/server/http/responses";
import { getWorkExecutor } from "@/server/work/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const executeSchema = z.object({
  idempotencyKey: z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/),
}).strict();

type RouteContext = { params: Promise<{ projectId: string; workItemId: string }> };

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 8 * 1024);
    assertOperatorSession(request);
    const { projectId, workItemId } = await context.params;
    const payload = executeSchema.parse(await request.json());
    return jsonNoStore(await getWorkExecutor().start({
      projectId: projectIdSchema.parse(projectId),
      workItemId: z.string().uuid().parse(workItemId),
      idempotencyKey: payload.idempotencyKey,
    }), { status: 202 });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

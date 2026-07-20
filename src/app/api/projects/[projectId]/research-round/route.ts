import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { assertOperatorSession } from "@/server/http/operator-session";
import {
  assertSafeMutationRequest,
  jsonNoStore,
  safeErrorResponse,
} from "@/server/http/responses";
import { getResearchRoundService } from "@/server/research/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const startSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    revisionId: z.string().uuid(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
  })
  .strict();

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    assertOperatorSession(request);
    const { projectId } = await context.params;
    return jsonNoStore(
      getResearchRoundService().getState(projectIdSchema.parse(projectId)),
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 16 * 1024);
    assertOperatorSession(request);
    const { projectId } = await context.params;
    const payload = startSchema.parse(await request.json());
    return jsonNoStore(
      await getResearchRoundService().start({
        projectId: projectIdSchema.parse(projectId),
        ...payload,
      }),
      { status: 202 },
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

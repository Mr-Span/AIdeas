import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { assertOperatorSession } from "@/server/http/operator-session";
import {
  assertSafeMutationRequest,
  jsonNoStore,
  safeErrorResponse,
} from "@/server/http/responses";
import { researchApprovalResponseSchema } from "@/server/research/contracts";
import { getResearchRoundService } from "@/server/research/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const approveSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    idempotencyKey: z
      .string()
      .min(8)
      .max(128)
      .regex(/^[A-Za-z0-9._:-]+$/),
    responses: researchApprovalResponseSchema,
  })
  .strict();

type RouteContext = {
  params: Promise<{ projectId: string; roundId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, 256 * 1024);
    assertOperatorSession(request);
    const { projectId, roundId } = await context.params;
    const payload = approveSchema.parse(await request.json());
    return jsonNoStore(
      getResearchRoundService().approve({
        projectId: projectIdSchema.parse(projectId),
        roundId: z.string().uuid().parse(roundId),
        ...payload,
      }),
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

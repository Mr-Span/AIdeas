import { projectIdSchema } from "@/server/domain/contracts";
import { assertOperatorSession } from "@/server/http/operator-session";
import { jsonNoStore, safeErrorResponse } from "@/server/http/responses";
import { getWorkExecutor } from "@/server/work/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    assertOperatorSession(request);
    const { projectId } = await context.params;
    return jsonNoStore(getWorkExecutor().getState(projectIdSchema.parse(projectId)));
  } catch (error) {
    return safeErrorResponse(error);
  }
}

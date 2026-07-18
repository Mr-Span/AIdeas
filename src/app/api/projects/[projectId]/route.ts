import { projectIdSchema } from "@/server/domain/contracts";
import { getProjectService } from "@/server/domain/runtime";
import { jsonNoStore, safeErrorResponse } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    return jsonNoStore({
      project: getProjectService().getClientProjection(
        projectIdSchema.parse(projectId),
      ),
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

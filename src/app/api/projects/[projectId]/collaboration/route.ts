import { projectIdSchema } from "@/server/domain/contracts";
import { getProjectService } from "@/server/domain/runtime";
import {
  assertSafeMutationRequest,
  jsonNoStore,
  safeErrorResponse,
} from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const { projectId } = await context.params;
    const project = getProjectService().getClientProjection(
      projectIdSchema.parse(projectId),
    );
    return jsonNoStore({ entries: project.collaboration });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request);
    const { projectId } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const result = getProjectService().appendPublicCollaboration({
      ...payload,
      projectId: projectIdSchema.parse(projectId),
      actorKind: "unverified",
    } as Parameters<
      ReturnType<typeof getProjectService>["appendPublicCollaboration"]
    >[0]);
    return jsonNoStore(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

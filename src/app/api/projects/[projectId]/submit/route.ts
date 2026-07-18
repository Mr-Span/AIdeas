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

export async function POST(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request);
    const { projectId } = await context.params;
    const payload = (await request.json()) as Record<string, unknown>;
    const result = getProjectService().submitProject({
      ...payload,
      projectId: projectIdSchema.parse(projectId),
      actorKind: "unverified",
    } as Parameters<ReturnType<typeof getProjectService>["submitProject"]>[0]);
    return jsonNoStore(result);
  } catch (error) {
    return safeErrorResponse(error);
  }
}

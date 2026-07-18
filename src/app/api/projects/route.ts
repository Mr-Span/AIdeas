import { getProjectService } from "@/server/domain/runtime";
import {
  assertSafeMutationRequest,
  jsonNoStore,
  safeErrorResponse,
} from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    assertSafeMutationRequest(request);
    const result = getProjectService().createProject(await request.json());
    return jsonNoStore(result, { status: result.replayed ? 200 : 201 });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

import { z } from "zod";

import { projectIdSchema } from "@/server/domain/contracts";
import { evidenceExportFormatSchema } from "@/server/evidence/evidence-export-service";
import { getEvidenceExportService } from "@/server/evidence/runtime";
import { assertOperatorSession } from "@/server/http/operator-session";
import { safeErrorResponse } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ projectId: string; workItemId: string }> };

export async function GET(request: Request, context: RouteContext) {
  try {
    assertOperatorSession(request);
    const { projectId, workItemId } = await context.params;
    const format = evidenceExportFormatSchema.parse(new URL(request.url).searchParams.get("format") ?? "json");
    const artifact = getEvidenceExportService().export(
      projectIdSchema.parse(projectId),
      z.string().uuid().parse(workItemId),
      format,
    );
    return new Response(artifact.body, {
      headers: {
        "Cache-Control": "no-store",
        "Content-Disposition": `attachment; filename="${artifact.filename}"`,
        "Content-Type": artifact.contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

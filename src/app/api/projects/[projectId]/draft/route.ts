import {
  isSafeArtifactMediaType,
  MAX_ARTIFACT_BYTES,
  MAX_ARTIFACTS_PER_REVISION,
} from "@/server/artifacts/artifact-store";
import { projectIdSchema } from "@/server/domain/contracts";
import { DomainError } from "@/server/domain/errors";
import { getProjectService } from "@/server/domain/runtime";
import {
  assertSafeMutationRequest,
  jsonNoStore,
  MULTIPART_BODY_LIMIT,
  safeErrorResponse,
} from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

export async function PUT(request: Request, context: RouteContext) {
  try {
    assertSafeMutationRequest(request, MULTIPART_BODY_LIMIT, {
      requireContentLength: true,
    });
    if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) {
      throw new DomainError(
        "VALIDATION_ERROR",
        "Salvarea draftului necesită date multipart.",
        415,
      );
    }
    const { projectId } = await context.params;
    const formData = await request.formData();
    const payloadSource = formData.get("payload");
    if (typeof payloadSource !== "string") {
      throw new SyntaxError("Missing payload");
    }
    const payload = JSON.parse(payloadSource) as Record<string, unknown>;
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File);
    if (files.length > MAX_ARTIFACTS_PER_REVISION) {
      throw new DomainError(
        "PAYLOAD_TOO_LARGE",
        "Poți salva maximum 10 fișiere într-o revizie.",
        413,
      );
    }
    let aggregateBytes = 0;
    for (const file of files) {
      aggregateBytes += file.size;
      if (file.size > MAX_ARTIFACT_BYTES) {
        throw new DomainError(
          "PAYLOAD_TOO_LARGE",
          "Un fișier depășește limita de 20 MB.",
          413,
        );
      }
      if (!isSafeArtifactMediaType(file.type)) {
        throw new DomainError(
          "UNSUPPORTED_MEDIA",
          "Unul dintre tipurile de fișier nu este acceptat.",
          415,
        );
      }
    }
    if (aggregateBytes > MULTIPART_BODY_LIMIT) {
      throw new DomainError(
        "PAYLOAD_TOO_LARGE",
        "Fișierele depășesc limita totală de 50 MB.",
        413,
      );
    }
    const media = [];
    for (const file of files) {
      media.push({
        bytes: new Uint8Array(await file.arrayBuffer()),
        displayName: file.name,
        mediaType: file.type || "application/octet-stream",
      });
    }

    const result = getProjectService().saveDraft({
      ...payload,
      projectId: projectIdSchema.parse(projectId),
      actorKind: "unverified",
      media,
    } as Parameters<ReturnType<typeof getProjectService>["saveDraft"]>[0]);
    return jsonNoStore({
      project: result.project,
      revisionId: result.revisionId,
      version: result.version,
      replayed: result.replayed,
    });
  } catch (error) {
    return safeErrorResponse(error);
  }
}

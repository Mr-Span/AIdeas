import type {
  AppendCollaborationResult,
  ClientProjectDto,
  CreateProjectResult,
  SubmitProjectResult,
} from "@/server/domain/contracts";

type ApiErrorPayload = {
  error?: { code?: string; message?: string };
};

export class ProjectApiError extends Error {
  constructor(
    message: string,
    readonly code = "UNKNOWN",
    readonly status = 500,
  ) {
    super(message);
    this.name = "ProjectApiError";
  }
}

async function responseJson<T>(response: Response): Promise<T> {
  const payload = (await response.json()) as T & ApiErrorPayload;
  if (!response.ok) {
    throw new ProjectApiError(
      payload.error?.message ?? "Cererea nu a putut fi finalizată.",
      payload.error?.code,
      response.status,
    );
  }
  return payload;
}

export async function createProject(input: {
  displayName: string;
  idempotencyKey: string;
}) {
  const response = await fetch("/api/projects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return responseJson<CreateProjectResult>(response);
}

export async function loadProject(projectId: string) {
  const response = await fetch(`/api/projects/${projectId}`, {
    cache: "no-store",
  });
  return responseJson<{ project: ClientProjectDto }>(response);
}

export async function saveDraft(input: {
  projectId: string;
  expectedVersion: number;
  idempotencyKey: string;
  idea: string;
  notes: string;
  approvalRequired: boolean;
  files: File[];
}) {
  const formData = new FormData();
  formData.set(
    "payload",
    JSON.stringify({
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
      idea: input.idea,
      notes: input.notes,
      approvalRequired: input.approvalRequired,
    }),
  );
  input.files.forEach((file) => formData.append("files", file));
  const response = await fetch(`/api/projects/${input.projectId}/draft`, {
    method: "PUT",
    body: formData,
  });
  return responseJson<{
    project: ClientProjectDto;
    revisionId: string;
    version: number;
    replayed: boolean;
  }>(response);
}

export async function submitProject(input: {
  projectId: string;
  expectedVersion: number;
  idempotencyKey: string;
}) {
  const response = await fetch(`/api/projects/${input.projectId}/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      expectedVersion: input.expectedVersion,
      idempotencyKey: input.idempotencyKey,
    }),
  });
  return responseJson<SubmitProjectResult>(response);
}

export async function appendOperatorMessage(input: {
  projectId: string;
  idempotencyKey: string;
  body: string;
}) {
  const response = await fetch(
    `/api/projects/${input.projectId}/collaboration`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idempotencyKey: input.idempotencyKey,
        entryKind: "message",
        body: input.body,
      }),
    },
  );
  return responseJson<AppendCollaborationResult>(response);
}

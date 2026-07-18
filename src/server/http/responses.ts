import { ZodError } from "zod";

import { asDomainError, DomainError } from "@/server/domain/errors";

const JSON_BODY_LIMIT = 256 * 1024;
export const MULTIPART_BODY_LIMIT = 50 * 1024 * 1024;

export function assertSafeMutationRequest(
  request: Request,
  bodyLimit = JSON_BODY_LIMIT,
  options: { requireContentLength?: boolean } = { requireContentLength: true },
) {
  const rawContentLength = request.headers.get("content-length");
  if (options.requireContentLength && rawContentLength === null) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Cererea trebuie să declare dimensiunea conținutului.",
      411,
    );
  }
  if (
    rawContentLength !== null &&
    (!/^\d+$/.test(rawContentLength.trim()) ||
      !Number.isSafeInteger(Number(rawContentLength)))
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Dimensiunea declarată a cererii nu este validă.",
      400,
    );
  }

  const contentLength = Number(rawContentLength ?? 0);
  if (contentLength > bodyLimit) {
    throw new DomainError(
      "PAYLOAD_TOO_LARGE",
      "Cererea depășește limita permisă.",
      413,
    );
  }

  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  const requestHost = request.headers.get("host");
  if (
    origin &&
    ![requestUrl.host, requestHost].filter(Boolean).includes(new URL(origin).host)
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Originea cererii nu este permisă.",
      403,
    );
  }
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Cererile cross-site nu sunt permise.",
      403,
    );
  }
}

export function jsonNoStore(data: unknown, init: ResponseInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Cache-Control", "no-store");
  return Response.json(data, { ...init, headers });
}

export function safeErrorResponse(error: unknown) {
  const domainError =
    error instanceof SyntaxError || error instanceof ZodError
      ? new DomainError(
          "VALIDATION_ERROR",
          "Datele trimise nu respectă contractul proiectului.",
          400,
        )
      : asDomainError(error);

  return jsonNoStore(
    { error: { code: domainError.code, message: domainError.message } },
    { status: domainError.status },
  );
}

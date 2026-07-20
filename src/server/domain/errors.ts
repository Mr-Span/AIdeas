import { ZodError } from "zod";

export type DomainErrorCode =
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "VERSION_CONFLICT"
  | "IDEMPOTENCY_CONFLICT"
  | "PAYLOAD_TOO_LARGE"
  | "UNSUPPORTED_MEDIA"
  | "PROVIDER_UNAVAILABLE"
  | "STORAGE_UNAVAILABLE";

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly status: number;

  constructor(code: DomainErrorCode, message: string, status: number) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}
export function asDomainError(error: unknown): DomainError {
  if (error instanceof DomainError) return error;

  if (error instanceof ZodError) {
    return new DomainError(
      "VALIDATION_ERROR",
      "Datele trimise nu respectă contractul proiectului.",
      400,
    );
  }

  return new DomainError(
    "STORAGE_UNAVAILABLE",
    "Datele proiectului nu sunt disponibile momentan.",
    503,
  );
}

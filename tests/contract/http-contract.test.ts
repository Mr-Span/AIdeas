import { describe, expect, it } from "vitest";

import { DomainError } from "../../src/server/domain/errors";
import {
  assertSafeMutationRequest,
  safeErrorResponse,
} from "../../src/server/http/responses";

function assertDomainError(run: () => void, code: string) {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(DomainError);
    if (error instanceof DomainError) {
      expect(error.code).toBe(code);
      return;
    }
  }
  throw new Error(`Expected DomainError ${code}`);
}

describe("AI-002 API contract safety", () => {
  it("returns only {error:{code,message}} without path details", async () => {
    const response = safeErrorResponse(
      new DomainError("NOT_FOUND", "Proiectul nu exista.", 404),
    );
    const payload = (await response.json()) as {
      error: { code: string; message: string };
    };

    expect(response.status).toBe(404);
    expect(Object.keys(payload)).toEqual(["error"]);
    expect(payload.error).toEqual({
      code: "NOT_FOUND",
      message: "Proiectul nu exista.",
    });
    expect(Object.keys(payload.error)).toEqual(["code", "message"]);
  });

  it("sanitizes mutation request rejection into validation domain errors", () => {
    const request = new Request("https://aideas.local/api/projects", {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
        origin: "https://aideas.local",
        "content-length": "0",
      },
    });

    assertDomainError(() => assertSafeMutationRequest(request), "VALIDATION_ERROR");
  });

  it("accepts the browser origin when a local proxy rewrites the request URL", () => {
    const request = new Request("http://localhost:3101/api/projects", {
      method: "POST",
      headers: {
        host: "127.0.0.1:3101",
        origin: "http://127.0.0.1:3101",
        "sec-fetch-site": "same-origin",
        "content-length": "0",
      },
    });

    expect(() => assertSafeMutationRequest(request)).not.toThrow();
  });

  it("rejects malformed and missing declared sizes for JSON mutations", () => {
    const malformed = new Request("https://aideas.local/api/projects", {
      method: "POST",
      headers: { "content-length": "not-a-number" },
    });
    const missing = new Request("https://aideas.local/api/projects", {
      method: "POST",
    });

    assertDomainError(
      () => assertSafeMutationRequest(malformed),
      "VALIDATION_ERROR",
    );
    assertDomainError(
      () => assertSafeMutationRequest(missing),
      "VALIDATION_ERROR",
    );
  });
});

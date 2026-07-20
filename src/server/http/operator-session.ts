import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { DomainError } from "@/server/domain/errors";

const SESSION_COOKIE = "aideas_operator_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1_000;

type OperatorSession = {
  tokenDigest: Buffer;
  expiresAt: number;
};

type OperatorSessionRegistry = Map<string, OperatorSession>;
const registryKey = Symbol.for("aideas.operator-session.registry");
const globalWithRegistry = globalThis as typeof globalThis & {
  [registryKey]?: OperatorSessionRegistry;
};

function registry() {
  globalWithRegistry[registryKey] ??= new Map();
  return globalWithRegistry[registryKey];
}

function tokenDigest(token: string) {
  return createHash("sha256").update(token, "utf8").digest();
}

function loopbackHost(hostname: string) {
  const normalized = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function requestHostname(request: Request) {
  const requestUrl = new URL(request.url);
  const rawHost = request.headers.get("host");
  const headerHostname = rawHost
    ? new URL(`http://${rawHost}`).hostname
    : requestUrl.hostname;
  return { requestHostname: requestUrl.hostname, headerHostname };
}

function cookieValue(request: Request, name: string) {
  const cookie = request.headers.get("cookie") ?? "";
  for (const pair of cookie.split(";")) {
    const separator = pair.indexOf("=");
    if (separator === -1) continue;
    if (pair.slice(0, separator).trim() === name) {
      return decodeURIComponent(pair.slice(separator + 1).trim());
    }
  }
  return null;
}

export function assertLoopbackRequest(request: Request) {
  const hosts = requestHostname(request);
  if (!loopbackHost(hosts.requestHostname) || !loopbackHost(hosts.headerHostname)) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Această acțiune este disponibilă numai operatorului local.",
      403,
    );
  }
}

export function issueOperatorSession(request: Request) {
  assertLoopbackRequest(request);
  const sessionId = randomUUID();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_TTL_MS;
  const sessions = registry();
  for (const [id, session] of sessions) {
    if (session.expiresAt <= Date.now()) sessions.delete(id);
  }
  sessions.set(sessionId, { tokenDigest: tokenDigest(token), expiresAt });
  return {
    token,
    cookie: `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${Math.floor(SESSION_TTL_MS / 1_000)}`,
    expiresAt: new Date(expiresAt).toISOString(),
  };
}

export function assertOperatorSession(request: Request) {
  assertLoopbackRequest(request);
  const sessionId = cookieValue(request, SESSION_COOKIE);
  const token = request.headers.get("x-aideas-operator-token");
  if (!sessionId || !token) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Sesiunea operatorului local lipsește.",
      403,
    );
  }
  const session = registry().get(sessionId);
  if (!session || session.expiresAt <= Date.now()) {
    registry().delete(sessionId);
    throw new DomainError(
      "VALIDATION_ERROR",
      "Sesiunea operatorului local a expirat.",
      403,
    );
  }
  const received = tokenDigest(token);
  if (
    received.byteLength !== session.tokenDigest.byteLength ||
    !timingSafeEqual(received, session.tokenDigest)
  ) {
    throw new DomainError(
      "VALIDATION_ERROR",
      "Sesiunea operatorului local nu este validă.",
      403,
    );
  }
}

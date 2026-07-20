import { describe, expect, it } from "vitest";

import {
  assertOperatorSession,
  issueOperatorSession,
} from "../../src/server/http/operator-session";

describe("local operator session", () => {
  it("binds a CSRF token to an HttpOnly loopback session", () => {
    const request = new Request("http://127.0.0.1:3001/api/operator/session", {
      headers: { host: "127.0.0.1:3001" },
    });
    const issued = issueOperatorSession(request);
    const cookie = issued.cookie.split(";", 1)[0];
    expect(() =>
      assertOperatorSession(
        new Request("http://127.0.0.1:3001/api/projects/project/research", {
          method: "POST",
          headers: {
            host: "127.0.0.1:3001",
            cookie,
            "x-aideas-operator-token": issued.token,
          },
        }),
      ),
    ).not.toThrow();
  });

  it("rejects LAN hosts and missing operator credentials", () => {
    expect(() =>
      issueOperatorSession(
        new Request("http://192.168.1.5:3001/api/operator/session", {
          headers: { host: "192.168.1.5:3001" },
        }),
      ),
    ).toThrow("numai operatorului local");
    expect(() =>
      assertOperatorSession(
        new Request("http://127.0.0.1:3001/api/projects/project/research", {
          headers: { host: "127.0.0.1:3001" },
        }),
      ),
    ).toThrow("lipsește");
  });
});

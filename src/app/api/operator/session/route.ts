import { issueOperatorSession } from "@/server/http/operator-session";
import { jsonNoStore, safeErrorResponse } from "@/server/http/responses";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const session = issueOperatorSession(request);
    return jsonNoStore(
      { csrfToken: session.token, expiresAt: session.expiresAt },
      { headers: { "Set-Cookie": session.cookie } },
    );
  } catch (error) {
    return safeErrorResponse(error);
  }
}

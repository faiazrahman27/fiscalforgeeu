import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../../lib/api/local-proxy";

export async function POST(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const requestBody = await request.text();
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspace/invitations/accept`,
      {
        method: "POST",
        headers: await buildLocalApiHeaders({
          contentType: "application/json"
        }),
        body: requestBody,
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_WORKSPACE_INVITATION_ACCEPT_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

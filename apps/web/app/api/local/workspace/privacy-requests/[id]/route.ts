import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../../lib/api/local-proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { id } = await context.params;
  const cleanId = id.trim();

  if (!cleanId) {
    return NextResponse.json(
      {
        error: {
          code: "VALIDATION_ERROR",
          message: "Privacy request ID is required.",
          details: null
        }
      },
      {
        status: 400
      }
    );
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const requestBody = await request.text();
    const headers = new Headers(await buildLocalApiHeaders());

    headers.set("content-type", "application/json");

    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspace/privacy-requests/${encodeURIComponent(
        cleanId
      )}`,
      {
        method: "PATCH",
        headers,
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
      "LOCAL_WORKSPACE_PRIVACY_REQUEST_UPDATE_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

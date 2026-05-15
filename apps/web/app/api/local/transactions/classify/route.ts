import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData,
  readSupabaseAccessToken
} from "../../../../../lib/api/local-proxy";

export async function POST(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const accessToken = await readSupabaseAccessToken();

  if (!accessToken) {
    return NextResponse.json(
      {
        error: {
          code: "WORKSPACE_AUTH_REQUIRED",
          message:
            "Sign in before running the workspace transaction classifier.",
          details: null
        }
      },
      {
        status: 401
      }
    );
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const requestBody = await request.text();
    const headers = new Headers(await buildLocalApiHeaders());

    headers.set("content-type", "application/json");

    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/transactions/classify`,
      {
        method: "POST",
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
      "LOCAL_TRANSACTION_CLASSIFIER_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

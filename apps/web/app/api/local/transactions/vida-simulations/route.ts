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

function buildAuthRequiredResponse() {
  return NextResponse.json(
    {
      error: {
        code: "WORKSPACE_AUTH_REQUIRED",
        message: "Sign in before reading workspace ViDA simulation history.",
        details: null
      }
    },
    {
      status: 401
    }
  );
}

export async function GET(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const accessToken = await readSupabaseAccessToken();

  if (!accessToken) {
    return buildAuthRequiredResponse();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const headers = new Headers(await buildLocalApiHeaders());
    const query = request.nextUrl.searchParams.toString();
    const upstreamUrl = query
      ? `${apiBaseUrl}/api/v1/transactions/vida-simulations?${query}`
      : `${apiBaseUrl}/api/v1/transactions/vida-simulations`;

    const apiResponse = await fetch(upstreamUrl, {
      method: "GET",
      headers,
      cache: "no-store"
    });

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_VIDA_SIMULATION_HISTORY_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}
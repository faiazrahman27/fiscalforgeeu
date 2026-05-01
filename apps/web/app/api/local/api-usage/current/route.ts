import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

const forwardedFilters = ["apiKeyId", "policyKey"];

function buildForwardedQuery(request: NextRequest) {
  const query = new URLSearchParams();

  for (const filter of forwardedFilters) {
    const value = request.nextUrl.searchParams.get(filter);

    if (value !== null && value.trim().length > 0) {
      query.set(filter, value.trim());
    }
  }

  const queryString = query.toString();

  return queryString ? `?${queryString}` : "";
}

export async function GET(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/api-usage/current${buildForwardedQuery(request)}`,
      {
        method: "GET",
        headers: await buildLocalApiHeaders(),
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_API_USAGE_CURRENT_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}


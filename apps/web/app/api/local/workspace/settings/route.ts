import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

export async function GET() {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const apiResponse = await fetch(`${apiBaseUrl}/api/v1/workspace/settings`, {
      method: "GET",
      headers: await buildLocalApiHeaders(),
      cache: "no-store"
    });

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_WORKSPACE_SETTINGS_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const requestBody = await request.text();
    const headers = new Headers(await buildLocalApiHeaders());

    headers.set("content-type", "application/json");

    const apiResponse = await fetch(`${apiBaseUrl}/api/v1/workspace/settings`, {
      method: "PUT",
      headers,
      body: requestBody,
      cache: "no-store"
    });

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_WORKSPACE_SETTINGS_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

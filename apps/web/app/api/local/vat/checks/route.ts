import { NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

export async function GET(request: Request) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const requestUrl = new URL(request.url);
  const upstreamUrl = new URL(`${apiBaseUrl}/api/v1/vat/checks`);

  requestUrl.searchParams.forEach((value, key) => {
    upstreamUrl.searchParams.set(key, value);
  });

  try {
    const apiResponse = await fetch(upstreamUrl, {
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
      "LOCAL_VAT_CHECKS_PROXY_ERROR",
      "Could not reach the Invoice Lantern API for VAT format check history. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

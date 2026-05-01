import { NextRequest, NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

function buildQueryString(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  const limit = params.get("limit");
  const status = params.get("status");

  if (limit) {
    query.set("limit", limit);
  }

  if (status) {
    query.set("status", status);
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
      `${apiBaseUrl}/api/v1/xml/validation-jobs${buildQueryString(request)}`,
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
      "LOCAL_XML_VALIDATION_JOBS_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

export async function POST(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const payload = await request.text();

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/xml/validation-jobs`,
      {
        method: "POST",
        headers: await buildLocalApiHeaders({
          contentType: "application/json"
        }),
        body: payload,
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_XML_VALIDATION_JOB_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

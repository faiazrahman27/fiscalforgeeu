import { NextRequest, NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/invoices/${encodeURIComponent(id)}`,
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
      "LOCAL_PRODUCTION_INVOICE_PROXY_ERROR",
      "Could not read the production invoice through the local API proxy.",
      503
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const { id } = await context.params;
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "INVALID_JSON",
          message: "Request body must be valid JSON.",
          details: null
        }
      },
      {
        status: 400
      }
    );
  }

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/invoices/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: await buildLocalApiHeaders({
          contentType: "application/json"
        }),
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_PRODUCTION_INVOICE_PROXY_ERROR",
      "Could not update the production invoice through the local API proxy.",
      503
    );
  }
}

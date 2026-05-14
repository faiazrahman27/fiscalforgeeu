import { NextRequest, NextResponse } from "next/server";
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

export async function POST(request: NextRequest, context: RouteContext) {
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
      `${apiBaseUrl}/api/v1/invoices/${encodeURIComponent(id)}/transition`,
      {
        method: "POST",
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
      "LOCAL_PRODUCTION_INVOICE_TRANSITION_PROXY_ERROR",
      "Could not transition the production invoice through the local API proxy.",
      503
    );
  }
}

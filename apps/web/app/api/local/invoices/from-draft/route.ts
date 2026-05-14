import { NextRequest, NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

export async function POST(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
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
    const apiResponse = await fetch(`${apiBaseUrl}/api/v1/invoices/from-draft`, {
      method: "POST",
      headers: await buildLocalApiHeaders({
        contentType: "application/json"
      }),
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_PRODUCTION_INVOICE_FROM_DRAFT_PROXY_ERROR",
      "Could not convert the draft through the local API proxy.",
      503
    );
  }
}

import { NextResponse } from "next/server";
import {
  buildLocalApiProxyError,
  readLocalApiResponseData
} from "../../../../lib/api/local-proxy";

function getOpenApiBaseUrl() {
  return (
    process.env.INVOICE_LANTERN_API_BASE_URL?.trim().replace(/\/+$/, "") ||
    "http://localhost:4000"
  );
}

export async function GET() {
  const apiBaseUrl = getOpenApiBaseUrl();

  try {
    const apiResponse = await fetch(`${apiBaseUrl}/api/v1/openapi.json`, {
      method: "GET",
      cache: "no-store"
    });
    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_OPENAPI_PROXY_ERROR",
      "Could not reach the Invoice Lantern API OpenAPI document. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

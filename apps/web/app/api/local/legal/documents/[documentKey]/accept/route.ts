import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../../../lib/api/local-proxy";

type RouteContext = {
  params: Promise<{
    documentKey?: string;
  }>;
};

export async function POST(request: NextRequest, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { documentKey } = await context.params;
  const cleanDocumentKey = documentKey?.trim() ?? "";

  if (!cleanDocumentKey) {
    return NextResponse.json(
      {
        error: {
          code: "LEGAL_DOCUMENT_KEY_REQUIRED",
          message: "Legal document key is required.",
          details: null
        }
      },
      {
        status: 400
      }
    );
  }

  const requestBody = await request.text();
  const { apiBaseUrl } = getLocalApiProxyConfig();

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/legal/documents/${encodeURIComponent(
        cleanDocumentKey
      )}/accept`,
      {
        method: "POST",
        headers: await buildLocalApiHeaders({
          contentType: "application/json"
        }),
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
      "LOCAL_LEGAL_DOCUMENT_ACCEPT_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

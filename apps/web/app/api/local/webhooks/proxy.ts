import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData,
  readSupabaseAccessToken
} from "../../../../lib/api/local-proxy";

export function buildWebhookAuthRequiredResponse() {
  return NextResponse.json(
    {
      error: {
        code: "WORKSPACE_AUTH_REQUIRED",
        message: "Sign in before managing webhook simulator endpoints.",
        details: null
      }
    },
    {
      status: 401
    }
  );
}

export async function proxyWebhookRequest(input: {
  request?: NextRequest;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  upstreamPath: string;
  includeBody?: boolean;
}) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const accessToken = await readSupabaseAccessToken();

  if (!accessToken) {
    return buildWebhookAuthRequiredResponse();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const query = input.request?.nextUrl.searchParams.toString();
  const upstreamUrl = query
    ? `${apiBaseUrl}/api/v1/webhooks${input.upstreamPath}?${query}`
    : `${apiBaseUrl}/api/v1/webhooks${input.upstreamPath}`;

  try {
    const requestBody =
      input.includeBody && input.request ? await input.request.text() : undefined;
    const headers = await buildLocalApiHeaders(
      input.includeBody
        ? {
            contentType: "application/json"
          }
        : undefined
    );

    const apiResponse = await fetch(upstreamUrl, {
      method: input.method,
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
      "LOCAL_WEBHOOKS_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

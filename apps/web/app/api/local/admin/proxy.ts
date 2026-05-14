import { NextResponse, type NextRequest } from "next/server";
import {
  buildLocalApiProxyError,
  getLocalApiProxyConfig,
  readLocalApiResponseData,
  readSupabaseAccessToken
} from "../../../../lib/api/local-proxy";

export function buildAdminAuthRequiredResponse() {
  return NextResponse.json(
    {
      error: {
        code: "PLATFORM_ADMIN_AUTH_REQUIRED",
        message:
          "Sign in with a platform-admin account before managing rule intelligence, source references, or country-pack review metadata.",
        details: null
      }
    },
    {
      status: 401
    }
  );
}

export function buildAdminProxyNotConfiguredResponse() {
  return NextResponse.json(
    {
      error: {
        code: "WEB_API_PROXY_NOT_CONFIGURED",
        message:
          "Missing INVOICE_LANTERN_API_BASE_URL in the web environment.",
        details: null
      }
    },
    {
      status: 500
    }
  );
}

function buildHeaders(accessToken: string, includeBody: boolean) {
  const headers: Record<string, string> = {
    authorization: `Bearer ${accessToken}`
  };

  if (includeBody) {
    headers["content-type"] = "application/json";
  }

  return headers;
}

export async function proxyAdminRequest(input: {
  request: NextRequest;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  upstreamPath: string;
  includeBody?: boolean;
}) {
  const { apiBaseUrl } = getLocalApiProxyConfig();

  if (!apiBaseUrl) {
    return buildAdminProxyNotConfiguredResponse();
  }

  const accessToken = await readSupabaseAccessToken();

  if (!accessToken) {
    return buildAdminAuthRequiredResponse();
  }

  const query = input.request.nextUrl.searchParams.toString();
  const upstreamUrl = query
    ? `${apiBaseUrl}/api/v1/admin${input.upstreamPath}?${query}`
    : `${apiBaseUrl}/api/v1/admin${input.upstreamPath}`;

  try {
    const body = input.includeBody ? await input.request.text() : undefined;
    const apiResponse = await fetch(upstreamUrl, {
      method: input.method,
      headers: buildHeaders(accessToken, Boolean(input.includeBody)),
      body,
      cache: "no-store"
    });
    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_ADMIN_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}


import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../supabase/server";

export type LocalApiHeaders = Record<string, string>;

export function getLocalApiProxyConfig() {
  return {
    apiBaseUrl: process.env.INVOICE_LANTERN_API_BASE_URL?.trim() ?? "",
    devApiKey: process.env.INVOICE_LANTERN_DEV_API_KEY?.trim() ?? ""
  };
}

export function hasLocalApiProxyConfig() {
  const { apiBaseUrl, devApiKey } = getLocalApiProxyConfig();

  return Boolean(apiBaseUrl && devApiKey);
}

export function buildLocalApiProxyNotConfiguredError() {
  return NextResponse.json(
    {
      error: {
        code: "WEB_API_PROXY_NOT_CONFIGURED",
        message:
          "Missing INVOICE_LANTERN_API_BASE_URL or INVOICE_LANTERN_DEV_API_KEY in apps/web/.env.local.",
        details: null
      }
    },
    {
      status: 500
    }
  );
}

export function buildLocalApiProxyError(
  code: string,
  message: string,
  status = 502
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        details: null
      }
    },
    {
      status
    }
  );
}

export async function readSupabaseAccessToken() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    return session?.access_token ?? "";
  } catch {
    /*
     * Keep local proxy routes usable when Supabase is not configured.
     * The dedicated API can still accept the development API key.
     */
    return "";
  }
}

export async function buildLocalApiHeaders(options?: {
  contentType?: string;
  extraHeaders?: Record<string, string>;
}) {
  const { devApiKey } = getLocalApiProxyConfig();
  const accessToken = await readSupabaseAccessToken();

  const headers: LocalApiHeaders = {
    "x-api-key": devApiKey
  };

  if (options?.contentType) {
    headers["content-type"] = options.contentType;
  }

  if (options?.extraHeaders) {
    Object.entries(options.extraHeaders).forEach(([key, value]) => {
      headers[key] = value;
    });
  }

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

export async function readLocalApiResponseData(response: Response) {
  const responseText = await response.text();

  if (!responseText.trim()) {
    return null;
  }

  try {
    return JSON.parse(responseText) as unknown;
  } catch {
    return {
      error: {
        code: "UPSTREAM_NON_JSON_RESPONSE",
        message: responseText.slice(0, 500),
        details: null
      }
    };
  }
}

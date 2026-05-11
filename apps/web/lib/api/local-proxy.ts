import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../supabase/server";

export type LocalApiHeaders = Record<string, string>;

type LocalApiProxyConfig = {
  apiBaseUrl: string;
  devApiKey: string;
  isProduction: boolean;
};

function isProductionWebRuntime() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_APP_ENV === "production" ||
    process.env.APP_ENV === "production"
  );
}

export function getLocalApiProxyConfig(): LocalApiProxyConfig {
  return {
    apiBaseUrl: process.env.INVOICE_LANTERN_API_BASE_URL?.trim() ?? "",
    devApiKey: process.env.INVOICE_LANTERN_DEV_API_KEY?.trim() ?? "",
    isProduction: isProductionWebRuntime()
  };
}

export function hasLocalApiProxyConfig() {
  const { apiBaseUrl, devApiKey, isProduction } = getLocalApiProxyConfig();

  if (!apiBaseUrl) {
    return false;
  }

  if (isProduction) {
    return true;
  }

  return Boolean(devApiKey);
}

export function buildLocalApiProxyNotConfiguredError() {
  const { isProduction } = getLocalApiProxyConfig();

  return NextResponse.json(
    {
      error: {
        code: "WEB_API_PROXY_NOT_CONFIGURED",
        message: isProduction
          ? "Missing INVOICE_LANTERN_API_BASE_URL in apps/web production environment."
          : "Missing INVOICE_LANTERN_API_BASE_URL or INVOICE_LANTERN_DEV_API_KEY in apps/web/.env.local.",
        details: {
          productionRequiresDevApiKey: false
        }
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
     * Keep local development proxy routes usable when Supabase is not configured.
     * Production requests should normally carry a Supabase user session.
     */
    return "";
  }
}

export async function buildLocalApiHeaders(options?: {
  contentType?: string;
  extraHeaders?: Record<string, string>;
}) {
  const { devApiKey, isProduction } = getLocalApiProxyConfig();
  const accessToken = await readSupabaseAccessToken();

  const headers: LocalApiHeaders = {};

  if (!isProduction && devApiKey) {
    headers["x-api-key"] = devApiKey;
  }

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
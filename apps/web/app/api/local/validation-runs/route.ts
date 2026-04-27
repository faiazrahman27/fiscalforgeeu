import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../lib/supabase/server";

const API_BASE_URL = process.env.INVOICE_LANTERN_API_BASE_URL;
const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY;

type ApiHeaders = {
  "x-api-key": string;
  authorization?: string;
};

function buildProxyError(message: string, status = 502) {
  return NextResponse.json(
    {
      error: {
        code: "LOCAL_VALIDATION_RUNS_PROXY_ERROR",
        message,
        details: null
      }
    },
    {
      status
    }
  );
}

function buildNotConfiguredError() {
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

async function readSupabaseAccessToken() {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { session }
    } = await supabase.auth.getSession();

    return session?.access_token ?? "";
  } catch {
    /*
     * Keep the local API proxy usable when Supabase is not configured yet.
     * The dedicated API still receives the development API key below.
     */
    return "";
  }
}

async function buildApiHeaders(): Promise<ApiHeaders> {
  const accessToken = await readSupabaseAccessToken();

  const headers: ApiHeaders = {
    "x-api-key": DEV_API_KEY ?? ""
  };

  if (accessToken) {
    headers.authorization = `Bearer ${accessToken}`;
  }

  return headers;
}

async function readResponseData(response: Response) {
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

export async function GET() {
  if (!API_BASE_URL || !DEV_API_KEY) {
    return buildNotConfiguredError();
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/api/v1/validation-runs`, {
      method: "GET",
      headers: await buildApiHeaders(),
      cache: "no-store"
    });

    const data = await readResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildProxyError(
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

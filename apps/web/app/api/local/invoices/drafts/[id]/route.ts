import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "../../../../../../lib/supabase/server";

const API_BASE_URL = process.env.INVOICE_LANTERN_API_BASE_URL;
const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ApiHeaders = {
  "x-api-key": string;
  "content-type"?: string;
  authorization?: string;
};

function buildProxyError(message: string, status = 502) {
  return NextResponse.json(
    {
      error: {
        code: "LOCAL_INVOICE_DRAFT_PROXY_ERROR",
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

async function buildApiHeaders(options?: { json?: boolean }): Promise<ApiHeaders> {
  const accessToken = await readSupabaseAccessToken();

  const headers: ApiHeaders = {
    "x-api-key": DEV_API_KEY ?? ""
  };

  if (options?.json) {
    headers["content-type"] = "application/json";
  }

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

export async function GET(_request: Request, context: RouteContext) {
  if (!API_BASE_URL || !DEV_API_KEY) {
    return buildNotConfiguredError();
  }

  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${API_BASE_URL}/api/v1/invoices/drafts/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: await buildApiHeaders(),
        cache: "no-store"
      }
    );

    const data = await readResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildProxyError(
      "Could not read the invoice draft through the local API proxy. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!API_BASE_URL || !DEV_API_KEY) {
    return buildNotConfiguredError();
  }

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
      `${API_BASE_URL}/api/v1/invoices/drafts/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: await buildApiHeaders({ json: true }),
        body: JSON.stringify(payload),
        cache: "no-store"
      }
    );

    const data = await readResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildProxyError(
      "Could not update the invoice draft through the local API proxy. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!API_BASE_URL || !DEV_API_KEY) {
    return buildNotConfiguredError();
  }

  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${API_BASE_URL}/api/v1/invoices/drafts/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: await buildApiHeaders(),
        cache: "no-store"
      }
    );

    const data = await readResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildProxyError(
      "Could not delete the invoice draft through the local API proxy. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

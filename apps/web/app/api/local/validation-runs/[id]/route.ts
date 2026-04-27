import { NextResponse } from "next/server";

const API_BASE_URL = process.env.INVOICE_LANTERN_API_BASE_URL;
const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function buildProxyError(message: string, status = 502) {
  return NextResponse.json(
    {
      error: {
        code: "LOCAL_VALIDATION_RUN_PROXY_ERROR",
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

function buildApiHeaders() {
  return {
    "x-api-key": DEV_API_KEY ?? ""
  };
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
      `${API_BASE_URL}/api/v1/validation-runs/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: buildApiHeaders(),
        cache: "no-store"
      }
    );

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

export async function DELETE(_request: Request, context: RouteContext) {
  if (!API_BASE_URL || !DEV_API_KEY) {
    return buildNotConfiguredError();
  }

  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${API_BASE_URL}/api/v1/validation-runs/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: buildApiHeaders(),
        cache: "no-store"
      }
    );

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

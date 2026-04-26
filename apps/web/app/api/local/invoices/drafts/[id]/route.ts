import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.INVOICE_LANTERN_API_BASE_URL ?? "http://127.0.0.1:4000";

const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY ?? "";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function buildApiHeaders() {
  return {
    "content-type": "application/json",
    "x-api-key": DEV_API_KEY
  };
}

function buildProxyError(message: string, status = 502) {
  return NextResponse.json(
    {
      error: {
        code: "LOCAL_PROXY_ERROR",
        message,
        details: null
      }
    },
    {
      status
    }
  );
}

export async function GET(_request: Request, context: RouteContext) {
  if (!DEV_API_KEY) {
    return buildProxyError("Missing INVOICE_LANTERN_DEV_API_KEY.", 500);
  }

  const { id } = await context.params;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/invoices/drafts/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: buildApiHeaders(),
        cache: "no-store"
      }
    );

    const responseData: unknown = await response.json();

    return NextResponse.json(responseData, {
      status: response.status
    });
  } catch {
    return buildProxyError(
      "Could not read the invoice draft through the local API proxy."
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  if (!DEV_API_KEY) {
    return buildProxyError("Missing INVOICE_LANTERN_DEV_API_KEY.", 500);
  }

  const { id } = await context.params;

  try {
    const requestBody: unknown = await request.json();

    const response = await fetch(
      `${API_BASE_URL}/api/v1/invoices/drafts/${encodeURIComponent(id)}`,
      {
        method: "PUT",
        headers: buildApiHeaders(),
        body: JSON.stringify(requestBody),
        cache: "no-store"
      }
    );

    const responseData: unknown = await response.json();

    return NextResponse.json(responseData, {
      status: response.status
    });
  } catch {
    return buildProxyError(
      "Could not update the invoice draft through the local API proxy."
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  if (!DEV_API_KEY) {
    return buildProxyError("Missing INVOICE_LANTERN_DEV_API_KEY.", 500);
  }

  const { id } = await context.params;

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/v1/invoices/drafts/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: buildApiHeaders(),
        cache: "no-store"
      }
    );

    const responseData: unknown = await response.json();

    return NextResponse.json(responseData, {
      status: response.status
    });
  } catch {
    return buildProxyError(
      "Could not delete the invoice draft through the local API proxy."
    );
  }
}

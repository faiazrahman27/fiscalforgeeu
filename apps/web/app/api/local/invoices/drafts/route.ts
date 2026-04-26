import { NextResponse } from "next/server";

const API_BASE_URL =
  process.env.INVOICE_LANTERN_API_BASE_URL ?? "http://127.0.0.1:4000";

const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY ?? "";

function buildApiHeaders(contentType = "application/json") {
  return {
    "content-type": contentType,
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

export async function GET() {
  if (!DEV_API_KEY) {
    return buildProxyError("Missing INVOICE_LANTERN_DEV_API_KEY.", 500);
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/v1/invoices/drafts`, {
      method: "GET",
      headers: buildApiHeaders(),
      cache: "no-store"
    });

    const responseData: unknown = await response.json();

    return NextResponse.json(responseData, {
      status: response.status
    });
  } catch {
    return buildProxyError(
      "Could not reach the Invoice Lantern API draft endpoint."
    );
  }
}

export async function POST(request: Request) {
  if (!DEV_API_KEY) {
    return buildProxyError("Missing INVOICE_LANTERN_DEV_API_KEY.", 500);
  }

  try {
    const body = await request.json();

    const response = await fetch(`${API_BASE_URL}/api/v1/invoices/drafts`, {
      method: "POST",
      headers: buildApiHeaders(),
      body: JSON.stringify(body),
      cache: "no-store"
    });

    const responseData: unknown = await response.json();

    return NextResponse.json(responseData, {
      status: response.status
    });
  } catch {
    return buildProxyError(
      "Could not save the invoice draft through the local API proxy."
    );
  }
}

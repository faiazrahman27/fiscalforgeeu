import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.INVOICE_LANTERN_API_BASE_URL;
const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY;

export async function POST(request: NextRequest) {
  if (!API_BASE_URL || !DEV_API_KEY) {
    return NextResponse.json(
      {
        error: {
          code: "WEB_API_PROXY_NOT_CONFIGURED",
          message:
            "Missing INVOICE_LANTERN_API_BASE_URL or INVOICE_LANTERN_DEV_API_KEY in apps/web/.env.local.",
          details: null
        }
      },
      { status: 500 }
    );
  }

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
      { status: 400 }
    );
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/api/v1/invoices/validate`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": DEV_API_KEY
      },
      body: JSON.stringify(payload),
      cache: "no-store"
    });

    const data = await apiResponse.json();

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return NextResponse.json(
      {
        error: {
          code: "API_UNAVAILABLE",
          message:
            "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
          details: null
        }
      },
      { status: 503 }
    );
  }
}
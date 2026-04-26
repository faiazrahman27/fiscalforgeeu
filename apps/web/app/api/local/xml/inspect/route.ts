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

  const xmlBody = await request.text();

  if (!xmlBody.trim()) {
    return NextResponse.json(
      {
        error: {
          code: "XML_BODY_REQUIRED",
          message: "XML body cannot be empty.",
          details: null
        }
      },
      { status: 400 }
    );
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/api/v1/xml/inspect`, {
      method: "POST",
      headers: {
        "content-type": "application/xml",
        "x-api-key": DEV_API_KEY
      },
      body: xmlBody,
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
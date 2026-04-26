import { NextResponse } from "next/server";

const API_BASE_URL = process.env.INVOICE_LANTERN_API_BASE_URL;
const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY;

function buildProxyError(message: string, status = 502) {
  return NextResponse.json(
    {
      error: {
        code: "LOCAL_XML_UPLOADS_PROXY_ERROR",
        message,
        details: null
      }
    },
    {
      status
    }
  );
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
        message: responseText,
        details: null
      }
    };
  }
}

export async function GET() {
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

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/api/v1/xml/uploads`, {
      method: "GET",
      headers: {
        "x-api-key": DEV_API_KEY
      },
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

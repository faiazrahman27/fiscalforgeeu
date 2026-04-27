import { NextRequest, NextResponse } from "next/server";

const API_BASE_URL = process.env.INVOICE_LANTERN_API_BASE_URL;
const DEV_API_KEY = process.env.INVOICE_LANTERN_DEV_API_KEY;
const MAX_XML_BODY_BYTES = 1024 * 1024 * 2;

function buildProxyError(message: string, status = 502) {
  return NextResponse.json(
    {
      error: {
        code: "LOCAL_XML_PROXY_ERROR",
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
    { status: 500 }
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
        message: responseText.slice(0, 500),
        details: null
      }
    };
  }
}

function readHeaderValue(request: NextRequest, key: string) {
  return request.headers.get(key)?.trim() ?? "";
}

function sanitizeForwardedHeaderValue(value: string) {
  return value.replace(/[^\x20-\x7E]/g, "_").slice(0, 180);
}

function isXmlContentType(contentType: string) {
  const normalizedContentType = contentType.toLowerCase();

  return (
    normalizedContentType.includes("application/xml") ||
    normalizedContentType.includes("text/xml") ||
    normalizedContentType.includes("+xml")
  );
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

export async function POST(request: NextRequest) {
  if (!API_BASE_URL || !DEV_API_KEY) {
    return buildNotConfiguredError();
  }

  const contentType = readHeaderValue(request, "content-type");

  if (!isXmlContentType(contentType)) {
    return NextResponse.json(
      {
        error: {
          code: "XML_CONTENT_TYPE_REQUIRED",
          message: "XML inspection requests must use an XML content type.",
          details: null
        }
      },
      { status: 415 }
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

  if (getUtf8ByteLength(xmlBody) > MAX_XML_BODY_BYTES) {
    return NextResponse.json(
      {
        error: {
          code: "XML_BODY_TOO_LARGE",
          message: "XML body must be 2 MB or smaller.",
          details: null
        }
      },
      { status: 413 }
    );
  }

  try {
    const apiResponse = await fetch(`${API_BASE_URL}/api/v1/xml/inspect`, {
      method: "POST",
      headers: {
        "content-type": "application/xml",
        "x-api-key": DEV_API_KEY,
        "x-file-name": sanitizeForwardedHeaderValue(
          readHeaderValue(request, "x-file-name")
        ),
        "x-file-size": sanitizeForwardedHeaderValue(
          readHeaderValue(request, "x-file-size")
        )
      },
      body: xmlBody,
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

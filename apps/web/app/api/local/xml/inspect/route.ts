import { NextRequest, NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../lib/api/local-proxy";

const MAX_XML_BODY_BYTES = 1024 * 1024 * 2;

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
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
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
    const apiResponse = await fetch(`${apiBaseUrl}/api/v1/xml/inspect`, {
      method: "POST",
      headers: await buildLocalApiHeaders({
        contentType: "application/xml",
        extraHeaders: {
          "x-file-name": sanitizeForwardedHeaderValue(
            readHeaderValue(request, "x-file-name")
          ),
          "x-file-size": sanitizeForwardedHeaderValue(
            readHeaderValue(request, "x-file-size")
          )
        }
      }),
      body: xmlBody,
      cache: "no-store"
    });

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_XML_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

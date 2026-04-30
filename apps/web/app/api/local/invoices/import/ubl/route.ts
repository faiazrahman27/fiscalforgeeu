import { NextRequest, NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../../lib/api/local-proxy";

const MAX_XML_BODY_BYTES = 1024 * 1024 * 2;

function isXmlContentType(contentType: string) {
  const normalizedContentType = contentType.toLowerCase();

  return (
    normalizedContentType.includes("application/xml") ||
    normalizedContentType.includes("text/xml") ||
    normalizedContentType.includes("+xml")
  );
}

function isJsonContentType(contentType: string) {
  return contentType.toLowerCase().includes("application/json");
}

function getUtf8ByteLength(value: string) {
  return new TextEncoder().encode(value).byteLength;
}

function getXmlSizeError() {
  return NextResponse.json(
    {
      error: {
        code: "XML_BODY_TOO_LARGE",
        message: "XML body must be 2 MB or smaller.",
        details: null
      },
      created: false,
      reason: "XML body must be 2 MB or smaller."
    },
    { status: 413 }
  );
}

function readXmlField(value: unknown) {
  if (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "xml" in value &&
    typeof value.xml === "string"
  ) {
    return value.xml;
  }

  return "";
}

export async function POST(request: NextRequest) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const contentType = request.headers.get("content-type")?.trim() ?? "";
  let body: string;
  let upstreamContentType: "application/json" | "application/xml";

  if (isXmlContentType(contentType)) {
    const xml = await request.text();

    if (!xml.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "XML_BODY_REQUIRED",
            message: "XML body cannot be empty.",
            details: null
          },
          created: false,
          reason: "XML body cannot be empty."
        },
        { status: 400 }
      );
    }

    if (getUtf8ByteLength(xml) > MAX_XML_BODY_BYTES) {
      return getXmlSizeError();
    }

    body = xml;
    upstreamContentType = "application/xml";
  } else if (isJsonContentType(contentType)) {
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
          },
          created: false,
          reason: "Request body must be valid JSON."
        },
        { status: 400 }
      );
    }

    const xml = readXmlField(payload);

    if (!xml.trim()) {
      return NextResponse.json(
        {
          error: {
            code: "XML_BODY_REQUIRED",
            message: "JSON body must include a non-empty xml string.",
            details: null
          },
          created: false,
          reason: "JSON body must include a non-empty xml string."
        },
        { status: 400 }
      );
    }

    if (getUtf8ByteLength(xml) > MAX_XML_BODY_BYTES) {
      return getXmlSizeError();
    }

    body = JSON.stringify({ xml });
    upstreamContentType = "application/json";
  } else {
    return NextResponse.json(
      {
        error: {
          code: "UNSUPPORTED_MEDIA_TYPE",
          message: "Use application/xml, text/xml, or application/json.",
          details: null
        },
        created: false,
        reason: "Use application/xml, text/xml, or application/json."
      },
      { status: 415 }
    );
  }

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/invoices/import/ubl`,
      {
        method: "POST",
        headers: await buildLocalApiHeaders({
          contentType: upstreamContentType
        }),
        body,
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_UBL_IMPORT_PROXY_ERROR",
      "Could not reach the Invoice Lantern API. Make sure apps/api is running on port 4000.",
      503
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import {
  buildLocalApiHeaders,
  buildLocalApiProxyError,
  buildLocalApiProxyNotConfiguredError,
  getLocalApiProxyConfig,
  hasLocalApiProxyConfig,
  readLocalApiResponseData
} from "../../../../../../lib/api/local-proxy";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: NextRequest, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspace/contacts/${encodeURIComponent(id)}`,
      {
        method: "GET",
        headers: await buildLocalApiHeaders(),
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_WORKSPACE_CONTACT_PROXY_ERROR",
      "Could not read the workspace contact through the local API proxy.",
      503
    );
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const { id } = await context.params;
  const requestBody = await request.text();

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspace/contacts/${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: await buildLocalApiHeaders({
          contentType: "application/json"
        }),
        body: requestBody,
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_WORKSPACE_CONTACT_UPDATE_PROXY_ERROR",
      "Could not update the workspace contact through the local API proxy.",
      503
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  if (!hasLocalApiProxyConfig()) {
    return buildLocalApiProxyNotConfiguredError();
  }

  const { apiBaseUrl } = getLocalApiProxyConfig();
  const { id } = await context.params;

  try {
    const apiResponse = await fetch(
      `${apiBaseUrl}/api/v1/workspace/contacts/${encodeURIComponent(id)}`,
      {
        method: "DELETE",
        headers: await buildLocalApiHeaders(),
        cache: "no-store"
      }
    );

    const data = await readLocalApiResponseData(apiResponse);

    return NextResponse.json(data, {
      status: apiResponse.status
    });
  } catch {
    return buildLocalApiProxyError(
      "LOCAL_WORKSPACE_CONTACT_ARCHIVE_PROXY_ERROR",
      "Could not archive the workspace contact through the local API proxy.",
      503
    );
  }
}
